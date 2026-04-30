/**
 * API Route: DSE Customer Link Analytics
 * GET /api/employees/dse/customer-link/analytics
 *
 * Returns analytics data for DSE's generated customer links:
 * - Summary stats (total, clicks, opens, conversions)
 * - Daily trend data for the last 30 days
 * - Conversion funnel percentages
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const { data: profile } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.role !== 'EMPLOYEE' || profile.sub_role !== 'DIRECT_SALES_EXECUTIVE') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Fetch all links for this DSE
    const { data: links, error: fetchError } = await supabase
      .from('dse_customer_links')
      .select('id, click_count, form_opened, form_submitted, lead_id, created_at, expires_at, status, loan_type')
      .eq('dse_user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (fetchError) {
      apiLogger.error('Link analytics fetch error', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 })
    }

    const allLinks = links || []
    const now = new Date()

    // Summary stats
    const totalLinks = allLinks.length
    const totalClicks = allLinks.reduce((sum, l) => sum + (l.click_count || 0), 0)
    const totalOpened = allLinks.filter(l => l.form_opened).length
    const totalSubmitted = allLinks.filter(l => l.form_submitted).length
    const totalConverted = allLinks.filter(l => l.lead_id).length
    const expiredLinks = allLinks.filter(l => l.expires_at && new Date(l.expires_at) < now).length
    const activeLinks = totalLinks - expiredLinks

    // Conversion funnel
    const funnel = {
      links_generated: totalLinks,
      links_clicked: allLinks.filter(l => (l.click_count || 0) > 0).length,
      forms_opened: totalOpened,
      forms_submitted: totalSubmitted,
      leads_converted: totalConverted,
    }

    const funnelPercentages = {
      click_rate: totalLinks > 0 ? Math.round((funnel.links_clicked / totalLinks) * 100) : 0,
      open_rate: funnel.links_clicked > 0 ? Math.round((totalOpened / funnel.links_clicked) * 100) : 0,
      submit_rate: totalOpened > 0 ? Math.round((totalSubmitted / totalOpened) * 100) : 0,
      conversion_rate: totalLinks > 0 ? Math.round((totalConverted / totalLinks) * 100) : 0,
    }

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const dailyTrend: Record<string, { generated: number; clicked: number; submitted: number }> = {}
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split('T')[0]
      dailyTrend[key] = { generated: 0, clicked: 0, submitted: 0 }
    }

    for (const link of allLinks) {
      const dateKey = new Date(link.created_at).toISOString().split('T')[0]
      if (dailyTrend[dateKey]) {
        dailyTrend[dateKey].generated++
        if (link.click_count > 0) dailyTrend[dateKey].clicked++
        if (link.form_submitted) dailyTrend[dateKey].submitted++
      }
    }

    // Loan type breakdown
    const loanTypeStats: Record<string, { count: number; conversions: number }> = {}
    for (const link of allLinks) {
      const type = link.loan_type || 'Not Specified'
      if (!loanTypeStats[type]) {
        loanTypeStats[type] = { count: 0, conversions: 0 }
      }
      loanTypeStats[type].count++
      if (link.form_submitted) loanTypeStats[type].conversions++
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_links: totalLinks,
          active_links: activeLinks,
          expired_links: expiredLinks,
          total_clicks: totalClicks,
          total_opened: totalOpened,
          total_submitted: totalSubmitted,
          total_converted: totalConverted,
          avg_clicks_per_link: totalLinks > 0 ? Math.round((totalClicks / totalLinks) * 10) / 10 : 0,
        },
        funnel,
        funnel_percentages: funnelPercentages,
        daily_trend: Object.entries(dailyTrend)
          .map(([date, data]) => ({ date, ...data }))
          .reverse(),
        loan_type_breakdown: Object.entries(loanTypeStats)
          .map(([type, data]) => ({ loan_type: type, ...data }))
          .sort((a, b) => b.count - a.count),
      },
    })
  } catch (error) {
    apiLogger.error('Link analytics error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
