
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/unified-tickets/analytics
 * Comprehensive analytics across all ticket sources
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Only Super Admin can access unified analytics
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!superAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d' // 7d, 30d, 90d, 365d, all
    const source = searchParams.get('source') // EMPLOYEE, CUSTOMER, PARTNER, or all

    // Calculate date range
    let dateFilter = ''
    const now = new Date()
    if (period !== 'all') {
      const days = parseInt(period.replace('d', ''))
      const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      dateFilter = fromDate.toISOString()
    }

    // Initialize analytics object
    const analytics: any = {
      overview: {
        total_tickets: 0,
        open_tickets: 0,
        resolved_tickets: 0,
        avg_resolution_hours: 0,
        avg_response_hours: 0,
        sla_compliance_rate: 0,
        customer_satisfaction: 0
      },
      by_source: {
        EMPLOYEE: { total: 0, open: 0, resolved: 0 },
        CUSTOMER: { total: 0, open: 0, resolved: 0 },
        PARTNER: { total: 0, open: 0, resolved: 0 }
      },
      by_priority: {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      by_status: {},
      by_category: {},
      by_department: {},
      trends: {
        daily: [] as any[],
        weekly: [] as any[]
      },
      sla: {
        total_tracked: 0,
        breached: 0,
        met: 0,
        at_risk: 0,
        compliance_rate: 0
      },
      resolution_times: {
        by_priority: {} as Record<string, number>,
        by_source: {} as Record<string, number>
      },
      top_categories: [] as any[],
      agent_performance: [] as any[]
    }

    // Helper to apply date filter
    const applyDateFilter = (query: any) => {
      if (dateFilter) {
        return query.gte('created_at', dateFilter)
      }
      return query
    }

    // Fetch Employee Tickets
    if (!source || source === 'EMPLOYEE') {
      let query = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' })

      query = applyDateFilter(query)
      const { data: empTickets, count } = await query

      if (empTickets) {
        analytics.by_source.EMPLOYEE.total = count || 0
        analytics.by_source.EMPLOYEE.open = empTickets.filter((t: any) =>
          ['open', 'in_progress', 'on_hold'].includes(t.status)
        ).length
        analytics.by_source.EMPLOYEE.resolved = empTickets.filter((t: any) =>
          ['resolved', 'closed'].includes(t.status)
        ).length

        empTickets.forEach((t: any) => {
          analytics.by_priority[t.priority] = (analytics.by_priority[t.priority] || 0) + 1
          analytics.by_status[t.status] = (analytics.by_status[t.status] || 0) + 1
          analytics.by_category[t.category] = (analytics.by_category[t.category] || 0) + 1
        })
      }
    }

    // Fetch Customer Tickets
    if (!source || source === 'CUSTOMER') {
      let query = supabase
        .from('customer_support_tickets')
        .select('*', { count: 'exact' })

      query = applyDateFilter(query)
      const { data: custTickets, count } = await query

      if (custTickets) {
        analytics.by_source.CUSTOMER.total = count || 0
        analytics.by_source.CUSTOMER.open = custTickets.filter((t: any) =>
          ['new', 'in_progress', 'pending_customer'].includes(t.status)
        ).length
        analytics.by_source.CUSTOMER.resolved = custTickets.filter((t: any) =>
          ['resolved', 'closed'].includes(t.status)
        ).length

        let totalResolutionTime = 0
        let resolutionCount = 0
        let totalResponseTime = 0
        let responseCount = 0
        let satisfactionTotal = 0
        let satisfactionCount = 0
        let slaBreached = 0
        let slaMet = 0

        custTickets.forEach((t: any) => {
          analytics.by_priority[t.priority] = (analytics.by_priority[t.priority] || 0) + 1
          analytics.by_status[t.status] = (analytics.by_status[t.status] || 0) + 1
          analytics.by_category[t.category] = (analytics.by_category[t.category] || 0) + 1
          if (t.routed_to_department) {
            analytics.by_department[t.routed_to_department] =
              (analytics.by_department[t.routed_to_department] || 0) + 1
          }

          if (t.resolution_time_hours) {
            totalResolutionTime += t.resolution_time_hours
            resolutionCount++
          }
          if (t.response_time_hours) {
            totalResponseTime += t.response_time_hours
            responseCount++
          }
          if (t.satisfaction_rating) {
            satisfactionTotal += t.satisfaction_rating
            satisfactionCount++
          }
          if (t.sla_breached === true) slaBreached++
          else if (t.sla_deadline && t.status === 'resolved') slaMet++
        })

        // Update SLA stats
        analytics.sla.breached += slaBreached
        analytics.sla.met += slaMet
        analytics.sla.total_tracked += slaBreached + slaMet

        // Calculate averages
        if (resolutionCount > 0) {
          analytics.resolution_times.by_source.CUSTOMER = totalResolutionTime / resolutionCount
        }
        if (satisfactionCount > 0) {
          analytics.overview.customer_satisfaction = satisfactionTotal / satisfactionCount
        }
      }
    }

    // Fetch Partner Tickets
    if (!source || source === 'PARTNER') {
      let query = supabase
        .from('partner_support_tickets')
        .select('*', { count: 'exact' })

      query = applyDateFilter(query)
      const { data: partnerTickets, count } = await query

      if (partnerTickets) {
        analytics.by_source.PARTNER.total = count || 0
        analytics.by_source.PARTNER.open = partnerTickets.filter((t: any) =>
          ['new', 'assigned', 'in_progress', 'pending_partner', 'pending_internal'].includes(t.status)
        ).length
        analytics.by_source.PARTNER.resolved = partnerTickets.filter((t: any) =>
          ['resolved', 'closed'].includes(t.status)
        ).length

        let slaBreached = 0
        let slaMet = 0
        let totalResolutionTime = 0
        let resolutionCount = 0

        partnerTickets.forEach((t: any) => {
          analytics.by_priority[t.priority] = (analytics.by_priority[t.priority] || 0) + 1
          analytics.by_status[t.status] = (analytics.by_status[t.status] || 0) + 1
          analytics.by_category[t.category] = (analytics.by_category[t.category] || 0) + 1
          if (t.routed_to_department) {
            analytics.by_department[t.routed_to_department] =
              (analytics.by_department[t.routed_to_department] || 0) + 1
          }

          if (t.sla_breached === true) slaBreached++
          else if (t.sla_deadline && t.status === 'resolved') slaMet++

          if (t.resolution_time_hours) {
            totalResolutionTime += t.resolution_time_hours
            resolutionCount++
          }
        })

        analytics.sla.breached += slaBreached
        analytics.sla.met += slaMet
        analytics.sla.total_tracked += slaBreached + slaMet

        if (resolutionCount > 0) {
          analytics.resolution_times.by_source.PARTNER = totalResolutionTime / resolutionCount
        }
      }
    }

    // Calculate overview totals
    analytics.overview.total_tickets =
      analytics.by_source.EMPLOYEE.total +
      analytics.by_source.CUSTOMER.total +
      analytics.by_source.PARTNER.total

    analytics.overview.open_tickets =
      analytics.by_source.EMPLOYEE.open +
      analytics.by_source.CUSTOMER.open +
      analytics.by_source.PARTNER.open

    analytics.overview.resolved_tickets =
      analytics.by_source.EMPLOYEE.resolved +
      analytics.by_source.CUSTOMER.resolved +
      analytics.by_source.PARTNER.resolved

    // Calculate SLA compliance rate
    if (analytics.sla.total_tracked > 0) {
      analytics.sla.compliance_rate = (analytics.sla.met / analytics.sla.total_tracked) * 100
      analytics.overview.sla_compliance_rate = analytics.sla.compliance_rate
    }

    // Sort and limit top categories
    analytics.top_categories = Object.entries(analytics.by_category)
      .map(([category, count]) => ({ category, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)

    // Generate daily trends (last 30 days)
    const days = Math.min(parseInt(period.replace('d', '')) || 30, 30)
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      analytics.trends.daily.push({
        date: dateStr,
        created: 0,
        resolved: 0
      })
    }

    // Fetch agent performance (top 10)
    const { data: agentStats } = await supabase
      .from('agent_daily_metrics')
      .select('*')
      .gte('metric_date', dateFilter || '2000-01-01')
      .order('tickets_resolved', { ascending: false })
      .limit(10)

    if (agentStats) {
      // Aggregate by agent
      const agentMap = new Map()
      agentStats.forEach((s: any) => {
        if (!agentMap.has(s.agent_id)) {
          agentMap.set(s.agent_id, {
            agent_id: s.agent_id,
            tickets_resolved: 0,
            tickets_assigned: 0,
            avg_resolution_minutes: 0,
            sla_met: 0,
            sla_breached: 0
          })
        }
        const agent = agentMap.get(s.agent_id)
        agent.tickets_resolved += s.tickets_resolved
        agent.tickets_assigned += s.tickets_assigned
        agent.sla_met += s.sla_met_count
        agent.sla_breached += s.sla_breached_count
      })
      analytics.agent_performance = Array.from(agentMap.values()).slice(0, 10)
    }

    return NextResponse.json({
      success: true,
      period,
      generated_at: new Date().toISOString(),
      analytics
    })
  } catch (error) {
    apiLogger.error('API Error', error)
    logApiError(error as Error, request, { action: 'getUnifiedAnalytics' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
