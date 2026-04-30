import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { notifyStatusChange, type CPPayoutStatus } from '@/lib/notifications/cp-payout-notifications'
import { notifyPartnerPayoutStatusChange } from '@/lib/notifications/partner-payout-notifications'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * GET /api/employees/finance-executive/cp-payouts
 * Get applications ready for payout processing
 * Supports CP, BA/BP, and all types via ?type= param
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'SA_APPROVED'
    const search = searchParams.get('search')
    const type = searchParams.get('type') || 'all' // 'cp', 'ba_bp', 'all'

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

    const isFinanceTeam = userData.role === 'EMPLOYEE' && ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'].includes(userData.sub_role)
    const isSuperAdmin = userData.role === 'SUPER_ADMIN'

    if (!isFinanceTeam && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied. Only Finance team can access this resource.' }, { status: 403 })
    }

    const statusFilter = status === 'ALL'
      ? ['SA_APPROVED', 'FINANCE_PROCESSING', 'PAYOUT_CREDITED']
      : status === 'PENDING'
        ? ['SA_APPROVED', 'FINANCE_PROCESSING']
        : [status]

    // Fetch CP applications
    let cpApplications: any[] = []
    if (type === 'cp' || type === 'all') {
      let cpQuery = supabase
        .from('cp_applications')
        .select(`
          id, app_id, cp_user_id, cp_partner_id, application_number,
          customer_name, customer_mobile, customer_email,
          loan_amount_disbursed, bank_name, loan_type, disbursement_date,
          expected_payout_percentage, expected_payout_amount,
          notes, supporting_document_url, status, status_reason,
          sa_approved_by, sa_approved_at, sa_approval_notes,
          finance_processed_by, finance_processed_at,
          payment_transaction_id, payment_date, payment_amount,
          payment_mode, payment_notes, created_at, updated_at,
          cp_user:users!cp_applications_cp_user_id_fkey (id, full_name, email, phone_number),
          sa_approver:users!cp_applications_sa_approved_by_fkey (id, full_name, email)
        `)
        .in('status', statusFilter)
        .order('sa_approved_at', { ascending: true })

      const { data: cpData, error: cpError } = await cpQuery
      if (cpError) {
        logger.error('Error fetching CP applications for finance:', { error: cpError })
      } else {
        cpApplications = (cpData || []).map(app => ({
          ...app,
          _source: 'cp' as const,
          partner_type: 'CP',
          partner_name: (app.cp_user as any)?.full_name || 'CP Partner',
          disbursed_amount: app.loan_amount_disbursed,
          commission_percentage: app.expected_payout_percentage,
          expected_commission_amount: app.expected_payout_amount,
        }))
      }
    }

    // Fetch BA/BP partner payout applications
    let partnerApplications: any[] = []
    if (type === 'ba_bp' || type === 'all') {
      let partnerQuery = supabase
        .from('partner_payout_applications')
        .select('*', { count: 'exact' })
        .in('status', statusFilter)
        .order('sa_approved_at', { ascending: true, nullsFirst: false })

      const { data: partnerData, error: partnerError } = await partnerQuery
      if (partnerError) {
        logger.error('Error fetching partner payout applications for finance:', { error: partnerError })
      } else {
        // Enrich with partner names
        const partnerIds = [...new Set((partnerData || []).map(a => a.partner_id).filter(Boolean))]
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

        partnerApplications = (partnerData || []).map(app => ({
          ...app,
          _source: 'partner' as const,
          partner_name: partnerMap[app.partner_id] || 'Partner',
        }))
      }
    }

    // Combine and filter by search
    let allApplications = [...cpApplications, ...partnerApplications]

    if (search) {
      const searchLower = search.toLowerCase()
      allApplications = allApplications.filter(app => {
        const appId = (app.app_id || app.application_number || '').toLowerCase()
        const customer = (app.customer_name || '').toLowerCase()
        const bank = (app.bank_name || '').toLowerCase()
        const partner = (app.partner_name || '').toLowerCase()
        return appId.includes(searchLower) || customer.includes(searchLower) ||
               bank.includes(searchLower) || partner.includes(searchLower)
      })
    }

    // Stats — efficient COUNT queries instead of fetching all records
    const today = new Date().toISOString().split('T')[0]

    const [
      cpPending, cpProcessing, cpCreditedToday,
      partnerPending, partnerProcessing, partnerCreditedToday,
      cpPaidTodaySum, partnerPaidTodaySum,
    ] = await Promise.all([
      // CP counts
      supabase.from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SA_APPROVED'),
      supabase.from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'FINANCE_PROCESSING'),
      supabase.from('cp_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', `${today}T00:00:00`)
        .lt('finance_processed_at', `${today}T23:59:59.999`),
      // Partner counts
      supabase.from('partner_payout_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'FINANCE_PROCESSING'),
      supabase.from('partner_payout_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', `${today}T00:00:00`)
        .lt('finance_processed_at', `${today}T23:59:59.999`),
      // Today's paid amounts (only fetch amounts for today, not all records)
      supabase.from('cp_applications')
        .select('payment_amount, expected_payout_amount')
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', `${today}T00:00:00`)
        .lt('finance_processed_at', `${today}T23:59:59.999`),
      supabase.from('partner_payout_applications')
        .select('payment_amount, expected_commission_amount')
        .eq('status', 'PAYOUT_CREDITED')
        .gte('finance_processed_at', `${today}T00:00:00`)
        .lt('finance_processed_at', `${today}T23:59:59.999`),
    ])

    const cpPaidToday = (cpPaidTodaySum.data || []).reduce(
      (sum, a) => sum + (a.payment_amount || a.expected_payout_amount || 0), 0
    )
    const partnerPaidToday = (partnerPaidTodaySum.data || []).reduce(
      (sum, a) => sum + (a.payment_amount || a.expected_commission_amount || 0), 0
    )

    const stats = {
      pending_processing: (cpPending.count || 0) + (partnerPending.count || 0),
      in_processing: (cpProcessing.count || 0) + (partnerProcessing.count || 0),
      processed_today: (cpCreditedToday.count || 0) + (partnerCreditedToday.count || 0),
      total_paid_today: cpPaidToday + partnerPaidToday,
      cp_pending: cpPending.count || 0,
      ba_bp_pending: partnerPending.count || 0,
    }

    return NextResponse.json({
      success: true,
      applications: allApplications,
      stats,
    })
  } catch (error) {
    logger.error('Error in finance payouts API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/employees/finance-executive/cp-payouts
 * Process payout — auto-detects CP vs BA/BP application
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      applicationId,
      action,
      applicationType, // 'cp' or 'partner' — helps disambiguate
      transactionId,
      paymentDate,
      paymentAmount,
      paymentMode,
      paymentNotes,
      cpAccountNumber,
      cpIfscCode,
      cpBankName,
      cpAccountHolderName,
    } = body

    if (!applicationId || !action) {
      return NextResponse.json({ success: false, error: 'Application ID and action are required' }, { status: 400 })
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

    const isFinanceTeam = userData.role === 'EMPLOYEE' && ['FINANCE_EXECUTIVE', 'FINANCE_MANAGER'].includes(userData.sub_role)
    const isSuperAdmin = userData.role === 'SUPER_ADMIN'

    if (!isFinanceTeam && !isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Determine if this is a CP or partner application
    let isPartnerApp = applicationType === 'partner'

    if (!applicationType) {
      // Auto-detect: check partner_payout_applications first
      const { data: partnerApp } = await supabase
        .from('partner_payout_applications')
        .select('id')
        .eq('id', applicationId)
        .maybeSingle()

      isPartnerApp = !!partnerApp
    }

    if (isPartnerApp) {
      return handlePartnerPayout(supabase, applicationId, action, body, user, userData)
    } else {
      return handleCPPayout(supabase, applicationId, action, body, user, userData)
    }
  } catch (error) {
    logger.error('Error processing payout:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function handleCPPayout(
  supabase: any, applicationId: string, action: string,
  body: any, user: any, userData: any
) {
  const { transactionId, paymentDate, paymentAmount, paymentMode, paymentNotes,
          cpAccountNumber, cpIfscCode, cpBankName, cpAccountHolderName } = body

  const { data: application, error: appError } = await supabase
    .from('cp_applications')
    .select(`
      id, app_id, status, expected_payout_amount, cp_user_id,
      customer_name, application_number, bank_name, loan_type, loan_amount_disbursed,
      cp_user:users!cp_applications_cp_user_id_fkey (id, full_name, email, phone_number)
    `)
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !application) {
    return NextResponse.json({ success: false, error: 'CP application not found' }, { status: 404 })
  }

  let updateData: Record<string, any> = {}
  let newStatus: string
  const previousStatus = application.status

  switch (action) {
    case 'start_processing':
      if (application.status !== 'SA_APPROVED') {
        return NextResponse.json({ success: false, error: 'Application must be SA_APPROVED to start processing' }, { status: 400 })
      }
      newStatus = 'FINANCE_PROCESSING'
      updateData = {
        status: newStatus,
        finance_processed_by: user.id,
        ...(cpAccountNumber && { cp_account_number: cpAccountNumber }),
        ...(cpIfscCode && { cp_ifsc_code: cpIfscCode }),
        ...(cpBankName && { cp_bank_name: cpBankName }),
        ...(cpAccountHolderName && { cp_account_holder_name: cpAccountHolderName }),
      }
      break

    case 'complete':
      if (application.status !== 'FINANCE_PROCESSING') {
        return NextResponse.json({ success: false, error: 'Application must be in FINANCE_PROCESSING to complete' }, { status: 400 })
      }
      if (!transactionId || !paymentDate || !paymentMode) {
        return NextResponse.json({ success: false, error: 'Transaction ID, payment date, and payment mode are required' }, { status: 400 })
      }
      // Validate payment amount doesn't exceed approved commission (allow 5% tolerance for rounding)
      if (paymentAmount && application.expected_payout_amount) {
        const maxAllowed = application.expected_payout_amount * 1.05
        if (paymentAmount > maxAllowed) {
          return NextResponse.json({
            success: false,
            error: `Payment amount (${paymentAmount}) exceeds approved commission (${application.expected_payout_amount}). Maximum allowed: ${maxAllowed.toFixed(2)}`,
          }, { status: 400 })
        }
      }
      newStatus = 'PAYOUT_CREDITED'
      updateData = {
        status: newStatus,
        finance_processed_by: user.id,
        finance_processed_at: new Date().toISOString(),
        payment_transaction_id: transactionId,
        payment_date: paymentDate,
        payment_amount: paymentAmount || application.expected_payout_amount,
        payment_mode: paymentMode,
        payment_notes: paymentNotes || null,
        ...(cpAccountNumber && { cp_account_number: cpAccountNumber }),
        ...(cpIfscCode && { cp_ifsc_code: cpIfscCode }),
        ...(cpBankName && { cp_bank_name: cpBankName }),
        ...(cpAccountHolderName && { cp_account_holder_name: cpAccountHolderName }),
      }
      break

    case 'hold':
      if (!['SA_APPROVED', 'FINANCE_PROCESSING'].includes(application.status)) {
        return NextResponse.json({ success: false, error: 'Cannot hold from current status' }, { status: 400 })
      }
      newStatus = 'ON_HOLD'
      updateData = { status: newStatus, status_reason: paymentNotes || 'Put on hold by Finance' }
      break

    default:
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }

  // Update with optimistic locking to prevent race conditions
  const { data: updatedRows, error: updateError } = await supabase
    .from('cp_applications')
    .update(updateData)
    .eq('id', applicationId)
    .eq('status', application.status) // Optimistic lock
    .select('id')

  if (updateError) {
    logger.error('Error updating CP application:', { error: updateError })
    return NextResponse.json({ success: false, error: 'Failed to update application' }, { status: 500 })
  }

  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Application status has changed. Please refresh and try again.',
    }, { status: 409 })
  }

  await supabase.from('cp_application_status_history').insert({
    application_id: applicationId,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: user.id,
    changed_by_name: userData.full_name,
    changed_by_role: 'FINANCE_EXECUTIVE',
    notes: action === 'complete'
      ? `Payment completed via ${paymentMode}. Transaction ID: ${transactionId}`
      : action === 'start_processing' ? 'Started payment processing'
      : paymentNotes || null,
  })

  // CP notifications
  const cpUser = application.cp_user as any
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
          changedByRole: 'FINANCE_EXECUTIVE',
          transactionId, paymentDate,
          paymentAmount: paymentAmount || application.expected_payout_amount,
          paymentMode,
          reason: action === 'hold' ? paymentNotes : undefined,
        },
        previousStatus as CPPayoutStatus
      )
    } catch (notifyError) {
      logger.warn('Failed to send CP notification:', { error: notifyError })
    }
  }

  return NextResponse.json({
    success: true,
    message: action === 'start_processing' ? 'Payment processing started'
      : action === 'complete' ? 'Payout credited successfully'
      : 'Application put on hold',
  })
}

