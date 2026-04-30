import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  return new Date(now.getTime() + istOffset).toISOString().split('T')[0]
}

function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/**
 * GET /api/employees/accounts-manager/team-stats
 * Returns detailed team performance stats for the Accounts Manager
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const isAllowed = userData.role === 'SUPER_ADMIN' ||
      (userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Access denied. Manager only.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const today = getISTDate()
    let periodStart: string
    if (period === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      periodStart = d.toISOString().split('T')[0]
    } else if (period === 'today') {
      periodStart = today
    } else {
      periodStart = `${today.substring(0, 7)}-01`
    }
    const periodStartIST = getISTStartOfDay(periodStart)

    // Get all accounts team members
    const { data: teamMembers } = await supabase
      .from('users')
      .select('id, full_name, sub_role, created_at')
      .eq('role', 'EMPLOYEE')
      .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { members: [], summary: { total_members: 0, total_verified: 0, total_rejected: 0, avg_daily_output: 0 } },
      })
    }

    const memberIds = teamMembers.map(m => m.id)

    // Get all status changes by team members in the period
    const [cpHistory, partnerHistory] = await Promise.all([
      supabase.from('cp_application_status_history')
        .select('changed_by, new_status, created_at')
        .in('changed_by', memberIds)
        .gte('created_at', periodStartIST),
      supabase.from('partner_payout_status_history')
        .select('changed_by, new_status, created_at')
        .in('changed_by', memberIds)
        .gte('created_at', periodStartIST),
    ])

    const allHistory = [...(cpHistory.data || []), ...(partnerHistory.data || [])]

    // Build per-member stats
    const members = teamMembers.map(m => {
      const actions = allHistory.filter(h => h.changed_by === m.id)
      const verified = actions.filter(a => a.new_status === 'ACCOUNTS_VERIFIED').length
      const rejected = actions.filter(a => a.new_status === 'REJECTED').length
      const pickedUp = actions.filter(a => a.new_status === 'ACCOUNTS_VERIFICATION').length
      const onHold = actions.filter(a => a.new_status === 'ON_HOLD').length

      // Calculate daily average
      const daysInPeriod = Math.max(1, Math.ceil((Date.now() - new Date(periodStartIST).getTime()) / (1000 * 60 * 60 * 24)))
      const dailyAvg = Math.round(((verified + rejected) / daysInPeriod) * 10) / 10

      // Accuracy rate
      const totalDecisions = verified + rejected
      const accuracyRate = totalDecisions > 0 ? Math.round((verified / totalDecisions) * 100) : 0

      return {
        user_id: m.id,
        name: m.full_name,
        sub_role: m.sub_role,
        verified,
        rejected,
        picked_up: pickedUp,
        on_hold: onHold,
        total_actions: verified + rejected + pickedUp + onHold,
        daily_average: dailyAvg,
        accuracy_rate: accuracyRate,
      }
    }).sort((a, b) => b.verified - a.verified)

    const totalVerified = members.reduce((s, m) => s + m.verified, 0)
    const totalRejected = members.reduce((s, m) => s + m.rejected, 0)
    const daysInPeriod = Math.max(1, Math.ceil((Date.now() - new Date(periodStartIST).getTime()) / (1000 * 60 * 60 * 24)))

    return NextResponse.json({
      success: true,
      data: {
        members,
        summary: {
          total_members: members.length,
          total_verified: totalVerified,
          total_rejected: totalRejected,
          avg_daily_output: Math.round(((totalVerified + totalRejected) / daysInPeriod) * 10) / 10,
          period,
          period_start: periodStart,
        },
      },
    })
  } catch (error) {
    logger.error('Error fetching team stats:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/employees/accounts-manager/team-stats
 * Manager delegation - reassign application to another team member
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const isAllowed = userData.role === 'SUPER_ADMIN' ||
      (userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Access denied. Manager only.' }, { status: 403 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { applicationId, applicationType, assignToUserId, notes } = body

    if (!applicationId || !applicationType || !assignToUserId) {
      return NextResponse.json({ success: false, error: 'applicationId, applicationType, and assignToUserId are required' }, { status: 400 })
    }

    // Verify target user is an accounts team member
    const { data: targetUser } = await supabase
      .from('users')
      .select('id, full_name, sub_role')
      .eq('id', assignToUserId)
      .eq('role', 'EMPLOYEE')
      .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
      .maybeSingle()

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user not found or not an accounts team member' }, { status: 404 })
    }

    const table = applicationType === 'CP' ? 'cp_applications' : 'partner_payout_applications'

    // Reset to PENDING so the target user can pick it up
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status: 'PENDING',
        accounts_verified_by: null,
        accounts_verified_at: null,
      })
      .eq('id', applicationId)
      .eq('status', 'ACCOUNTS_VERIFICATION')

    if (updateError) {
      logger.error('Error reassigning application:', { error: updateError })
      return NextResponse.json({ success: false, error: 'Failed to reassign application' }, { status: 500 })
    }

    // Log the delegation in status history
    const historyTable = applicationType === 'CP' ? 'cp_application_status_history' : 'partner_payout_status_history'
    await supabase.from(historyTable).insert({
      application_id: applicationId,
      ...(applicationType !== 'CP' && { partner_type: applicationType }),
      previous_status: 'ACCOUNTS_VERIFICATION',
      new_status: 'PENDING',
      changed_by: user.id,
      changed_by_name: userData.full_name,
      changed_by_role: userData.role,
      changed_by_sub_role: userData.sub_role,
      notes: `Manager delegation: reassigned to ${targetUser.full_name}. ${notes || ''}`.trim(),
    })

    return NextResponse.json({
      success: true,
      message: `Application reassigned to ${targetUser.full_name}`,
    })
  } catch (error) {
    logger.error('Error in team-stats PUT:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
