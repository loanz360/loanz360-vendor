export const dynamic = 'force-dynamic'

/**
 * Partner Payout Status API
 * Returns payout information for BA (Business Associate) and BP (Business Partner) ONLY
 * NO payouts for: CP, Employee, Customer, or Direct (LOANZ360)
 *
 * Categories:
 * - Estimated Payout: Leads in progress (PENDING status)
 * - Payout Earned: Approved leads (CALCULATED, APPROVED, PAID)
 * - Payout Dropped: Customer cancelled/dropped loan (DROPPED status)
 * - Payout Lost: Lead rejected by bank/system (LOST status)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

interface PayoutLead {
  lead_id: string
  lead_uuid: string
  customer_name: string
  customer_mobile: string
  loan_type: string
  loan_amount: number
  estimated_commission: number | null
  actual_commission: number | null
  commission_paid: boolean
  payout_applied: boolean
  payout_application_id: string | null
  status: string
  lead_status: string
  applied_at: string
  updated_at: string
}

interface PayoutSummary {
  estimated: {
    count: number
    total_amount: number
    leads: PayoutLead[]
  }
  earned: {
    count: number
    total_amount: number
    leads: PayoutLead[]
  }
  dropped: {
    count: number
    total_amount: number
    leads: PayoutLead[]
  }
  lost: {
    count: number
    total_amount: number
    leads: PayoutLead[]
  }
  referral_changed: {
    count: number
    total_amount: number
    leads: PayoutLead[]
  }
  lifetime_earnings: number
  total_leads: number
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      )
    }

    // =====================================================
    // 2. IDENTIFY PARTNER TYPE FROM PARTNERS TABLE
    // =====================================================

    // First, get the partner record for this user
    const { data: partnerData, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id, partner_type, full_name, is_active')
      .eq('user_id', user.id)
      .maybeSingle()

    if (partnerError) {
      apiLogger.error('Partner fetch error', partnerError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch partner information',
        },
        { status: 500 }
      )
    }

    // If no partner profile exists, return empty payout summary
    // This allows the page to load gracefully for new partners who haven't completed profile setup
    if (!partnerData) {
      // Determine partner type from user metadata
      const userSubRole = user?.user_metadata?.sub_role
      const inferredType = userSubRole === 'BUSINESS_ASSOCIATE' ? 'BA' : userSubRole === 'BUSINESS_PARTNER' ? 'BP' : 'BA'

      return NextResponse.json({
        success: true,
        partner_id: null,
        partner_type: inferredType,
        partner_name: 'New Partner',
        message: 'Complete your profile to start tracking payouts',
        payout_summary: {
          estimated: { count: 0, total_amount: 0, leads: [] },
          earned: { count: 0, total_amount: 0, leads: [] },
          dropped: { count: 0, total_amount: 0, leads: [] },
          lost: { count: 0, total_amount: 0, leads: [] },
          referral_changed: { count: 0, total_amount: 0, leads: [] },
          lifetime_earnings: 0,
          total_leads: 0,
        },
      })
    }

    if (partnerData.is_active === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'Your account is deactivated',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 3. VERIFY PARTNER IS BA OR BP (NO PAYOUT FOR OTHERS)
    // =====================================================

    // Handle both short codes (BA, BP) and full names (BUSINESS_ASSOCIATE, BUSINESS_PARTNER)
    const rawPartnerType = partnerData.partner_type?.toUpperCase()
    let partnerType: 'BA' | 'BP' | null = null

    if (rawPartnerType === 'BUSINESS_ASSOCIATE' || rawPartnerType === 'BA') {
      partnerType = 'BA'
    } else if (rawPartnerType === 'BUSINESS_PARTNER' || rawPartnerType === 'BP') {
      partnerType = 'BP'
    }

    if (!partnerType) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payout information is only available for Business Associates (BA) and Business Partners (BP). Your account type does not have payout privileges.',
          partner_type: partnerData.partner_type || 'UNKNOWN',
        },
        { status: 403 }
      )
    }

    const partnerId = partnerData.id
    const partnerName = partnerData.full_name || (partnerType === 'BA' ? 'Business Associate' : 'Business Partner')

    // =====================================================
    // 4. FETCH ALL LEADS FOR THIS PARTNER
    // =====================================================

    const { data: leads, error: leadsError } = await supabase
      .from('partner_leads')
      .select(`
        id,
        lead_id,
        customer_name,
        customer_mobile,
        loan_type,
        loan_amount,
        required_loan_amount,
        estimated_commission,
        actual_commission,
        commission_paid,
        status,
        lead_status,
        payout_applied,
        payout_application_id,
        created_at,
        updated_at
      `)
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })

    if (leadsError) {
      apiLogger.error('Leads fetch error', leadsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch payout information',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 5. CATEGORIZE LEADS BY COMMISSION STATUS
    // =====================================================

    const estimatedLeads: PayoutLead[] = []
    const earnedLeads: PayoutLead[] = []
    const droppedLeads: PayoutLead[] = []
    const lostLeads: PayoutLead[] = []
    const referralChangedLeads: PayoutLead[] = []

    let lifetimeEarnings = 0

    leads?.forEach((lead) => {
      // Use loan_amount or required_loan_amount (whichever is available)
      const loanAmount = lead.loan_amount || lead.required_loan_amount || 0

      const payoutLead: PayoutLead = {
        lead_id: lead.lead_id,
        lead_uuid: lead.id,
        customer_name: lead.customer_name,
        customer_mobile: lead.customer_mobile,
        loan_type: lead.loan_type,
        loan_amount: loanAmount,
        estimated_commission: lead.estimated_commission,
        actual_commission: lead.actual_commission,
        commission_paid: lead.commission_paid || false,
        payout_applied: lead.payout_applied || false,
        payout_application_id: lead.payout_application_id || null,
        status: lead.status || lead.lead_status || 'new',
        lead_status: lead.lead_status || lead.status || 'NEW',
        applied_at: lead.created_at,
        updated_at: lead.updated_at,
      }

      // Use status field for categorization (original schema column)
      // status: 'new', 'in_progress', 'documentation', 'bank_processing', 'sanctioned', 'disbursed', 'dropped', 'rejected'
      const leadStatus = (lead.status || lead.lead_status || 'new').toLowerCase()

      switch (leadStatus) {
        case 'new':
        case 'in_progress':
        case 'documentation':
        case 'bank_processing':
        case 'contacted':
        case 'qualified':
          // Estimated payout - leads in progress
          estimatedLeads.push(payoutLead)
          break

        case 'sanctioned':
        case 'disbursed':
        case 'converted':
          // Payout earned
          earnedLeads.push(payoutLead)
          if (lead.actual_commission) {
            lifetimeEarnings += lead.actual_commission
          }
          break

        case 'dropped':
          // Customer dropped/cancelled
          droppedLeads.push(payoutLead)
          break

        case 'rejected':
        case 'lost':
          // Rejected by bank/system
          lostLeads.push(payoutLead)
          break

        default:
          // Put unknown status in estimated
          estimatedLeads.push(payoutLead)
          break
      }
    })

    // =====================================================
    // 6. CALCULATE ESTIMATED AMOUNTS
    // =====================================================

    // For estimated payouts, use estimated_commission from the database
    // or calculate based on payout percentages
    let estimatedTotalAmount = 0

    // Pre-fetch all current payout percentages in a single query (avoids N+1)
    const tableName = partnerType === 'BA' ? 'payout_ba_percentages' : 'payout_bp_percentages'
    const { data: allPercentages } = await supabase
      .from(tableName)
      .select('loan_type, ba_commission_percentage, bp_commission_percentage')
      .eq('is_current', true)

    const percentageMap = new Map(
      (allPercentages || []).map(p => [p.loan_type, p])
    )

    for (const lead of estimatedLeads) {
      if (lead.estimated_commission) {
        estimatedTotalAmount += lead.estimated_commission
      } else if (lead.loan_amount) {
        const percentageData = percentageMap.get(lead.loan_type)
        if (percentageData) {
          const percentage =
            partnerType === 'BA'
              ? percentageData.ba_commission_percentage
              : percentageData.bp_commission_percentage
          if (percentage) {
            const estimatedAmount = (lead.loan_amount * percentage) / 100
            lead.estimated_commission = estimatedAmount
            estimatedTotalAmount += estimatedAmount
          }
        }
      }
    }

    // =====================================================
    // 7. CALCULATE TOTALS
    // =====================================================

    const earnedTotalAmount = earnedLeads.reduce((sum, lead) => sum + (lead.actual_commission || lead.estimated_commission || 0), 0)
    const droppedTotalAmount = droppedLeads.reduce((sum, lead) => sum + (lead.estimated_commission || 0), 0)
    const lostTotalAmount = lostLeads.reduce((sum, lead) => sum + (lead.estimated_commission || 0), 0)
    const referralChangedTotalAmount = referralChangedLeads.reduce(
      (sum, lead) => sum + (lead.estimated_commission || 0),
      0
    )

    // =====================================================
    // 8. BUILD RESPONSE
    // =====================================================

    const payoutSummary: PayoutSummary = {
      estimated: {
        count: estimatedLeads.length,
        total_amount: estimatedTotalAmount,
        leads: estimatedLeads,
      },
      earned: {
        count: earnedLeads.length,
        total_amount: earnedTotalAmount,
        leads: earnedLeads,
      },
      dropped: {
        count: droppedLeads.length,
        total_amount: droppedTotalAmount,
        leads: droppedLeads,
      },
      lost: {
        count: lostLeads.length,
        total_amount: lostTotalAmount,
        leads: lostLeads,
      },
      referral_changed: {
        count: referralChangedLeads.length,
        total_amount: referralChangedTotalAmount,
        leads: referralChangedLeads,
      },
      lifetime_earnings: lifetimeEarnings,
      total_leads: leads?.length || 0,
    }

    return NextResponse.json({
      success: true,
      partner_id: partnerId,
      partner_type: partnerType,
      partner_name: partnerName,
      payout_summary: payoutSummary,
    })
  } catch (error) {
    apiLogger.error('Payout Status API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch payout status',
      },
      { status: 500 }
    )
  }
}
