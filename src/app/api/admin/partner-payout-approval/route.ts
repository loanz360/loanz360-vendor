import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
/**
 * Super Admin - Partner Payout Approval API
 * Manages BA/BP payout application approval workflow (2nd authorization after Accounts verification)
 *
 * GET: List applications pending SA approval
 * PUT: Approve, reject, or hold applications
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyPartnerPayoutStatusChange, notifyPartnerPayoutInternalTeam } from '@/lib/notifications/partner-payout-notifications'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ACCOUNTS_VERIFIED'
    const partnerType = searchParams.get('partner_type') || 'ALL' // 'BA', 'BP', 'ALL'
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied. Only Super Admin can access this resource.' }, { status: 403 })
    }

    // Build query
    let query = supabase
      .from('partner_payout_applications')
      .select('*', { count: 'exact' })
      .order('accounts_verified_at', { ascending: true, nullsFirst: false })

    // Filter by partner type
    if (partnerType === 'BA') {
      query = query.eq('partner_type', 'BA')
    } else if (partnerType === 'BP') {
      query = query.eq('partner_type', 'BP')
    }
    // ALL = no partner_type filter

    // Filter by status
    if (status !== 'ALL') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['ACCOUNTS_VERIFIED', 'SA_APPROVED', 'REJECTED', 'ON_HOLD'])
    }

    if (search) {
      query = query.or(
        `app_id.ilike.%${search}%,customer_name.ilike.%${search}%,lead_number.ilike.%${search}%,bank_name.ilike.%${search}%,partner_code.ilike.%${search}%`
      )
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: applications, error, count } = await query

    if (error) {
      logger.error('Error fetching partner payout applications for SA:', { error })
      return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Enrich with partner names
    const partnerIds = [...new Set((applications || []).map(a => a.partner_id).filter(Boolean))]
    let partnerMap: Record<string, string> = {}

    if (partnerIds.length > 0) {
      const { data: partners } = await supabase
        .from('partners')
        .select('id, full_name, partner_id')
        .in('id', partnerIds)

      if (partners) {
        partnerMap = Object.fromEntries(partners.map(p => [p.id, p.full_name || p.partner_id || 'Partner']))
      }
    }

    // Enrich with accounts verifier names
    const verifierIds = [...new Set((applications || []).map(a => a.accounts_verified_by).filter(Boolean))]
    let verifierMap: Record<string, string> = {}

    if (verifierIds.length > 0) {
      const { data: verifiers } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', verifierIds)

      if (verifiers) {
        verifierMap = Object.fromEntries(verifiers.map(v => [v.id, v.full_name || 'Unknown']))
      }
    }

    const enrichedApplications = (applications || []).map(app => ({
      ...app,
      partner_name: partnerMap[app.partner_id] || 'Partner',
      accounts_verifier_name: app.accounts_verified_by ? verifierMap[app.accounts_verified_by] || 'Unknown' : null,
    }))

    // Stats
    const today = new Date().toISOString().split('T')[0]
    const [pendingResult, approvedTodayResult, approvedAmountResult] = await Promise.all([
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('status', 'SA_APPROVED')
        .gte('sa_approved_at', `${today}T00:00:00`),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('status', 'SA_APPROVED')
        .gte('sa_approved_at', `${today}T00:00:00`),
    ])

    const totalApprovedAmount = approvedAmountResult.data?.reduce(
      (sum, app) => sum + (app.expected_commission_amount || 0), 0
    ) || 0

    return NextResponse.json({
      success: true,
      applications: enrichedApplications,
      stats: {
        pending_approval: pendingResult.count || 0,
        approved_today: approvedTodayResult.count || 0,
        total_approved_amount: totalApprovedAmount,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Error in partner payout approval API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      applicationId: z.string().uuid().optional(),

      applicationIds: z.string().optional(),

      action: z.string().optional(),

      notes: z.string().optional(),

      reason: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { applicationId, applicationIds, action, notes, reason } = body

    // Support both single and bulk operations
    const idsToProcess: string[] = applicationIds || (applicationId ? [applicationId] : [])

    if (idsToProcess.length === 0 || !action) {
      return NextResponse.json({ success: false, error: 'Application ID(s) and action are required' }, { status: 400 })
    }

    if (idsToProcess.length > 50) {
      return NextResponse.json({ success: false, error: 'Maximum 50 applications per bulk operation' }, { status: 400 })
    }

    const validActions = ['approve', 'reject', 'hold']
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json({ success: false, error: 'Reason is required for rejection' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || userData.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    let newStatus: string
    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'approve':
        newStatus = 'SA_APPROVED'
        updateData = {
          sa_approved_by: user.id,
          sa_approved_at: new Date().toISOString(),
          sa_approval_notes: notes || null,
        }
        break
      case 'reject':
        newStatus = 'REJECTED'
        updateData = { status_reason: reason }
        break
      case 'hold':
        newStatus = 'ON_HOLD'
        updateData = { status_reason: reason || notes || null }
        break
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    // Get all applications (include partner details for notifications)
    const { data: apps, error: appsError } = await supabase
      .from('partner_payout_applications')
      .select('id, app_id, partner_type, status, partner_user_id, partner_id, partner_code, customer_name, lead_number, bank_name, loan_type, disbursed_amount, expected_commission_amount, is_team_override')
      .in('id', idsToProcess)
      .eq('status', 'ACCOUNTS_VERIFIED')

    if (appsError) {
      logger.error('Error fetching applications for bulk action:', { error: appsError })
      return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({ success: false, error: 'No eligible applications found (must be ACCOUNTS_VERIFIED)' }, { status: 404 })
    }

    const eligibleIds = apps.map(a => a.id)

    // Bulk update
    const { error: updateError } = await supabase
      .from('partner_payout_applications')
      .update({ status: newStatus, ...updateData })
      .in('id', eligibleIds)
      .eq('status', 'ACCOUNTS_VERIFIED')

    if (updateError) {
      logger.error('Error bulk updating partner payout applications:', { error: updateError })
      return NextResponse.json({ success: false, error: 'Failed to update applications' }, { status: 500 })
    }

    // Record status history for each
    const historyRecords = apps.map(app => ({
      application_id: app.id,
      app_id: app.app_id,
      partner_type: app.partner_type,
      previous_status: 'ACCOUNTS_VERIFIED',
      new_status: newStatus,
      status_reason: reason || null,
      changed_by: user.id,
      changed_by_name: userData.full_name,
      changed_by_role: 'SUPER_ADMIN',
      notes: notes || `Bulk ${action} by ${userData.full_name} (${apps.length} applications)`,
    }))

    await supabase.from('partner_payout_status_history').insert(historyRecords)

    // Send notifications to partners (non-blocking)
    const partnerUserIds = [...new Set(apps.map(a => a.partner_user_id).filter(Boolean))]
    if (partnerUserIds.length > 0) {
      const { data: partnerInfos } = await supabase
        .from('partners')
        .select('id, user_id, full_name, email, phone, partner_id')
        .in('user_id', partnerUserIds)

      const partnerMap = new Map(partnerInfos?.map(p => [p.user_id, p]) || [])

      for (const app of apps) {
        const partner = partnerMap.get(app.partner_user_id)
        if (partner) {
          notifyPartnerPayoutStatusChange({
            applicationId: app.id,
            appId: app.app_id,
            partnerType: app.partner_type as 'BA' | 'BP',
            partnerUserId: app.partner_user_id,
            partnerName: partner.full_name || 'Partner',
            partnerEmail: partner.email || '',
            partnerPhone: partner.phone,
            partnerCode: partner.partner_id || app.partner_code || '',
            customerName: app.customer_name || '',
            leadNumber: app.lead_number || '',
            bankName: app.bank_name || '',
            loanType: app.loan_type || '',
            disbursedAmount: app.disbursed_amount || 0,
            expectedCommissionAmount: app.expected_commission_amount || 0,
            status: newStatus as 'SA_APPROVED' | 'REJECTED' | 'ON_HOLD',
            isTeamOverride: app.is_team_override || false,
            changedByName: userData.full_name,
            changedByRole: 'SUPER_ADMIN',
            reason: reason || undefined,
            notes: notes || undefined,
          }, 'ACCOUNTS_VERIFIED').catch(err => {
            logger.error('Failed to send SA payout notification:', { error: err, applicationId: app.id })
          })
        }
      }
    }

    // Notify Finance team when applications are approved (non-blocking)
    if (action === 'approve' && apps.length > 0) {
      supabase.from('users').select('id, full_name, email')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'])
        .then(({ data: financeTeam }) => {
          if (financeTeam && financeTeam.length > 0) {
            // Notify for each approved app
            for (const app of apps) {
              notifyPartnerPayoutInternalTeam(
                financeTeam.map(u => ({ userId: u.id, name: u.full_name || '', email: u.email || '', role: 'FINANCE_EXECUTIVE' })),
                {
                  applicationId: app.id,
                  appId: app.app_id,
                  partnerType: app.partner_type as 'BA' | 'BP',
                  partnerUserId: app.partner_user_id || '',
                  partnerName: '',
                  partnerEmail: '',
                  partnerCode: app.partner_code || '',
                  customerName: app.customer_name || '',
                  leadNumber: app.lead_number || '',
                  bankName: app.bank_name || '',
                  loanType: app.loan_type || '',
                  disbursedAmount: app.disbursed_amount || 0,
                  expectedCommissionAmount: app.expected_commission_amount || 0,
                  status: 'SA_APPROVED',
                },
                'payment_needed'
              ).catch(err => logger.error('Failed to notify finance team:', { error: err }))
            }
          }
        })
    }

    const actionMessages: Record<string, string> = {
      approve: 'Application(s) approved and forwarded to Finance',
      reject: 'Application(s) rejected',
      hold: 'Application(s) placed on hold',
    }

    return NextResponse.json({
      success: true,
      message: actionMessages[action],
      processed: apps.length,
      skipped: idsToProcess.length - apps.length,
    })
  } catch (error) {
    logger.error('Error updating partner payout application:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
