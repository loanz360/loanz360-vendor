/**
 * Super Admin Revenue Forecast API
 * GET /api/superadmin/revenue-forecast
 *
 * Provides revenue forecasting data combining the v_revenue_forecast view
 * with historical monthly lead data for trend analysis.
 *
 * Returns: forecast summary, monthly trends (12 months), loan type pipeline breakdown
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch forecast view data and raw monthly lead data in parallel
    const [forecastRes, monthlyRes] = await Promise.all([
      supabase.from('v_revenue_forecast').select('*'),
      supabase.from('partner_leads')
        .select('created_at, converted, required_loan_amount, loan_type')
    ])

    let forecast = forecastRes.data?.[0] || null
    const monthlyLeads = monthlyRes.data || []

    // Aggregate monthly data into a map
    const monthlyMap = new Map<string, {
      leads: number
      converted: number
      pipeline: number
      revenue: number
      byLoanType: Record<string, { leads: number; pipeline: number }>
    }>()

    monthlyLeads.forEach((lead: any) => {
      const month = new Date(lead.created_at).toISOString().slice(0, 7) // "YYYY-MM"
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { leads: 0, converted: 0, pipeline: 0, revenue: 0, byLoanType: {} })
      }
      const m = monthlyMap.get(month)!
      m.leads++
      m.pipeline += lead.required_loan_amount || 0
      if (lead.converted) {
        m.converted++
        m.revenue += lead.required_loan_amount || 0
      }
      // Track pipeline by loan type
      const lt = lead.loan_type || 'Unknown'
      if (!m.byLoanType[lt]) m.byLoanType[lt] = { leads: 0, pipeline: 0 }
      m.byLoanType[lt].leads++
      m.byLoanType[lt].pipeline += lead.required_loan_amount || 0
    })

    // Convert to sorted array (last 12 months)
    let monthlyTrends = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        leads: data.leads,
        converted: data.converted,
        pipeline: data.pipeline,
        revenue: data.revenue,
        conversion_rate: data.leads > 0 ? parseFloat(((data.converted / data.leads) * 100).toFixed(2)) : 0,
        avg_deal_size: data.converted > 0 ? Math.round(data.revenue / data.converted) : 0,
        byLoanType: data.byLoanType
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)

    // Aggregate pipeline by loan type across all data
    const loanTypePipeline: Record<string, number> = {}
    monthlyLeads.forEach((lead: any) => {
      const lt = lead.loan_type || 'Unknown'
      loanTypePipeline[lt] = (loanTypePipeline[lt] || 0) + (lead.required_loan_amount || 0)
    })


    // If no forecast data from the view, compute a simple forecast from historical trends
    if (!forecast) {
      const lastMonth = monthlyTrends[monthlyTrends.length - 1]
      const avgLeads = Math.round(monthlyTrends.reduce((s, m) => s + m.leads, 0) / monthlyTrends.length)
      const avgConv = Math.round(monthlyTrends.reduce((s, m) => s + m.converted, 0) / monthlyTrends.length)
      const avgRev = Math.round(monthlyTrends.reduce((s, m) => s + m.revenue, 0) / monthlyTrends.length)
      const avgRate = parseFloat((monthlyTrends.reduce((s, m) => s + m.conversion_rate, 0) / monthlyTrends.length).toFixed(2))

      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      forecast = {
        current_month: lastMonth?.month || new Date().toISOString().slice(0, 7),
        current_month_leads: lastMonth?.leads || 0,
        current_month_pipeline: lastMonth?.pipeline || 0,
        forecast_month: nextMonth.toISOString().slice(0, 7),
        forecast_leads: avgLeads,
        forecast_conversions: avgConv,
        forecast_revenue: avgRev,
        forecast_conversion_rate: avgRate,
        forecast_confidence: 'Medium'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        forecast,
        monthlyTrends,
        loanTypePipeline
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Revenue Forecast API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
