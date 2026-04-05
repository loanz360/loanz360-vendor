/**
 * Accounts Executive - BA Applications API
 * Manages BA payout application verification workflow
 *
 * GET: List BA payout applications pending verification
 *      Supports mode=history&applicationId=xxx for status history
 * PUT: Process applications (pick_up, verify, reject, hold, resume)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyPartnerPayoutStatusChange, notifyPartnerPayoutInternalTeam } from '@/lib/notifications/partner-payout-notifications'

export const dynamic = 'force-dynamic'

/** Sanitize search input - strip PostgREST operators and special chars */
const sanitizeSearch = (input: string): string => {
  return input.replace(/[().,;'"\\%_]/g, '').trim().substring(0, 100)
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify Accounts or Super Admin
    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const isAllowed = userData.role === 'SUPER_ADMIN' ||
      (userData.role === 'EMPLOYEE' && ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'].includes(userData.sub_role))

    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Accounts team can access this resource.' }, { status: 403 })
    }

    // Mode: history - return status history for a specific application
    const mode = searchParams.get('mode')
    if (mode === 'history') {
      const applicationId = searchParams.get('applicationId')
      if (!applicationId) {
        return NextResponse.json({ success: false, error: 'applicationId is required for history mode' }, { status: 400 })
      }

      const { data: history, error: historyError } = await supabase
        .from('partner_payout_status_history')
        .select('id, application_id, app_id, partner_type, previous_status, new_status, status_reason, changed_by, changed_by_name, changed_by_role, changed_by_sub_role, notes, created_at')
        .eq('application_id', applicationId)
        .eq('partner_type', 'BA')
        .order('created_at', { ascending: false })

      if (historyError) {
        logger.error('Error fetching BA application history:', { error: historyError })
        return NextResponse.json({ success: false, error: 'Failed to fetch status history' }, { status: 500 })
      }

      return NextResponse.json({ success: true, history: history || [] })
    }

    // Default mode: list applications
    const status = searchParams.get('status') || 'PENDING'
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Query partner_payout_applications for BA
    let query = supabase
      .from('partner_payout_applications')
      .select('*', { count: 'exact' })
      .eq('partner_type', 'BA')
      .eq('is_team_override', false)
      .order('created_at', { ascending: false })

    if (status !== 'ALL') {
      query = query.eq('status', status)
    }

    if (search) {
      const sanitized = sanitizeSearch(search)
      if (sanitized.length > 0) {
        query = query.or(
          `app_id.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%,lead_number.ilike.%${sanitized}%,bank_name.ilike.%${sanitized}%,partner_code.ilike.%${sanitized}%`
        )
      }
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: applications, error, count } = await query

    if (error) {
      logger.error('Error fetching BA payout applications:', { error })
      return NextResponse.json({ success: false, error: 'Failed to fetch BA applications' }, { status: 500 })
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
        partnerMap = Object.fromEntries(partners.map(p => [p.id, p.full_name || p.partner_id || 'BA Partner']))
      }
    }

    const enrichedApplications = (applications || []).map(app => ({
      ...app,
      partner_name: partnerMap[app.partner_id] || 'BA Partner',
    }))

    // Stats
    const today = new Date().toISOString().split('T')[0]
    const [pendingResult, inVerificationResult, verifiedTodayResult, pendingAmountResult, saApprovedResult, financeProcessingResult] = await Promise.all([
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('is_team_override', false).eq('status', 'PENDING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('is_team_override', false).eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('is_team_override', false).eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', `${today}T00:00:00`),
      supabase.from('partner_payout_applications').select('expected_commission_amount')
        .eq('partner_type', 'BA').eq('is_team_override', false)
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION']),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('is_team_override', false).eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_type', 'BA').eq('is_team_override', false).eq('status', 'FINANCE_PROCESSING'),
    ])

    const totalPendingAmount = pendingAmountResult.data?.reduce(
      (sum, app) => sum + (app.expected_commission_amount || 0), 0
    ) || 0

    return NextResponse.json({
      success: true,
      applications: enrichedApplications,
      stats: {
        pending_count: pendingResult.count || 0,
        in_verification: inVerificationResult.count || 0,
        verified_today: verifiedTodayResult.count || 0,
        total_pending_amount: totalPendingAmount,
        sa_approved: saApprovedResult.count || 0,
        finance_processing: financeProcessingResult.count || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Error in BA applications API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()
    const { applicationId, action, notes, reason } = body

    if (!applicationId || !action) {
      return NextResponse.json({ success: false, error: 'Application ID and action are required' }, { status: 400 })
    }

    const validActions = ['pick_up', 'verify', 'reject', 'hold', 'resume']
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, { status: 400 })
    }

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
      (userData.role === 'EMPLOYEE' && ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'].includes(userData.sub_role))

    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Get current application
    const { data: app, error: appError } = await supabase
      .from('partner_payout_applications')
      .select('*')
      .eq('id', applicationId)
      .eq('partner_type', 'BA')
      .maybeSingle()

    if (appError || !app) {
      return NextResponse.json({ success: false, error: 'BA payout application not found' }, { status: 404 })
    }

    let newStatus: string
    let updateData: Record<string, unknown> = {}
    let duplicates: unknown[] | null = null

    switch (action) {
      case 'pick_up':
        if (app.status !== 'PENDING') {
          return NextResponse.json({
            success: false,
            error: `Application status has changed to ${app.status}. Please refresh and try again.`,
          }, { status: 409 })
        }
        newStatus = 'ACCOUNTS_VERIFICATION'
        break

      case 'verify':
        if (app.status !== 'ACCOUNTS_VERIFICATION') {
          return NextResponse.json({
            success: false,
            error: `Application status has changed to ${app.status}. Please refresh and try again.`,
          }, { status: 409 })
        }

        // BLOCK if bank sheet not matched
        if (!app.bank_sheet_matched) {
          return NextResponse.json({
            success: false,
            error: 'Bank payout sheet match is required before verification. Please match this application with a bank sheet entry first.',
          }, { status: 400 })
        }

        // Check for potential duplicates
        const { data: baDuplicates } = await supabase
          .from('partner_payout_applications')
          .select('id, app_id, partner_type, partner_name, status')
          .neq('id', applicationId)
          .eq('customer_name', app.customer_name)
          .eq('bank_name', app.bank_name)
          .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED'])
          .limit(5)

        if (baDuplicates && baDuplicates.length > 0) {
          duplicates = baDuplicates
        }

        updateData = {
          accounts_verified_by: user.id,
          accounts_verified_at: new Date().toISOString(),
          accounts_verification_notes: notes || null,
        }
        newStatus = 'ACCOUNTS_VERIFIED'
        break

      case 'reject':
        if (!['PENDING', 'ACCOUNTS_VERIFICATION'].includes(app.status)) {
          return NextResponse.json({ success: false, error: 'Can only reject PENDING or ACCOUNTS_VERIFICATION applications' }, { status: 400 })
        }
        if (!reason) {
          return NextResponse.json({ success: false, error: 'Reason is required for rejection' }, { status: 400 })
        }
        newStatus = 'REJECTED'
        updateData = { status_reason: reason }
        break

      case 'hold':
        if (!['PENDING', 'ACCOUNTS_VERIFICATION'].includes(app.status)) {
          return NextResponse.json({ success: false, error: 'Can only hold PENDING or ACCOUNTS_VERIFICATION applications' }, { status: 400 })
        }
        if (!reason) {
          return NextResponse.json({ success: false, error: 'Reason is required for hold' }, { status: 400 })
        }
        newStatus = 'ON_HOLD'
        updateData = { status_reason: reason }
        break

      case 'resume':
        if (app.status !== 'ON_HOLD') {
          return NextResponse.json({ success: false, error: 'Can only resume ON_HOLD applications' }, { status: 400 })
        }
        newStatus = 'PENDING'
        updateData = { status_reason: null }
        break

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    // Update application with optimistic lock and row count check
    const { data: updatedRows, error: updateError } = await supabase
      .from('partner_payout_applications')
      .update({
        status: newStatus,
        ...updateData,
      })
      .eq('id', applicationId)
      .eq('status', app.status) // Optimistic lock
      .select('id')

    if (updateError) {
      logger.error('Error updating BA application:', { error: updateError })
      return NextResponse.json({ success: false, error: 'Failed to update application' }, { status: 500 })
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Application status has changed. Please refresh.' }, { status: 409 })
    }

    // Record status history
    await supabase.from('partner_payout_status_history').insert({
      application_id: applicationId,
      app_id: app.app_id,
      partner_type: 'BA',
      previous_status: app.status,
      new_status: newStatus,
      status_reason: reason || null,
      changed_by: user.id,
      changed_by_name: userData.full_name,
      changed_by_role: userData.role,
      changed_by_sub_role: userData.sub_role,
      notes: notes || `${action} by ${userData.full_name}`,
    })

    // Send partner notification (non-blocking)
    if (app.partner_user_id) {
      const { data: partnerInfo } = await supabase
        .from('partners')
        .select('full_name, email, phone, partner_id')
        .eq('user_id', app.partner_user_id)
        .maybeSingle()

      if (partnerInfo) {
        notifyPartnerPayoutStatusChange({
          applicationId,
          appId: app.app_id,
          partnerType: 'BA',
          partnerUserId: app.partner_user_id,
          partnerName: partnerInfo.full_name || 'Partner',
          partnerEmail: partnerInfo.email || '',
          partnerPhone: partnerInfo.phone,
          partnerCode: partnerInfo.partner_id || app.partner_code || '',
          customerName: app.customer_name || '',
          leadNumber: app.lead_number || '',
          bankName: app.bank_name || '',
          loanType: app.loan_type || '',
          disbursedAmount: app.disbursed_amount || 0,
          expectedCommissionAmount: app.expected_commission_amount || 0,
          status: newStatus as 'ACCOUNTS_VERIFICATION' | 'ACCOUNTS_VERIFIED' | 'REJECTED' | 'ON_HOLD',
          changedByName: userData.full_name,
          changedByRole: userData.sub_role,
          reason: reason || undefined,
          notes: notes || undefined,
        }, app.status).catch(err => {
          logger.error('Failed to send BA payout notification:', { error: err, applicationId })
        })
      }
    }

    // Notify SA when application is verified (non-blocking)
    if (action === 'verify') {
      supabase.from('users').select('id, full_name, email')
        .eq('role', 'SUPER_ADMIN')
        .then(({ data: saUsers }) => {
          if (saUsers && saUsers.length > 0) {
            notifyPartnerPayoutInternalTeam(
              saUsers.map(u => ({ userId: u.id, name: u.full_name || '', email: u.email || '', role: 'SUPER_ADMIN' })),
              {
                applicationId,
                appId: app.app_id,
                partnerType: 'BA',
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
                status: 'ACCOUNTS_VERIFIED',
              },
              'verification_complete'
            ).catch(err => logger.error('Failed to notify SA:', { error: err }))
          }
        })
    }

    // Cascade status to linked BP team override (if exists)
    if (action === 'verify' || action === 'reject' || action === 'hold' || action === 'resume') {
      const { data: linkedBPApp } = await supabase
        .from('partner_payout_applications')
        .select('id, app_id, status')
        .eq('linked_application_id', applicationId)
        .eq('is_team_override', true)
        .maybeSingle()

      if (linkedBPApp) {
        if (action === 'verify' && linkedBPApp.status === app.status) {
          // Advance the linked BP override to the same verified status
          await supabase
            .from('partner_payout_applications')
            .update({
              status: newStatus,
              accounts_verified_by: user.id,
              accounts_verified_at: new Date().toISOString(),
              accounts_verification_notes: notes || 'Auto-verified with linked BA application',
              bank_sheet_matched: app.bank_sheet_matched,
              bank_confirmed_amount: app.bank_confirmed_amount,
            })
            .eq('id', linkedBPApp.id)

          await supabase.from('partner_payout_status_history').insert({
            application_id: linkedBPApp.id,
            app_id: linkedBPApp.app_id,
            partner_type: 'BP',
            previous_status: linkedBPApp.status,
            new_status: newStatus,
            changed_by: user.id,
            changed_by_name: userData.full_name,
            changed_by_role: userData.role,
            changed_by_sub_role: userData.sub_role,
            notes: `Auto-advanced with linked BA application ${app.app_id}`,
          })
        } else if (action === 'reject' && !['REJECTED', 'PAYOUT_CREDITED'].includes(linkedBPApp.status)) {
          // Cascade rejection: put linked BP on hold with reason
          await supabase
            .from('partner_payout_applications')
            .update({
              status: 'ON_HOLD',
              status_reason: `Linked BA application ${app.app_id} was rejected: ${reason || 'No reason provided'}`,
            })
            .eq('id', linkedBPApp.id)

          await supabase.from('partner_payout_status_history').insert({
            application_id: linkedBPApp.id,
            app_id: linkedBPApp.app_id,
            partner_type: 'BP',
            previous_status: linkedBPApp.status,
            new_status: 'ON_HOLD',
            status_reason: `Linked BA application rejected`,
            changed_by: user.id,
            changed_by_name: userData.full_name,
            changed_by_role: userData.role,
            changed_by_sub_role: userData.sub_role,
            notes: `Auto-held: linked BA application ${app.app_id} was rejected`,
          })
        } else if (action === 'hold' && !['ON_HOLD', 'REJECTED', 'PAYOUT_CREDITED'].includes(linkedBPApp.status)) {
          // Cascade hold
          await supabase
            .from('partner_payout_applications')
            .update({
              status: 'ON_HOLD',
              status_reason: `Linked BA application ${app.app_id} was put on hold: ${reason || 'No reason provided'}`,
            })
            .eq('id', linkedBPApp.id)

          await supabase.from('partner_payout_status_history').insert({
            application_id: linkedBPApp.id,
            app_id: linkedBPApp.app_id,
            partner_type: 'BP',
            previous_status: linkedBPApp.status,
            new_status: 'ON_HOLD',
            status_reason: `Linked BA application put on hold`,
            changed_by: user.id,
            changed_by_name: userData.full_name,
            changed_by_role: userData.role,
            changed_by_sub_role: userData.sub_role,
            notes: `Auto-held: linked BA application ${app.app_id} was put on hold`,
          })
        } else if (action === 'resume' && linkedBPApp.status === 'ON_HOLD') {
          // Cascade resume
          await supabase
            .from('partner_payout_applications')
            .update({
              status: 'PENDING',
              status_reason: null,
            })
            .eq('id', linkedBPApp.id)

          await supabase.from('partner_payout_status_history').insert({
            application_id: linkedBPApp.id,
            app_id: linkedBPApp.app_id,
            partner_type: 'BP',
            previous_status: linkedBPApp.status,
            new_status: 'PENDING',
            changed_by: user.id,
            changed_by_name: userData.full_name,
            changed_by_role: userData.role,
            changed_by_sub_role: userData.sub_role,
            notes: `Auto-resumed: linked BA application ${app.app_id} was resumed`,
          })
        }
      }
    }

    // Auto-create support ticket for partner on rejection
    if (action === 'reject' && app.partner_user_id) {
      try {
        await supabase.from('partner_support_tickets').insert({
          partner_id: app.partner_user_id,
          ticket_number: `AUTO-${Date.now()}`,
          subject: `Payout Application ${app.app_id} Rejected`,
          description: `Your payout application ${app.app_id} for ${app.customer_name || 'N/A'} (${app.bank_name || 'N/A'}) has been rejected.\n\nReason: ${reason}\n\nPlease review and resubmit if applicable, or reply to this ticket for clarification.`,
          category: 'payout_issue',
          priority: 'high',
          status: 'open',
          routed_to_department: 'accounts',
          payout_application_id: applicationId,
          payout_application_type: 'BA',
          payout_app_id: app.app_id,
        })
      } catch (ticketErr) {
        logger.error('Failed to auto-create rejection ticket:', { error: ticketErr, applicationId })
      }
    }

    const actionMessages: Record<string, string> = {
      pick_up: 'Application picked up for verification',
      verify: 'Application verified successfully',
      reject: 'Application rejected',
      hold: 'Application placed on hold',
      resume: 'Application resumed from hold',
    }

    const response: Record<string, unknown> = {
      success: true,
      message: actionMessages[action],
    }

    if (duplicates && duplicates.length > 0) {
      response.duplicates = duplicates
      response.duplicate_warning = `Found ${duplicates.length} potential duplicate application(s) for the same customer and bank.`
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error updating BA application:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
