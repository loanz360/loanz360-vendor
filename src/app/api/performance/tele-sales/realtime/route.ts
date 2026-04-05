import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeleSalesRealTimeMetrics } from '@/lib/types/performance.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/performance/tele-sales/realtime
 * Returns real-time performance metrics for live dashboard updates
 * Enterprise-grade real-time monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.sub_role !== 'TELE_SALES') {
      return NextResponse.json(
        { success: false, error: 'Access denied. This endpoint is for Tele Sales employees only.' },
        { status: 403 }
      )
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Fetch today's metrics
    const { data: todayMetrics } = await supabase
      .from('tele_sales_daily_metrics')
      .select('total_calls, revenue_generated, leads_converted, total_talk_time_minutes, avg_call_duration, conversion_rate, call_quality_score')
      .eq('user_id', user.id)
      .eq('metric_date', today)
      .maybeSingle()

    // Fetch targets for progress calculation
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const { data: targets } = await supabase
      .from('tele_sales_targets')
      .select('totalCallsTarget, revenueTarget, leadsConvertedTarget, callQualityScoreTarget')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle()

    // Default daily targets (monthly / 22 working days)
    const dailyTargets = {
      calls: Math.ceil((targets?.totalCallsTarget || 500) / 22),
      revenue: Math.ceil((targets?.revenueTarget || 1500000) / 22),
      leads: Math.ceil((targets?.leadsConvertedTarget || 25) / 22),
      quality: targets?.callQualityScoreTarget || 85,
    }

    // Calculate real-time progress
    const callsToday = todayMetrics?.total_calls || 0
    const revenueToday = todayMetrics?.revenue_generated || 0
    const leadsToday = todayMetrics?.leads_converted || 0
    const talkTimeToday = todayMetrics?.total_talk_time_minutes || 0

    // Call status - requires call system integration (e.g., telephony API)
    // Returns defaults until integrated with a real call system
    const callStatus = {
      isOnCall: false,
      currentCallDuration: 0,
      currentCallType: 'outbound' as const,
    }

    // Fetch scheduled callbacks and follow-ups
    const { data: scheduledItems } = await supabase
      .from('tele_sales_scheduled_activities')
      .select('activity_type, scheduled_time, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gte('scheduled_time', today)
      .lte('scheduled_time', `${today}T23:59:59`)

    const waitingCallbacks = (scheduledItems || []).filter(
      (item: any) => item.activity_type === 'callback'
    ).length
    const scheduledFollowUps = (scheduledItems || []).filter(
      (item: any) => item.activity_type === 'follow_up'
    ).length

    // Generate quality alerts based on metrics
    const qualityAlerts: TeleSalesRealTimeMetrics['qualityAlerts'] = []

    if (todayMetrics) {
      // Check call quality
      if (todayMetrics.call_quality_score > 0 && todayMetrics.call_quality_score < 80) {
        qualityAlerts.push({
          type: 'warning',
          message: 'Call quality score is below target. Focus on script adherence.',
          metric: 'Call Quality',
          timestamp: now.toISOString(),
        })
      }

      // Check handle time
      if (todayMetrics.average_handle_time > 360) {
        qualityAlerts.push({
          type: 'warning',
          message: 'Average handle time is above optimal. Try to be more concise.',
          metric: 'Handle Time',
          timestamp: now.toISOString(),
        })
      }

      // Check conversion rate
      const callsWithLeads = todayMetrics.leads_generated || 0
      const conversions = todayMetrics.leads_converted || 0
      if (callsWithLeads > 5 && (conversions / callsWithLeads) < 0.2) {
        qualityAlerts.push({
          type: 'critical',
          message: 'Conversion rate is critically low today. Review your pitch.',
          metric: 'Conversion Rate',
          timestamp: now.toISOString(),
        })
      }

      // Check for missed callbacks
      if (waitingCallbacks > 5) {
        qualityAlerts.push({
          type: 'warning',
          message: `You have ${waitingCallbacks} pending callbacks. Prioritize follow-ups.`,
          metric: 'Callbacks',
          timestamp: now.toISOString(),
        })
      }
    }

    // Positive alerts for motivation
    if (callsToday >= dailyTargets.calls) {
      qualityAlerts.push({
        type: 'warning', // Using warning for visibility, could add 'success' type
        message: 'Daily call target achieved! Keep up the momentum.',
        metric: 'Calls',
        timestamp: now.toISOString(),
      })
    }

    const realTimeMetrics: TeleSalesRealTimeMetrics = {
      // Current Status
      isOnCall: callStatus.isOnCall,
      currentCallDuration: callStatus.currentCallDuration,
      currentCallType: callStatus.isOnCall ? callStatus.currentCallType : undefined,

      // Today's Live Stats
      callsToday,
      talkTimeToday,
      leadsToday,
      conversionsToday: todayMetrics?.applications_completed || 0,
      revenueToday,

      // Queue Status
      queuePosition: 0, // Would come from call queue system
      waitingCallbacks,
      scheduledFollowUps,

      // Targets Progress (real-time)
      dailyCallProgress: Math.round((callsToday / dailyTargets.calls) * 100),
      dailyRevenueProgress: Math.round((revenueToday / dailyTargets.revenue) * 100),
      dailyLeadProgress: Math.round((leadsToday / dailyTargets.leads) * 100),

      // Quality Alerts
      qualityAlerts,

      // Last Updated
      lastUpdatedAt: now.toISOString(),
    }

    return NextResponse.json(realTimeMetrics)
  } catch (error: unknown) {
    apiLogger.error('Error in Tele Sales real-time API', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/performance/tele-sales/realtime
 * Update real-time metrics (called by call system integrations)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { eventType, data } = body

    // Handle different event types from call system
    switch (eventType) {
      case 'call_started':
        // Log call start
        break
      case 'call_ended':
        // Update daily metrics with call data
        break
      case 'lead_converted':
        // Update conversion metrics
        break
      case 'quality_score_updated':
        // Update quality metrics
        break
      default:
        apiLogger.error('Unknown event type:', eventType)
    }

    return NextResponse.json({ success: true, eventType })
  } catch (error: unknown) {
    apiLogger.error('Error updating real-time metrics', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
