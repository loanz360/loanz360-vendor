import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'


// ISO date regex (YYYY-MM-DD)
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

// GET - Get DSE analytics and trends
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
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month, quarter, year
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Validate date params if provided
    if (dateFrom && !isoDateRegex.test(dateFrom)) {
      return NextResponse.json({ success: false, error: 'dateFrom must be a valid ISO date (YYYY-MM-DD)' }, { status: 400 })
    }
    if (dateTo && !isoDateRegex.test(dateTo)) {
      return NextResponse.json({ success: false, error: 'dateTo must be a valid ISO date (YYYY-MM-DD)' }, { status: 400 })
    }

    // Calculate date range - avoid mutating `now`
    const now = new Date()
    let startDate: Date
    let endDate = new Date(now) // Create a copy so `now` is never mutated

    switch (period) {
      case 'day': {
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        startDate = todayStart
        break
      }
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'quarter':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case 'year':
        startDate = new Date(now)
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
    }

    if (dateFrom) startDate = new Date(dateFrom)
    if (dateTo) endDate = new Date(dateTo)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get all analytics data in parallel
    const results = await Promise.all([
      // Total customers
      supabase
        .from('dse_customers')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false),

      // New customers in period
      supabase
        .from('dse_customers')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr),

      // Visiting cards captured
      supabase
        .from('dse_customers')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .not('visiting_card_front_url', 'is', null)
        .gte('visiting_card_captured_at', startDateStr)
        .lte('visiting_card_captured_at', endDateStr),

      // Total leads
      supabase
        .from('dse_leads')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false),

      // Converted leads (Won)
      supabase
        .from('dse_leads')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false)
        .eq('lead_stage', 'Won')
        .gte('converted_at', startDateStr)
        .lte('converted_at', endDateStr),

      // Total visits in period
      supabase
        .from('dse_visits')
        .select('*', { count: 'exact', head: true })
        .eq('dse_user_id', user.id)
        .gte('visit_date', startDateStr)
        .lte('visit_date', endDateStr),

      // Total meetings in period
      supabase
        .from('dse_meetings')
        .select('*', { count: 'exact', head: true })
        .eq('organizer_id', user.id)
        .gte('scheduled_date', startDateStr)
        .lte('scheduled_date', endDateStr),

      // Daily visits trend
      supabase
        .from('dse_visits')
        .select('visit_date')
        .eq('dse_user_id', user.id)
        .gte('visit_date', startDateStr)
        .lte('visit_date', endDateStr)
        .order('visit_date', { ascending: true }),

      // Leads by stage
      supabase
        .from('dse_leads')
        .select('lead_stage, estimated_value')
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false),

      // Customers by source
      supabase
        .from('dse_customers')
        .select('source')
        .eq('dse_user_id', user.id)
        .eq('is_deleted', false),

      // Recent activity (last 10)
      supabase
        .from('dse_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    // Check for errors on individual results
    const queryNames = [
      'totalCustomers', 'newCustomers', 'visitingCards', 'totalLeads',
      'convertedLeads', 'totalVisits', 'totalMeetings', 'dailyVisits',
      'leadsByStage', 'customersBySource', 'recentActivity'
    ]
    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        apiLogger.error(`Analytics query "${queryNames[i]}" failed`, results[i].error)
      }
    }

    const [
      totalCustomersResult,
      newCustomersResult,
      visitingCardsResult,
      totalLeadsResult,
      convertedLeadsResult,
      totalVisitsResult,
      totalMeetingsResult,
      dailyVisitsResult,
      leadsByStageResult,
      customersBySourceResult,
      recentActivityResult
    ] = results

    const totalCustomers = totalCustomersResult.count
    const newCustomers = newCustomersResult.count
    const visitingCards = visitingCardsResult.count
    const totalLeads = totalLeadsResult.count
    const convertedLeads = convertedLeadsResult.count
    const totalVisits = totalVisitsResult.count
    const totalMeetings = totalMeetingsResult.count
    const dailyVisits = dailyVisitsResult.data
    const leadsByStage = leadsByStageResult.data
    const customersBySource = customersBySourceResult.data
    const recentActivity = recentActivityResult.data

    // Process daily visits into trend data
    const visitTrend: Record<string, number> = {}
    ;(dailyVisits || []).forEach((v: unknown) => {
      visitTrend[v.visit_date] = (visitTrend[v.visit_date] || 0) + 1
    })

    const visitTrendData = Object.entries(visitTrend).map(([date, count]) => ({
      date,
      visits: count
    }))

    // Process leads by stage
    const stageData: Record<string, { count: number; value: number }> = {}
    const stages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'On Hold', 'Nurturing']
    stages.forEach(stage => {
      stageData[stage] = { count: 0, value: 0 }
    })
    ;(leadsByStage || []).forEach((l: unknown) => {
      if (stageData[l.lead_stage]) {
        stageData[l.lead_stage].count++
        stageData[l.lead_stage].value += l.estimated_value || 0
      }
    })

    const pipelineData = stages.map(stage => ({
      stage,
      count: stageData[stage].count,
      value: stageData[stage].value
    }))

    // Process customers by source
    const sourceData: Record<string, number> = {}
    ;(customersBySource || []).forEach((c: unknown) => {
      sourceData[c.source] = (sourceData[c.source] || 0) + 1
    })

    const sourceDistribution = Object.entries(sourceData).map(([source, count]) => ({
      source,
      count
    }))

    // Calculate conversion rate
    const conversionRate = totalLeads && totalLeads > 0
      ? ((convertedLeads || 0) / totalLeads * 100).toFixed(1)
      : '0'

    // Calculate total pipeline value
    const totalPipelineValue = (leadsByStage || [])
      .filter((l: unknown) => !['Won', 'Lost'].includes(l.lead_stage))
      .reduce((sum: number, l: unknown) => sum + (l.estimated_value || 0), 0)

    // Calculate won value
    const wonValue = (leadsByStage || [])
      .filter((l: unknown) => l.lead_stage === 'Won')
      .reduce((sum: number, l: unknown) => sum + (l.estimated_value || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCustomers: totalCustomers || 0,
          newCustomers: newCustomers || 0,
          visitingCardsCaptured: visitingCards || 0,
          totalLeads: totalLeads || 0,
          convertedLeads: convertedLeads || 0,
          totalVisits: totalVisits || 0,
          totalMeetings: totalMeetings || 0,
          conversionRate: parseFloat(conversionRate),
          totalPipelineValue,
          wonValue
        },
        trends: {
          visitTrend: visitTrendData
        },
        pipeline: pipelineData,
        sourceDistribution,
        recentActivity: recentActivity || [],
        period: {
          start: startDateStr,
          end: endDateStr,
          type: period
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching analytics', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
