import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'

export const dynamic = 'force-dynamic'

/**
 * GET /api/employees/dse/partner-leads/pipeline
 * Returns comprehensive pipeline statistics for partner-sourced leads.
 * Used by the Partner Leads dashboard for accurate full-data summaries.
 */

interface LeadRecord {
  lead_status: string
  required_loan_amount: number | null
  partner_id: string
  partner_type: string
  loan_type: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth

    // Get partner IDs recruited by this DSE
    const { data: myPartners } = await supabase
      .from('partners')
      .select('id, partner_type')
      .eq('recruited_by_cpe', userId)

    if (!myPartners || myPartners.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          pipeline: {},
          by_partner_type: {},
          by_loan_type: {},
          totals: { total_leads: 0, total_value: 0, this_month_leads: 0, avg_lead_value: 0 },
        },
      })
    }

    const partnerIds = myPartners.map((p: { id: string }) => p.id)

    // Get all leads from these partners
    const { data: leadsData } = await supabase
      .from('partner_leads')
      .select('lead_status, required_loan_amount, partner_id, partner_type, loan_type, created_at')
      .in('partner_id', partnerIds)
      .eq('is_active', true)

    const leads = (leadsData || []) as LeadRecord[]

    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          pipeline: {},
          by_partner_type: {},
          by_loan_type: {},
          totals: { total_leads: 0, total_value: 0, this_month_leads: 0, avg_lead_value: 0 },
        },
      })
    }

    // Pipeline by status
    const pipeline: Record<string, { count: number; value: number }> = {}
    const byPartnerType: Record<string, { count: number; value: number }> = {}
    const byLoanType: Record<string, { count: number; value: number }> = {}
    let totalValue = 0

    leads.forEach(lead => {
      const status = lead.lead_status || 'Unknown'
      const amount = lead.required_loan_amount || 0
      const pType = lead.partner_type || 'Unknown'
      const lType = lead.loan_type || 'Unknown'

      if (!pipeline[status]) pipeline[status] = { count: 0, value: 0 }
      pipeline[status].count++
      pipeline[status].value += amount

      if (!byPartnerType[pType]) byPartnerType[pType] = { count: 0, value: 0 }
      byPartnerType[pType].count++
      byPartnerType[pType].value += amount

      if (!byLoanType[lType]) byLoanType[lType] = { count: 0, value: 0 }
      byLoanType[lType].count++
      byLoanType[lType].value += amount

      totalValue += amount
    })

    // This month leads
    const now = new Date()
    const thisMonthLeads = leads.filter(l => {
      const d = new Date(l.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })

    // Trend: last 6 months
    const monthlyTrend: Array<{ month: string; count: number; value: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
      const monthLeads = leads.filter(l => {
        const ld = new Date(l.created_at)
        return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear()
      })
      monthlyTrend.push({
        month: monthLabel,
        count: monthLeads.length,
        value: monthLeads.reduce((s, l) => s + (l.required_loan_amount || 0), 0),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        pipeline,
        by_partner_type: byPartnerType,
        by_loan_type: byLoanType,
        monthly_trend: monthlyTrend,
        totals: {
          total_leads: leads.length,
          total_value: totalValue,
          this_month_leads: thisMonthLeads.length,
          avg_lead_value: leads.length > 0 ? Math.round(totalValue / leads.length) : 0,
        },
      },
    })
  } catch (error: unknown) {
    apiLogger.error('DSE partner-leads pipeline error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
