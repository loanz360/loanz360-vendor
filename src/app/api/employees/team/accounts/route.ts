import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/** Get IST date string (YYYY-MM-DD) */
function getISTDate(): string {
  const now = new Date()
  const istOffset = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffset)
  return istDate.toISOString().split('T')[0]
}

function getISTStartOfDay(dateStr: string): string {
  return `${dateStr}T00:00:00+05:30`
}

/**
 * GET /api/employees/team/accounts
 * Returns accounts team members with workload metrics
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

    // Only ACCOUNTS_MANAGER or SUPER_ADMIN can view team
    if (userData.role !== 'SUPER_ADMIN' &&
        !(userData.role === 'EMPLOYEE' && userData.sub_role === 'ACCOUNTS_MANAGER')) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Accounts Manager can view team.' }, { status: 403 })
    }

    const today = getISTDate()
    const todayStart = getISTStartOfDay(today)
    const monthStart = `${today.substring(0, 7)}-01`
    const monthStartIST = getISTStartOfDay(monthStart)

    // Fetch team members and workload data in parallel
    const [membersResult, cpStatusHistory, partnerStatusHistory] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, sub_role, status, last_login_at, created_at')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
        .order('full_name', { ascending: true }),

      // Get CP verification activity per user this month
      supabase
        .from('cp_application_status_history')
        .select('changed_by, new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'ACCOUNTS_VERIFICATION', 'REJECTED'])
        .gte('created_at', monthStartIST),

      // Get partner verification activity per user this month
      supabase
        .from('partner_payout_status_history')
        .select('changed_by, new_status, created_at')
        .in('new_status', ['ACCOUNTS_VERIFIED', 'ACCOUNTS_VERIFICATION', 'REJECTED'])
        .gte('created_at', monthStartIST),
    ])

    if (membersResult.error) {
      logger.error('Error fetching team members:', { error: membersResult.error })
      return NextResponse.json({ success: false, error: 'Failed to fetch team' }, { status: 500 })
    }

    const members = membersResult.data || []
    const allHistory = [
      ...(cpStatusHistory.data || []),
      ...(partnerStatusHistory.data || []),
    ]

    // Build per-member metrics
    const enrichedMembers = members.map(member => {
      const memberActivity = allHistory.filter(h => h.changed_by === member.id)
      const verifiedToday = memberActivity.filter(h =>
        h.new_status === 'ACCOUNTS_VERIFIED' && h.created_at >= todayStart
      ).length
      const verifiedMonth = memberActivity.filter(h =>
        h.new_status === 'ACCOUNTS_VERIFIED'
      ).length
      const inProgress = memberActivity.filter(h =>
        h.new_status === 'ACCOUNTS_VERIFICATION'
      ).length
      const rejectedMonth = memberActivity.filter(h =>
        h.new_status === 'REJECTED'
      ).length

      return {
        ...member,
        metrics: {
          verified_today: verifiedToday,
          verified_month: verifiedMonth,
          in_progress: inProgress,
          rejected_month: rejectedMonth,
          total_actions: verifiedMonth + rejectedMonth,
        },
      }
    })

    // Department summary
    const totalVerifiedToday = enrichedMembers.reduce((s, m) => s + m.metrics.verified_today, 0)
    const totalVerifiedMonth = enrichedMembers.reduce((s, m) => s + m.metrics.verified_month, 0)
    const totalInProgress = enrichedMembers.reduce((s, m) => s + m.metrics.in_progress, 0)
    const activeCount = members.filter(m => m.status === 'ACTIVE').length

    return NextResponse.json({
      success: true,
      data: {
        members: enrichedMembers,
        summary: {
          total_members: members.length,
          active_members: activeCount,
          executives: members.filter(m => m.sub_role === 'ACCOUNTS_EXECUTIVE').length,
          managers: members.filter(m => m.sub_role === 'ACCOUNTS_MANAGER').length,
          verified_today: totalVerifiedToday,
          verified_month: totalVerifiedMonth,
          in_progress: totalInProgress,
        },
      },
    })
  } catch (error) {
    logger.error('Error in accounts team API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
