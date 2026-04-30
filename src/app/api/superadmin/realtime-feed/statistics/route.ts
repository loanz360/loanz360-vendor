/**
 * Real-Time Activity Feed Statistics API
 * Analytics and statistics for activity monitoring
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    // Time range parameters
    const period = searchParams.get('period') || '24h' // 1h, 6h, 24h, 7d, 30d
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Calculate date range
    let start: Date
    let end: Date = new Date()

    if (startDate && endDate) {
      start = new Date(startDate)
      end = new Date(endDate)
    } else {
      switch (period) {
        case '1h':
          start = new Date(Date.now() - 60 * 60 * 1000)
          break
        case '6h':
          start = new Date(Date.now() - 6 * 60 * 60 * 1000)
          break
        case '7d':
          start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          break
        default: // 24h
          start = new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }

    // Fetch all activities in the period for aggregation
    const { data: activities, error } = await supabase
      .from('realtime_activities')
      .select(`
        id,
        event_category,
        event_type,
        severity_level,
        status,
        actor_id,
        actor_type,
        actor_name,
        module,
        source,
        is_security_event,
        is_suspicious,
        threat_level,
        response_time_ms,
        created_at
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('[Statistics API] Query error', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }

    const data = activities || []

    // Calculate summary statistics
    const totalEvents = data.length
    const criticalEvents = data.filter(a => a.severity_level === 'critical').length
    const errorEvents = data.filter(a => a.severity_level === 'error').length
    const warningEvents = data.filter(a => a.severity_level === 'warning').length
    const infoEvents = data.filter(a => a.severity_level === 'info').length
    const securityEvents = data.filter(a => a.is_security_event).length
    const suspiciousEvents = data.filter(a => a.is_suspicious).length

    // Unique actors
    const uniqueActors = new Set(data.filter(a => a.actor_id).map(a => a.actor_id)).size

    // Status breakdown
    const statusBreakdown = {
      active: data.filter(a => a.status === 'active').length,
      acknowledged: data.filter(a => a.status === 'acknowledged').length,
      resolved: data.filter(a => a.status === 'resolved').length,
      archived: data.filter(a => a.status === 'archived').length
    }

    // Events by category
    const eventsByCategory = data.reduce((acc, a) => {
      acc[a.event_category] = (acc[a.event_category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Events by module
    const eventsByModule = data.reduce((acc, a) => {
      const module = a.module || 'unknown'
      acc[module] = (acc[module] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Events by source
    const eventsBySource = data.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Events by actor type
    const eventsByActorType = data.reduce((acc, a) => {
      const actorType = a.actor_type || 'unknown'
      acc[actorType] = (acc[actorType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Events by hour (for timeline chart)
    const eventsByHour = data.reduce((acc, a) => {
      const hour = new Date(a.created_at).toISOString().slice(0, 13) + ':00:00'
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const hourlyTimeline = Object.entries(eventsByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    // Top event types
    const eventTypeCounts = data.reduce((acc, a) => {
      acc[a.event_type] = (acc[a.event_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topEventTypes = Object.entries(eventTypeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Top actors
    const actorCounts = data.reduce((acc, a) => {
      if (a.actor_name) {
        const key = `${a.actor_name}|${a.actor_type}`
        acc[key] = (acc[key] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const topActors = Object.entries(actorCounts)
      .map(([key, count]) => {
        const [actor, actor_type] = key.split('|')
        return { actor, actor_type, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Severity distribution by hour (for heatmap)
    const severityByHour = data.reduce((acc, a) => {
      const hour = new Date(a.created_at).getHours()
      if (!acc[hour]) {
        acc[hour] = { critical: 0, error: 0, warning: 0, info: 0 }
      }
      acc[hour][a.severity_level as keyof typeof acc[typeof hour]]++
      return acc
    }, {} as Record<number, Record<string, number>>)

    // Average response time (for technical events)
    const responseTimes = data.filter(a => a.response_time_ms).map(a => a.response_time_ms!)
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null

    // Threat level distribution (for security events)
    const threatLevelDist = data.filter(a => a.is_security_event).reduce((acc, a) => {
      const level = a.threat_level || 0
      const bracket = level >= 8 ? 'critical' : level >= 5 ? 'high' : level >= 3 ? 'medium' : 'low'
      acc[bracket] = (acc[bracket] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Recent critical events
    const recentCritical = data
      .filter(a => a.severity_level === 'critical' || a.severity_level === 'error')
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        event_type: a.event_type,
        severity_level: a.severity_level,
        actor_name: a.actor_name,
        created_at: a.created_at
      }))

    return NextResponse.json({
      success: true,
      statistics: {
        summary: {
          total_events: totalEvents,
          critical_events: criticalEvents,
          error_events: errorEvents,
          warning_events: warningEvents,
          info_events: infoEvents,
          security_events: securityEvents,
          suspicious_events: suspiciousEvents,
          unique_actors: uniqueActors,
          avg_response_time_ms: avgResponseTime
        },
        status_breakdown: statusBreakdown,
        events_by_category: eventsByCategory,
        events_by_module: eventsByModule,
        events_by_source: eventsBySource,
        events_by_actor_type: eventsByActorType,
        hourly_timeline: hourlyTimeline,
        top_event_types: topEventTypes,
        top_actors: topActors,
        severity_by_hour: severityByHour,
        threat_level_distribution: threatLevelDist,
        recent_critical: recentCritical
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        label: period
      }
    })
  } catch (error) {
    apiLogger.error('[Statistics API] Exception', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
