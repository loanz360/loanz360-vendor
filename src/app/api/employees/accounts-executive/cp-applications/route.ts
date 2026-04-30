import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { notifyStatusChange, type CPPayoutStatus } from '@/lib/notifications/cp-payout-notifications'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/** Sanitize search input - strip PostgREST operators and special chars */
const sanitizeSearch = (input: string): string => {
  return input.replace(/[().,;'"\\%_]/g, '').trim().substring(0, 100)
}

/**
 * GET /api/employees/accounts-executive/cp-applications
 * Get CP applications for verification by Accounts Executive
 * Supports mode=history&applicationId=xxx for status history
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is Accounts Executive/Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only Accounts team can access this resource.' },
        { status: 403 }
      )
    }

    // Mode: history - return status history for a specific application
    const mode = searchParams.get('mode')
    if (mode === 'history') {
      const applicationId = searchParams.get('applicationId')
      if (!applicationId) {
        return NextResponse.json({ success: false, error: 'applicationId is required for history mode' }, { status: 400 })
      }

      const { data: history, error: historyError } = await supabase
        .from('cp_application_status_history')
        .select('id, application_id, previous_status, new_status, changed_by, changed_by_name, changed_by_role, notes, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })

      if (historyError) {
        logger.error('Error fetching CP application history:', { error: historyError })
        return NextResponse.json({ success: false, error: 'Failed to fetch status history' }, { status: 500 })
      }

      return NextResponse.json({ success: true, history: history || [] })
    }

    // Default mode: list applications
    const status = searchParams.get('status') || 'PENDING'
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    // Build query with exact count for pagination
    let query = supabase
      .from('cp_applications')
      .select(`
        id,
        app_id,
        cp_user_id,
        cp_partner_id,
        application_number,
        customer_name,
        customer_mobile,
        customer_email,
        loan_amount_disbursed,
        bank_name,
        loan_type,
        disbursement_date,
        expected_payout_percentage,
        expected_payout_amount,
        notes,
        supporting_document_url,
        status,
        status_reason,
        created_at,
        updated_at,
        cp_user:users!cp_applications_cp_user_id_fkey (
          id,
          full_name,
          email,
          phone_number
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Filter by status
    if (status !== 'ALL') {
      if (status === 'PENDING') {
        query = query.in('status', ['PENDING', 'UNDER_REVIEW'])
      } else {
        query = query.eq('status', status)
      }
    } else {
      // For ALL, show all relevant statuses for Accounts
      query = query.in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'REJECTED', 'ON_HOLD', 'UNDER_REVIEW'])
    }

    // Apply search filter via ilike where possible
    if (search) {
      const sanitized = sanitizeSearch(search)
      if (sanitized.length > 0) {
        query = query.or(
          `app_id.ilike.%${sanitized}%,application_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%,bank_name.ilike.%${sanitized}%`
        )
      }
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: applications, error: appError, count: totalCount } = await query

    if (appError) {
      logger.error('Error fetching applications:', { error: appError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Calculate stats using efficient count queries
    const today = new Date().toISOString().split('T')[0]

    const [pendingResult, verificationResult, verifiedTodayResult, rejectedTodayResult, pendingAmountResult, saApprovedResult, financeProcessingResult] = await Promise.all([
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .in('status', ['PENDING', 'UNDER_REVIEW']),
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFICATION'),
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ACCOUNTS_VERIFIED')
        .gte('accounts_verified_at', `${today}T00:00:00`)
        .lt('accounts_verified_at', `${today}T23:59:59.999`),
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'REJECTED')
        .gte('reviewed_at', `${today}T00:00:00`)
        .lt('reviewed_at', `${today}T23:59:59.999`),
      supabase
        .from('cp_applications')
        .select('expected_payout_amount')
        .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']),
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SA_APPROVED'),
      supabase
        .from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'FINANCE_PROCESSING'),
    ])

    const totalPendingAmount = pendingAmountResult.data?.reduce(
      (sum, app) => sum + (app.expected_payout_amount || 0), 0
    ) || 0

    const stats = {
      total_pending: pendingResult.count || 0,
      total_in_verification: verificationResult.count || 0,
      verified_today: verifiedTodayResult.count || 0,
      rejected_today: rejectedTodayResult.count || 0,
      total_pending_amount: totalPendingAmount,
      sa_approved: saApprovedResult.count || 0,
      finance_processing: financeProcessingResult.count || 0,
    }

    const total = totalCount || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      applications: applications || [],
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    logger.error('Error in accounts CP applications API:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/accounts-executive/cp-applications
 * Update CP application status (pickup, verify, reject, hold, resume)
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      applicationId: z.string().uuid(),

      action: z.string().optional(),

      notes: z.string().optional(),

      reason: z.string(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { applicationId, action, notes, reason } = body

    if (!applicationId || !action) {
      return NextResponse.json(
        { success: false, error: 'Application ID and action are required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is Accounts Executive/Manager
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get current application with CP user details for notifications
    const { data: application, error: appError } = await supabase
      .from('cp_applications')
      .select(`
        id,
        app_id,
        status,
        cp_user_id,
        customer_name,
        application_number,
        bank_name,
        loan_type,
        loan_amount_disbursed,
        expected_payout_amount,
        cp_user:users!cp_applications_cp_user_id_fkey (
          id,
          full_name,
          email,
          phone_number
        )
      `)
      .eq('id', applicationId)
      .maybeSingle()

    if (appError || !application) {
      return NextResponse.json(
        { success: false, error: 'Application not found' },
        { status: 404 }
      )
    }

    let updateData: Record<string, unknown> = {}
    let newStatus: string
    let duplicates: unknown[] | null = null

    switch (action) {
      case 'pickup':
        if (!['PENDING', 'UNDER_REVIEW'].includes(application.status)) {
          return NextResponse.json(
            { success: false, error: 'Application cannot be picked up in current status' },
            { status: 400 }
          )
        }
        newStatus = 'ACCOUNTS_VERIFICATION'
        updateData = {
          status: newStatus,
        }

        // Initialize verification checklist
        await supabase.rpc('initialize_cp_verification_checklist', {
          p_application_id: applicationId,
          p_app_id: application.app_id,
          p_stage: 'ACCOUNTS'
        })
        break

      case 'verify':
        if (application.status !== 'ACCOUNTS_VERIFICATION') {
          return NextResponse.json(
            { success: false, error: 'Application must be in verification status' },
            { status: 400 }
          )
        }

        // Verify all checklist items are checked before allowing verification
        const { data: checklistItems, error: checklistFetchError } = await supabase
          .from('cp_application_verification')
          .select('id, is_verified')
          .eq('application_id', applicationId)
          .eq('verification_stage', 'ACCOUNTS')

        if (checklistFetchError) {
          logger.error('Error fetching checklist for validation:', { error: checklistFetchError })
          return NextResponse.json(
            { success: false, error: 'Failed to validate verification checklist' },
            { status: 500 }
          )
        }

        if (!checklistItems || checklistItems.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Verification checklist not found. Please pick up the application first.' },
            { status: 400 }
          )
        }

        const uncheckedItems = checklistItems.filter(item => !item.is_verified)
        if (uncheckedItems.length > 0) {
          return NextResponse.json(
            { success: false, error: `All verification checklist items must be completed. ${uncheckedItems.length} item(s) remaining.` },
            { status: 400 }
          )
        }

        // Check for potential duplicates
        const { data: cpDuplicates } = await supabase
          .from('cp_applications')
          .select('id, app_id, status, customer_name, bank_name')
          .neq('id', applicationId)
          .eq('customer_name', application.customer_name)
          .eq('bank_name', application.bank_name)
          .in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED'])
          .limit(5)

        if (cpDuplicates && cpDuplicates.length > 0) {
          duplicates = cpDuplicates
        }

        newStatus = 'ACCOUNTS_VERIFIED'
        updateData = {
          status: newStatus,
          accounts_verified_by: user.id,
          accounts_verified_at: new Date().toISOString(),
          accounts_verification_notes: notes || null,
        }
        break

      case 'reject':
        if (!['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION'].includes(application.status)) {
          return NextResponse.json(
            { success: false, error: 'Application cannot be rejected in current status' },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'Rejection reason is required' },
            { status: 400 }
          )
        }
        newStatus = 'REJECTED'
        updateData = {
          status: newStatus,
          status_reason: reason,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        }
        break

      case 'hold':
        if (!['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION'].includes(application.status)) {
          return NextResponse.json(
            { success: false, error: 'Application cannot be put on hold in current status' },
            { status: 400 }
          )
        }
        if (!reason) {
          return NextResponse.json(
            { success: false, error: 'Hold reason is required' },
            { status: 400 }
          )
        }
        newStatus = 'ON_HOLD'
        updateData = {
          status: newStatus,
          status_reason: reason,
        }
        break

      case 'resume':
        if (application.status !== 'ON_HOLD') {
          return NextResponse.json(
            { success: false, error: 'Can only resume ON_HOLD applications' },
            { status: 400 }
          )
        }
        newStatus = 'PENDING'
        updateData = {
          status: newStatus,
          status_reason: null,
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Update application with optimistic locking (verify current status hasn't changed)
    const { data: updatedRows, error: updateError } = await supabase
      .from('cp_applications')
      .update(updateData)
      .eq('id', applicationId)
      .eq('status', application.status)
      .select('id')

    if (updateError) {
      logger.error('Error updating application:', { error: updateError })
      return NextResponse.json(
        { success: false, error: 'Failed to update application' },
        { status: 500 }
      )
    }

    // If no rows were updated, another user changed the status (race condition)
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Application status has changed. Please refresh and try again.' },
        { status: 409 }
      )
    }

    // Record status history
    const previousStatus = application.status
    const { error: historyError } = await supabase
      .from('cp_application_status_history')
      .insert({
        application_id: applicationId,
        previous_status: previousStatus,
        new_status: newStatus,
        changed_by: user.id,
        changed_by_name: userData.full_name,
        changed_by_role: userData.sub_role || 'ACCOUNTS_EXECUTIVE',
        notes: action === 'verify'
          ? notes || 'Verified by Accounts'
          : action === 'reject' || action === 'hold'
            ? reason
            : action === 'resume'
              ? 'Resumed from hold'
              : 'Picked up for verification',
      })

    if (historyError) {
      logger.warn('Failed to record status history:', { error: historyError })
    }

    // Send notifications to CP
    const cpUser = application.cp_user as unknown
    if (cpUser) {
      try {
        await notifyStatusChange(
          {
            applicationId: application.id,
            appId: application.app_id || '',
            cpUserId: application.cp_user_id,
            cpName: cpUser.full_name || 'Partner',
            cpEmail: cpUser.email || '',
            cpPhone: cpUser.phone_number,
            customerName: application.customer_name,
            applicationNumber: application.application_number,
            bankName: application.bank_name,
            loanType: application.loan_type,
            loanAmount: application.loan_amount_disbursed,
            expectedPayoutAmount: application.expected_payout_amount,
            status: newStatus as CPPayoutStatus,
            changedByName: userData.full_name,
            changedByRole: userData.sub_role || 'ACCOUNTS_EXECUTIVE',
            reason: action === 'reject' || action === 'hold' ? reason : undefined,
            notes: notes,
          },
          previousStatus as CPPayoutStatus
        )
      } catch (notifyError) {
        logger.warn('Failed to send CP payout notification:', {
          error: notifyError,
          applicationId: application.id,
          appId: application.app_id,
          newStatus,
          cpUserId: application.cp_user_id,
          action,
        })
      }
    }

    // Auto-create support ticket for CP partner on rejection
    if (action === 'reject' && application.cp_user_id) {
      try {
        await supabase.from('partner_support_tickets').insert({
          partner_id: application.cp_user_id,
          ticket_number: `AUTO-${Date.now()}`,
          subject: `Payout Application ${application.app_id} Rejected`,
          description: `Your CP payout application ${application.app_id} for ${application.customer_name || 'N/A'} (${application.bank_name || 'N/A'}) has been rejected.\n\nReason: ${reason}\n\nPlease review and resubmit if applicable, or reply to this ticket for clarification.`,
          category: 'payout_issue',
          priority: 'high',
          status: 'open',
          routed_to_department: 'accounts',
          payout_application_id: application.id,
          payout_application_type: 'CP',
          payout_app_id: application.app_id,
        })
      } catch (ticketErr) {
        logger.error('Failed to auto-create CP rejection ticket:', { error: ticketErr, applicationId: application.id })
      }
    }

    const actionMessages: Record<string, string> = {
      pickup: 'Application picked up for verification',
      verify: 'Application verified and forwarded to Super Admin',
      reject: 'Application rejected',
      hold: 'Application put on hold',
      resume: 'Application resumed from hold',
    }

    const response: Record<string, unknown> = {
      success: true,
      message: actionMessages[action] || 'Action completed',
    }

    if (duplicates && duplicates.length > 0) {
      response.duplicates = duplicates
      response.duplicate_warning = `Found ${duplicates.length} potential duplicate application(s) for the same customer and bank.`
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error updating CP application:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
