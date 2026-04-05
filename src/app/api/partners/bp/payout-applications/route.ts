import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyPartnerApplicationSubmitted, notifyPartnerPayoutInternalTeam } from '@/lib/notifications/partner-payout-notifications'

export const dynamic = 'force-dynamic'

/**
 * GET /api/partners/bp/payout-applications
 * List BP partner's payout applications (own + team overrides)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Status history sub-endpoint
    if (action === 'history') {
      const applicationId = searchParams.get('applicationId')
      if (!applicationId) {
        return NextResponse.json({ success: false, error: 'Application ID required' }, { status: 400 })
      }

      // BP can view own applications + team overrides
      const { data: partnerCheck } = await supabase
        .from('partners')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const { data: app } = await supabase
        .from('partner_payout_applications')
        .select('id')
        .eq('id', applicationId)
        .or(`partner_user_id.eq.${user.id},parent_bp_partner_id.eq.${partnerCheck?.id || '00000000-0000-0000-0000-000000000000'}`)
        .maybeSingle()

      if (!app) {
        return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 })
      }

      const { data: history } = await supabase
        .from('partner_payout_status_history')
        .select('new_status, previous_status, status_reason, changed_by_name, changed_by_role, notes, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })

      return NextResponse.json({ success: true, history: history || [] })
    }

    const status = searchParams.get('status') || 'ALL'
    const tab = searchParams.get('tab') || 'all' // 'own', 'team', 'all'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Verify user is a BP partner
    const { data: partnerData } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partnerData) {
      return NextResponse.json({ success: false, error: 'Partner profile not found' }, { status: 404 })
    }

    const pType = partnerData.partner_type?.toUpperCase()
    if (pType !== 'BP' && pType !== 'BUSINESS_PARTNER') {
      return NextResponse.json({ success: false, error: 'Access denied. Only Business Partners can access this resource.' }, { status: 403 })
    }

    // Build query based on tab
    let query = supabase
      .from('partner_payout_applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (tab === 'own') {
      // Direct BP applications (BP's own leads)
      query = query.eq('partner_user_id', user.id).eq('partner_type', 'BP').eq('is_team_override', false)
    } else if (tab === 'team') {
      // Team override applications (from BAs under this BP)
      query = query.eq('parent_bp_partner_id', partnerData.id).eq('is_team_override', true)
    } else {
      // All: own + team overrides
      query = query.or(`and(partner_user_id.eq.${user.id},partner_type.eq.BP,is_team_override.eq.false),and(parent_bp_partner_id.eq.${partnerData.id},is_team_override.eq.true)`)
    }

    if (status !== 'ALL') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`app_id.ilike.%${search}%,customer_name.ilike.%${search}%,lead_number.ilike.%${search}%,bank_name.ilike.%${search}%`)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: applications, error, count } = await query

    if (error) {
      logger.error('Error fetching BP payout applications:', { error })
      return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Stats
    const [ownPending, teamPending, ownPaid, teamPaid] = await Promise.all([
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_user_id', user.id).eq('partner_type', 'BP').eq('is_team_override', false)
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED']),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('parent_bp_partner_id', partnerData.id).eq('is_team_override', true)
        .in('status', ['PENDING', 'ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED', 'SA_APPROVED']),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('partner_user_id', user.id).eq('partner_type', 'BP').eq('is_team_override', false)
        .eq('status', 'PAYOUT_CREDITED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true })
        .eq('parent_bp_partner_id', partnerData.id).eq('is_team_override', true)
        .eq('status', 'PAYOUT_CREDITED'),
    ])

    return NextResponse.json({
      success: true,
      applications: applications || [],
      stats: {
        own_in_pipeline: ownPending.count || 0,
        team_in_pipeline: teamPending.count || 0,
        own_paid: ownPaid.count || 0,
        team_paid: teamPaid.count || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Error in BP payout applications GET:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/partners/bp/payout-applications
 * BP partner applies for payout on their own disbursed lead
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const body = await request.json()
    const { partnerLeadId } = body

    if (!partnerLeadId) {
      return NextResponse.json({ success: false, error: 'Partner lead ID is required' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a BP partner
    const { data: partnerData } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name, user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partnerData) {
      return NextResponse.json({ success: false, error: 'Partner profile not found' }, { status: 404 })
    }

    const pType = partnerData.partner_type?.toUpperCase()
    if (pType !== 'BP' && pType !== 'BUSINESS_PARTNER') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from('partner_leads')
      .select('*')
      .eq('id', partnerLeadId)
      .eq('partner_id', partnerData.id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found or does not belong to you' }, { status: 404 })
    }

    // Validate lead status
    const leadStatus = (lead.status || lead.lead_status || '').toLowerCase()
    if (leadStatus !== 'disbursed') {
      return NextResponse.json({ success: false, error: 'Lead must be in DISBURSED status' }, { status: 400 })
    }

    if (lead.payout_applied) {
      return NextResponse.json({ success: false, error: 'Payout already applied for this lead' }, { status: 400 })
    }

    // Check no existing application
    const { data: existing } = await supabase
      .from('partner_payout_applications')
      .select('id')
      .eq('partner_lead_id', partnerLeadId)
      .eq('partner_type', 'BP')
      .eq('is_team_override', false)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Application already exists for this lead' }, { status: 400 })
    }

    // Look up commission rate
    const bankName = lead.bank_name || ''
    const loanType = lead.loan_type || ''
    const disbursedAmount = lead.disbursed_amount || lead.loan_amount || lead.required_loan_amount || 0

    if (disbursedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Disbursed amount must be greater than zero' }, { status: 400 })
    }

    // Validate partner has bank account on file for payout
    const { data: partnerProfile } = await supabase
      .from('partners')
      .select('bank_account_number, bank_name, bank_ifsc_code')
      .eq('id', partnerData.id)
      .maybeSingle()

    if (!partnerProfile?.bank_account_number || !partnerProfile?.bank_ifsc_code) {
      return NextResponse.json({
        success: false,
        error: 'Please complete your bank account details in Profile → Bank & Payout before applying for payout. Bank account number and IFSC code are required.',
        code: 'BANK_DETAILS_MISSING'
      }, { status: 400 })
    }

    let commissionPercentage = 0
    let expectedCommission = 0

    const { data: payoutRate } = await supabase
      .from('payout_bp_percentages')
      .select('bp_commission_percentage')
      .ilike('bank_name', `%${bankName}%`)
      .ilike('loan_type', `%${loanType}%`)
      .eq('is_current', true)
      .limit(1)
      .maybeSingle()

    if (payoutRate?.bp_commission_percentage) {
      commissionPercentage = payoutRate.bp_commission_percentage
      expectedCommission = Math.round(disbursedAmount * commissionPercentage) / 100
    } else {
      // Fallback: 50% of general
      const { data: generalRate } = await supabase
        .from('payout_general_percentages')
        .select('commission_percentage')
        .ilike('bank_name', `%${bankName}%`)
        .ilike('loan_type', `%${loanType}%`)
        .eq('is_current', true)
        .limit(1)
        .maybeSingle()

      if (generalRate?.commission_percentage) {
        commissionPercentage = Math.round(generalRate.commission_percentage * 50) / 100
        expectedCommission = Math.round(disbursedAmount * commissionPercentage) / 100
      }
    }

    // Create application
    const { data: newApp, error: insertError } = await supabase
      .from('partner_payout_applications')
      .insert({
        partner_type: 'BP',
        partner_user_id: user.id,
        partner_id: partnerData.id,
        partner_code: partnerData.partner_id,
        partner_lead_id: partnerLeadId,
        lead_id: lead.ulap_lead_id || null,
        lead_number: lead.lead_id || lead.lead_number || null,
        customer_name: lead.customer_name,
        customer_mobile: lead.customer_mobile,
        loan_type: loanType,
        bank_name: bankName,
        disbursed_amount: disbursedAmount,
        disbursement_date: lead.disbursement_date || lead.updated_at?.split('T')[0] || null,
        sanctioned_amount: lead.sanctioned_amount || null,
        commission_percentage: commissionPercentage,
        expected_commission_amount: expectedCommission,
        status: 'PENDING',
      })
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating BP payout application:', { error: insertError })
      return NextResponse.json({ success: false, error: 'Failed to create payout application' }, { status: 500 })
    }

    // Mark lead as applied
    await supabase
      .from('partner_leads')
      .update({ payout_applied: true, payout_application_id: newApp.id })
      .eq('id', partnerLeadId)

    // Record status history
    await supabase.from('partner_payout_status_history').insert({
      application_id: newApp.id,
      app_id: newApp.app_id,
      partner_type: 'BP',
      previous_status: null,
      new_status: 'PENDING',
      changed_by: user.id,
      changed_by_name: partnerData.full_name || 'BP Partner',
      changed_by_role: 'PARTNER',
      notes: 'Payout application submitted by Business Partner',
    })

    // Send partner submission notification (non-blocking)
    const partnerExtra = await supabase.from('partners').select('email, phone').eq('id', partnerData.id).maybeSingle()
    const notifData = {
      applicationId: newApp.id,
      appId: newApp.app_id,
      partnerType: 'BP' as const,
      partnerUserId: user.id,
      partnerName: partnerData.full_name || 'Partner',
      partnerEmail: partnerExtra?.data?.email || '',
      partnerPhone: partnerExtra?.data?.phone,
      partnerCode: partnerData.partner_id || '',
      customerName: newApp.customer_name || '',
      leadNumber: newApp.lead_number || '',
      bankName: newApp.bank_name || '',
      loanType: newApp.loan_type || '',
      disbursedAmount: newApp.disbursed_amount || 0,
      expectedCommissionAmount: newApp.expected_commission_amount || 0,
      status: 'PENDING' as const,
    }

    notifyPartnerApplicationSubmitted(notifData).catch(err => {
      logger.error('Failed to send BP payout submission notification:', { error: err })
    })

    // Notify Accounts team about new application (non-blocking)
    supabase.from('users').select('id, full_name, email')
      .eq('role', 'EMPLOYEE')
      .in('sub_role', ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER'])
      .then(({ data: accountsTeam }) => {
        if (accountsTeam && accountsTeam.length > 0) {
          notifyPartnerPayoutInternalTeam(
            accountsTeam.map(u => ({ userId: u.id, name: u.full_name || '', email: u.email || '', role: 'ACCOUNTS_EXECUTIVE' })),
            notifData,
            'new_application'
          ).catch(err => logger.error('Failed to notify accounts team:', { error: err }))
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Payout application submitted successfully',
      application: newApp,
    })
  } catch (error) {
    logger.error('Error in BP payout applications POST:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