async function handlePartnerPayout(
  supabase: any, applicationId: string, action: string,
  body: any, user: any, userData: any
) {
  const { transactionId, paymentDate, paymentAmount, paymentMode, paymentNotes } = body

  const { data: app, error: appError } = await supabase
    .from('partner_payout_applications')
    .select('*')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !app) {
    return NextResponse.json({ success: false, error: 'Partner payout application not found' }, { status: 404 })
  }

  let newStatus: string
  let updateData: Record<string, unknown> = {}
  const previousStatus = app.status

  switch (action) {
    case 'start_processing':
      if (app.status !== 'SA_APPROVED') {
        return NextResponse.json({ success: false, error: `Application is ${app.status}, expected SA_APPROVED` }, { status: 409 })
      }
      newStatus = 'FINANCE_PROCESSING'
      updateData = { finance_processed_by: user.id }
      break

    case 'complete':
      if (app.status !== 'FINANCE_PROCESSING') {
        return NextResponse.json({ success: false, error: `Application is ${app.status}, expected FINANCE_PROCESSING` }, { status: 409 })
      }
      if (!transactionId || !paymentDate || !paymentMode) {
        return NextResponse.json({ success: false, error: 'Transaction ID, payment date, and payment mode are required' }, { status: 400 })
      }
      // Validate payment amount doesn't exceed approved commission (allow 5% tolerance for rounding)
      if (paymentAmount && app.expected_commission_amount) {
        const maxAllowed = app.expected_commission_amount * 1.05
        if (paymentAmount > maxAllowed) {
          return NextResponse.json({
            success: false,
            error: `Payment amount (${paymentAmount}) exceeds approved commission (${app.expected_commission_amount}). Maximum allowed: ${maxAllowed.toFixed(2)}`,
          }, { status: 400 })
        }
      }
      newStatus = 'PAYOUT_CREDITED'
      updateData = {
        finance_processed_by: user.id,
        finance_processed_at: new Date().toISOString(),
        finance_processing_notes: paymentNotes || null,
        payment_transaction_id: transactionId,
        payment_date: paymentDate,
        payment_amount: paymentAmount || app.expected_commission_amount,
        payment_mode: paymentMode,
        actual_commission_amount: paymentAmount || app.expected_commission_amount,
      }
      break

    case 'hold':
      if (!['SA_APPROVED', 'FINANCE_PROCESSING'].includes(app.status)) {
        return NextResponse.json({ success: false, error: 'Cannot hold from current status' }, { status: 400 })
      }
      newStatus = 'ON_HOLD'
      updateData = { status_reason: paymentNotes || 'Put on hold by Finance' }
      break

    default:
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }

  // Update with optimistic lock
  const { error: updateError } = await supabase
    .from('partner_payout_applications')
    .update({ status: newStatus, ...updateData })
    .eq('id', applicationId)
    .eq('status', app.status)

  if (updateError) {
    logger.error('Error updating partner payout application:', { error: updateError })
    return NextResponse.json({ success: false, error: 'Failed to update application' }, { status: 500 })
  }

  // Record status history
  await supabase.from('partner_payout_status_history').insert({
    application_id: applicationId,
    app_id: app.app_id,
    partner_type: app.partner_type,
    previous_status: previousStatus,
    new_status: newStatus,
    changed_by: user.id,
    changed_by_name: userData.full_name,
    changed_by_role: 'FINANCE_EXECUTIVE',
    notes: action === 'complete'
      ? `Payment completed via ${paymentMode}. Transaction ID: ${transactionId}`
      : action === 'start_processing' ? 'Started payment processing'
      : paymentNotes || null,
  })

  // Send partner payout notification
  try {
    // Fetch partner user details for notification
    const { data: partnerUser } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number')
      .eq('id', app.partner_user_id)
      .maybeSingle()

    if (partnerUser) {
      await notifyPartnerPayoutStatusChange({
        applicationId: app.id,
        appId: app.app_id || '',
        partnerType: app.partner_type,
        partnerUserId: app.partner_user_id,
        partnerName: partnerUser.full_name || 'Partner',
        partnerEmail: partnerUser.email || '',
        partnerPhone: partnerUser.phone_number,
        customerName: app.customer_name,
        leadNumber: app.lead_number,
        bankName: app.bank_name,
        loanType: app.loan_type,
        disbursedAmount: app.disbursed_amount,
        expectedCommission: app.expected_commission_amount,
        status: newStatus,
        changedByName: userData.full_name,
        changedByRole: 'FINANCE_EXECUTIVE',
        reason: action === 'hold' ? paymentNotes : undefined,
        transactionId: action === 'complete' ? transactionId : undefined,
        paymentDate: action === 'complete' ? paymentDate : undefined,
        paymentAmount: action === 'complete' ? (paymentAmount || app.expected_commission_amount) : undefined,
        paymentMode: action === 'complete' ? paymentMode : undefined,
      }, previousStatus)
    }
  } catch (notifyError) {
    logger.warn('Failed to send partner payout notification:', { error: notifyError, applicationId, newStatus })
  }

  return NextResponse.json({
    success: true,
    message: action === 'start_processing' ? 'Payment processing started'
      : action === 'complete' ? 'Payout credited successfully'
      : 'Application put on hold',
  })
}
