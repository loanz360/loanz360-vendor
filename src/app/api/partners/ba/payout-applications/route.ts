import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { notifyPartnerApplicationSubmitted, notifyPartnerPayoutInternalTeam } from '@/lib/notifications/partner-payout-notifications'


/**
 * GET /api/partners/ba/payout-applications
 * List BA partner's payout applications
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

      // Verify ownership
      const { data: app } = await supabase
        .from('partner_payout_applications')
        .select('id')
        .eq('id', applicationId)
        .eq('partner_user_id', user.id)
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
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Verify user is a BA partner
    const { data: partnerData } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partnerData) {
      return NextResponse.json({ success: false, error: 'Partner profile not found' }, { status: 404 })
    }

    const pType = partnerData.partner_type?.toUpperCase()
    if (pType !== 'BA' && pType !== 'BUSINESS_ASSOCIATE') {
      return NextResponse.json({ success: false, error: 'Access denied. Only Business Associates can access this resource.' }, { status: 403 })
    }

    // Build query
    let query = supabase
      .from('partner_payout_applications')
      .select('*', { count: 'exact' })
      .eq('partner_user_id', user.id)
      .eq('partner_type', 'BA')
      .eq('is_team_override', false)
      .order('created_at', { ascending: false })

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
      logger.error('Error fetching BA payout applications:', { error })
      return NextResponse.json({ success: false, error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Stats
    const [pendingCount, verificationCount, approvedCount, paidCount] = await Promise.all([
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('partner_user_id', user.id).eq('partner_type', 'BA').eq('status', 'PENDING'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('partner_user_id', user.id).eq('partner_type', 'BA').in('status', ['ACCOUNTS_VERIFICATION', 'ACCOUNTS_VERIFIED']),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('partner_user_id', user.id).eq('partner_type', 'BA').eq('status', 'SA_APPROVED'),
      supabase.from('partner_payout_applications').select('id', { count: 'exact', head: true }).eq('partner_user_id', user.id).eq('partner_type', 'BA').eq('status', 'PAYOUT_CREDITED'),
    ])

    return NextResponse.json({
      success: true,
      applications: applications || [],
      stats: {
        pending: pendingCount.count || 0,
        in_verification: verificationCount.count || 0,
        approved: approvedCount.count || 0,
        paid: paidCount.count || 0,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    logger.error('Error in BA payout applications GET:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/partners/ba/payout-applications
 * BA partner applies for payout on a disbursed lead
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const bodySchema = z.object({

      partnerLeadId: z.string().uuid(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { partnerLeadId } = body

    if (!partnerLeadId) {
      return NextResponse.json({ success: false, error: 'Partner lead ID is required' }, { status: 400 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a BA partner
    const { data: partnerData } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name, user_id, parent_partner_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!partnerData) {
      return NextResponse.json({ success: false, error: 'Partner profile not found' }, { status: 404 })
    }

    const pType = partnerData.partner_type?.toUpperCase()
    if (pType !== 'BA' && pType !== 'BUSINESS_ASSOCIATE') {
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

    // Validate lead status is disbursed
    const leadStatus = (lead.status || lead.lead_status || '').toLowerCase()
    if (leadStatus !== 'disbursed') {
      return NextResponse.json({ success: false, error: 'Lead must be in DISBURSED status to apply for payout' }, { status: 400 })
    }

    // Check if already applied
    if (lead.payout_applied) {
      return NextResponse.json({ success: false, error: 'Payout has already been applied for this lead' }, { status: 400 })
    }

    // Check no existing application
    const { data: existing } = await supabase
      .from('partner_payout_applications')
      .select('id')
      .eq('partner_lead_id', partnerLeadId)
      .eq('partner_type', 'BA')
      .eq('is_team_override', false)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'A payout application already exists for this lead' }, { status: 400 })
    }

    // Look up commission rate from payout grid
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
      .from('payout_ba_percentages')
      .select('ba_commission_percentage')
      .ilike('bank_name', `%${bankName}%`)
      .ilike('loan_type', `%${loanType}%`)
      .eq('is_current', true)
      .limit(1)
      .maybeSingle()

    if (payoutRate?.ba_commission_percentage) {
      commissionPercentage = payoutRate.ba_commission_percentage
      expectedCommission = Math.round(disbursedAmount * commissionPercentage) / 100
    } else {
      // Fallback: try general rate with 70% multiplier
      const { data: generalRate } = await supabase
        .from('payout_general_percentages')
        .select('commission_percentage')
        .ilike('bank_name', `%${bankName}%`)
        .ilike('loan_type', `%${loanType}%`)
        .eq('is_current', true)
        .limit(1)
        .maybeSingle()

      if (generalRate?.commission_percentage) {
        commissionPercentage = Math.round(generalRate.commission_percentage * 70) / 100
        expectedCommission = Math.round(disbursedAmount * commissionPercentage) / 100
      }
    }

    // Create payout application
    const applicationData = {
      partner_type: 'BA',
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
    }

    const { data: newApp, error: insertError } = await supabase
      .from('partner_payout_applications')
      .insert(applicationData)
      .select()
      .maybeSingle()

    if (insertError) {
      logger.error('Error creating BA payout application:', { error: insertError })
      return NextResponse.json({ success: false, error: 'Failed to create payout application' }, { status: 500 })
    }

    // Mark lead as payout applied
    await supabase
      .from('partner_leads')
      .update({ payout_applied: true, payout_application_id: newApp.id })
      .eq('id', partnerLeadId)

    // Record status history
    await supabase.from('partner_payout_status_history').insert({
      application_id: newApp.id,
      app_id: newApp.app_id,
      partner_type: 'BA',
      previous_status: null,
      new_status: 'PENDING',
      changed_by: user.id,
      changed_by_name: partnerData.full_name || 'BA Partner',
      changed_by_role: 'PARTNER',
      notes: 'Payout application submitted by Business Associate',
    })

    // BP auto-override: if this BA has a parent BP, create linked team override application
    let bpOverrideApp = null
    if (partnerData.parent_partner_id) {
      const { data: parentBP } = await supabase
        .from('partners')
        .select('id, partner_id, full_name, user_id, partner_type')
        .eq('id', partnerData.parent_partner_id)
        .maybeSingle()

      if (parentBP && parentBP.user_id) {
        // Look up BP team override percentage
        let bpTeamPct = 0
        const { data: bpRate } = await supabase
          .from('payout_bp_percentages')
          .select('bp_team_commission_percentage')
          .ilike('bank_name', `%${bankName}%`)
          .ilike('loan_type', `%${loanType}%`)
          .eq('is_current', true)
          .limit(1)
          .maybeSingle()

        if (bpRate?.bp_team_commission_percentage) {
          bpTeamPct = bpRate.bp_team_commission_percentage
        } else {
          // Fallback: 10% of general
          const { data: genRate } = await supabase
            .from('payout_general_percentages')
            .select('commission_percentage')
            .ilike('bank_name', `%${bankName}%`)
            .ilike('loan_type', `%${loanType}%`)
            .eq('is_current', true)
            .limit(1)
            .maybeSingle()

          if (genRate?.commission_percentage) {
            bpTeamPct = Math.round(genRate.commission_percentage * 10) / 100
          }
        }

        const bpOverrideData = {
          partner_type: 'BP',
          partner_user_id: parentBP.user_id,
          partner_id: parentBP.id,
          partner_code: parentBP.partner_id,
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
          commission_percentage: bpTeamPct,
          expected_commission_amount: Math.round(disbursedAmount * bpTeamPct) / 100,
          is_team_override: true,
          linked_application_id: newApp.id,
          parent_bp_partner_id: parentBP.id,
          status: 'PENDING',
        }

        // Attempt BP override creation with retry
        let bpInsertAttempts = 0
        const maxAttempts = 2
        let bpError: { message?: string; code?: string } | null = null

        while (bpInsertAttempts < maxAttempts) {
          bpInsertAttempts++
          const { data: bpApp, error: bpErr } = await supabase
            .from('partner_payout_applications')
            .insert(bpOverrideData)
            .select()
            .maybeSingle()

          if (!bpErr && bpApp) {
            bpOverrideApp = bpApp
            bpError = null

            await supabase.from('partner_payout_status_history').insert({
              application_id: bpApp.id,
              app_id: bpApp.app_id,
              partner_type: 'BP',
              previous_status: null,
              new_status: 'PENDING',
              changed_by: user.id,
              changed_by_name: partnerData.full_name || 'BA Partner',
              changed_by_role: 'PARTNER',
              notes: `Team override auto-created from BA application ${newApp.app_id}`,
            })
            break
          } else {
            bpError = bpErr
            if (bpInsertAttempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 500))
            }
          }
        }

        if (bpError) {
          logger.error('Failed to create BP team override after retries:', {
            error: bpError,
            baApplicationId: newApp.id,
            baAppId: newApp.app_id,
            parentBPId: parentBP.id,
            attempts: bpInsertAttempts,
          })
        }
      }
    }

    // Send partner submission notification (non-blocking)
    const partnerEmail = (await supabase.from('partners').select('email').eq('id', partnerData.id).maybeSingle())?.data?.email || ''
    const partnerPhone = (await supabase.from('partners').select('phone').eq('id', partnerData.id).maybeSingle())?.data?.phone
    const notifData = {
      applicationId: newApp.id,
      appId: newApp.app_id,
      partnerType: 'BA' as const,
      partnerUserId: user.id,
      partnerName: partnerData.full_name || 'Partner',
      partnerEmail,
      partnerPhone,
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
      logger.error('Failed to send BA payout submission notification:', { error: err })
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
      bpOverride: bpOverrideApp,
    })
  } catch (error) {
    logger.error('Error in BA payout applications POST:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
