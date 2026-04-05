export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import { apiLogger } from '@/lib/utils/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceAlert {
  id: string
  type: 'milestone' | 'warning' | 'opportunity' | 'celebration'
  title: string
  message: string
  action_label?: string
  action_url?: string
  created_at: string
  is_read: boolean
}

// ---------------------------------------------------------------------------
// Alert Thresholds
// ---------------------------------------------------------------------------

const DAILY_CALL_MILESTONES = [50, 100, 150, 200]
const CONVERSION_WARNING_THRESHOLD = 15 // percent
const HIGH_VALUE_FOLLOWUP_THRESHOLD = 3

// ---------------------------------------------------------------------------
// GET - Fetch performance alerts for current CRO
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const alerts: PerformanceAlert[] = []
    let alertIndex = 0

    // -----------------------------------------------------------------------
    // 1. Check daily metrics for milestones and warnings
    // -----------------------------------------------------------------------

    let todayMetrics: Record<string, any> | null = null
    let monthlyMetrics: Record<string, any>[] = []

    try {
      const { data: todayData } = await supabase
        .from('cro_daily_metrics')
        .select('*')
        .eq('cro_id', user.id)
        .eq('date', today)
        .maybeSingle()

      todayMetrics = todayData

      const { data: monthData } = await supabase
        .from('cro_daily_metrics')
        .select('*')
        .eq('cro_id', user.id)
        .gte('date', startOfMonth)
        .lte('date', today)
        .order('date', { ascending: true })

      monthlyMetrics = monthData || []
    } catch {
      // Tables may not exist - continue with empty data
    }

    // --- Daily call milestones ---
    if (todayMetrics) {
      const todayCalls = todayMetrics.calls_made || 0
      for (const milestone of DAILY_CALL_MILESTONES) {
        if (todayCalls >= milestone) {
          alerts.push({
            id: `milestone-calls-${milestone}-${alertIndex++}`,
            type: 'milestone',
            title: 'Call Milestone Reached!',
            message: `You reached ${milestone} calls today! Keep up the great work.`,
            action_label: 'View Dashboard',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }
      }
      // Keep only the highest milestone
      const callMilestones = alerts.filter(a => a.id.startsWith('milestone-calls-'))
      if (callMilestones.length > 1) {
        const keep = callMilestones[callMilestones.length - 1]
        for (const a of callMilestones) {
          if (a.id !== keep.id) {
            const idx = alerts.indexOf(a)
            if (idx > -1) alerts.splice(idx, 1)
          }
        }
      }
    }

    // --- Conversion rate warning ---
    if (monthlyMetrics.length > 0) {
      const totalLeadsGenerated = monthlyMetrics.reduce(
        (sum, d) => sum + (d.leads_generated || 0), 0
      )
      const totalLeadsConverted = monthlyMetrics.reduce(
        (sum, d) => sum + (d.leads_converted || 0), 0
      )
      const conversionRate = totalLeadsGenerated > 0
        ? (totalLeadsConverted / totalLeadsGenerated) * 100
        : 0

      if (totalLeadsGenerated >= 10 && conversionRate < CONVERSION_WARNING_THRESHOLD) {
        alerts.push({
          id: `warning-conversion-${alertIndex++}`,
          type: 'warning',
          title: 'Low Conversion Rate',
          message: `Conversion rate dropped to ${conversionRate.toFixed(1)}% (below ${CONVERSION_WARNING_THRESHOLD}%). Review your lead quality and follow-up strategy.`,
          action_label: 'View Insights',
          action_url: '/employees/cro/performance',
          created_at: now.toISOString(),
          is_read: false,
        })
      }
    }

    // --- Follow-up opportunity alerts ---
    if (todayMetrics) {
      const followupsDue = todayMetrics.followups_scheduled || 0
      const followupsCompleted = todayMetrics.followups_completed || 0
      const pending = followupsDue - followupsCompleted

      if (pending >= HIGH_VALUE_FOLLOWUP_THRESHOLD) {
        alerts.push({
          id: `opportunity-followups-${alertIndex++}`,
          type: 'opportunity',
          title: 'Follow-ups Due Today',
          message: `${pending} follow-ups due today - prioritize high-value leads to boost conversions.`,
          action_label: 'View Leads',
          action_url: '/employees/cro/leads',
          created_at: now.toISOString(),
          is_read: false,
        })
      }
    }

    // -----------------------------------------------------------------------
    // 2. Check target completion milestones
    // -----------------------------------------------------------------------

    try {
      const { data: targetData } = await supabase
        .from('cro_targets')
        .select('*')
        .eq('cro_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle()

      if (targetData && monthlyMetrics.length > 0) {
        const totalCalls = monthlyMetrics.reduce(
          (sum, d) => sum + (d.calls_made || 0), 0
        )
        const totalRevenue = monthlyMetrics.reduce(
          (sum, d) => sum + (d.revenue_generated || 0), 0
        )
        const totalDisbursed = monthlyMetrics.reduce(
          (sum, d) => sum + (d.cases_disbursed || 0), 0
        )

        // Calls target achieved
        if (targetData.calls_target && totalCalls >= targetData.calls_target) {
          alerts.push({
            id: `milestone-target-calls-${alertIndex++}`,
            type: 'milestone',
            title: 'Monthly Call Target Achieved!',
            message: `You've hit your monthly call target of ${targetData.calls_target} calls! Outstanding performance.`,
            action_label: 'View Goals',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }

        // Revenue target achieved
        if (targetData.revenue_target && totalRevenue >= targetData.revenue_target) {
          alerts.push({
            id: `milestone-target-revenue-${alertIndex++}`,
            type: 'milestone',
            title: 'Revenue Target Achieved!',
            message: `Monthly revenue target reached! You've generated outstanding results this month.`,
            action_label: 'View Incentives',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }

        // Disbursement target achieved
        if (targetData.disbursement_target && totalDisbursed >= targetData.disbursement_target) {
          alerts.push({
            id: `milestone-target-disbursed-${alertIndex++}`,
            type: 'milestone',
            title: 'Disbursement Target Hit!',
            message: `You've met your monthly disbursement target of ${targetData.disbursement_target} cases!`,
            action_label: 'View Performance',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }
      }
    } catch {
      // cro_targets table may not exist
    }

    // -----------------------------------------------------------------------
    // 3. Check rank improvements (celebration)
    // -----------------------------------------------------------------------

    try {
      const { data: summaryData } = await supabase
        .from('cro_monthly_summary')
        .select('company_rank, previous_rank')
        .eq('cro_id', user.id)
        .eq('month', currentMonth)
        .maybeSingle()

      if (summaryData) {
        const currentRank = summaryData.company_rank || 0
        const previousRank = summaryData.previous_rank || 0

        if (currentRank > 0 && previousRank > 0 && currentRank < previousRank) {
          alerts.push({
            id: `celebration-rank-${alertIndex++}`,
            type: 'celebration',
            title: 'Rank Improvement!',
            message: `You're now #${currentRank} in company ranking! Moved up from #${previousRank}.`,
            action_label: 'View Leaderboard',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }

        if (currentRank === 1) {
          alerts.push({
            id: `celebration-top-rank-${alertIndex++}`,
            type: 'celebration',
            title: 'You\'re #1!',
            message: `Congratulations! You\'re the top performer in the company this month!`,
            action_label: 'View Leaderboard',
            action_url: '/employees/cro/performance',
            created_at: now.toISOString(),
            is_read: false,
          })
        }
      }
    } catch {
      // cro_monthly_summary may not have rank columns
    }

    // -----------------------------------------------------------------------
    // 4. Check for dismissed alerts from cro_alert_dismissals
    // -----------------------------------------------------------------------

    try {
      const { data: dismissals } = await supabase
        .from('cro_alert_dismissals')
        .select('alert_id')
        .eq('cro_id', user.id)
        .gte('dismissed_at', startOfMonth)

      if (dismissals && dismissals.length > 0) {
        const dismissedIds = new Set(dismissals.map(d => d.alert_id))
        // Mark dismissed alerts as read
        for (const alert of alerts) {
          if (dismissedIds.has(alert.id)) {
            alert.is_read = true
          }
        }
      }
    } catch {
      // Table may not exist - all alerts remain unread
    }

    // Sort: unread first, then by type priority
    const typePriority = { warning: 0, opportunity: 1, milestone: 2, celebration: 3 }
    alerts.sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read ? 1 : -1
      return typePriority[a.type] - typePriority[b.type]
    })

    const unreadCount = alerts.filter(a => !a.is_read).length

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        unread_count: unreadCount,
      },
    })
  } catch (error) {
    apiLogger.error('Error fetching performance alerts', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance alerts' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH - Mark alert(s) as read / dismissed
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const body = await request.json()
    const { alert_ids } = body as { alert_ids: string[] }

    if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'alert_ids array is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Try to insert dismissals into cro_alert_dismissals table
    try {
      const dismissals = alert_ids.map(alertId => ({
        cro_id: user.id,
        alert_id: alertId,
        dismissed_at: new Date().toISOString(),
      }))

      await supabase
        .from('cro_alert_dismissals')
        .upsert(dismissals, { onConflict: 'cro_id,alert_id' })
    } catch {
      // Table may not exist - silently accept the dismissal on client side
    }

    return NextResponse.json({
      success: true,
      message: `${alert_ids.length} alert(s) dismissed`,
    })
  } catch (error) {
    apiLogger.error('Error dismissing alerts', error)
    return NextResponse.json(
      { success: false, error: 'Failed to dismiss alerts' },
      { status: 500 }
    )
  }
}
