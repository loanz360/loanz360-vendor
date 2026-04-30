
/**
 * BDM Team Pipeline - BDE Recommendations API
 * GET /api/bdm/team-pipeline/bde-performance/recommendations
 *
 * AI-powered recommendations for improving BDE performance
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds, getBDEsByIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const bdeId = searchParams.get('bdeId')
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)

    // 3. Verify BDE access
    const bdeIds = await getBDEIds(bdmId)

    if (bdeId && !bdeIds.includes(bdeId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDE not under your management' },
        { status: 403 }
      )
    }

    const targetBdeIds = bdeId ? [bdeId] : bdeIds

    if (targetBdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { recommendations: [] },
      })
    }

    // 4. Get BDE details
    const bdes = await getBDEsByIds(targetBdeIds)

    // 5. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 6. Fetch performance data for analysis
    const { data: leads } = await supabase
      .from('leads')
      .select('id, assigned_to, status, priority, loan_amount, loan_type, created_at, updated_at, days_in_current_stage, last_activity_at')
      .in('assigned_to', targetBdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    // 7. Fetch timeline events
    const { data: timelineEvents } = await supabase
      .from('lead_timeline_events')
      .select('id, performed_by, event_type, created_at, lead_id')
      .in('performed_by', targetBdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    // 8. Fetch alerts
    const { data: alerts } = await supabase
      .from('pipeline_alerts')
      .select('id, bde_user_id, alert_type, severity, is_resolved')
      .in('bde_user_id', targetBdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    // 9. Generate recommendations for each BDE
    const recommendations = bdes.map(bde => {
      const bdeLeads = leads?.filter(l => l.assigned_to === bde.id) || []
      const bdeEvents = timelineEvents?.filter(e => e.performed_by === bde.id) || []
      const bdeAlerts = alerts?.filter(a => a.bde_user_id === bde.id) || []

      // Analyze performance
      const analysis = analyzePerformance(bde, bdeLeads, bdeEvents, bdeAlerts)

      // Generate recommendations based on analysis
      const bdeRecommendations = generateRecommendations(analysis)

      return {
        bdeId: bde.id,
        bdeName: bde.full_name,
        bdeEmail: bde.email,
        recommendations: bdeRecommendations,
        performanceScore: analysis.performanceScore,
        strengthsCount: bdeRecommendations.filter(r => r.type === 'strength').length,
        improvementsCount: bdeRecommendations.filter(r => r.type === 'improvement').length,
        actionsCount: bdeRecommendations.filter(r => r.type === 'action').length,
      }
    })

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        filters: {
          dateRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            type: range,
          },
          bdeId,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Recommendations API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate recommendations',
      },
      { status: 500 }
    )
  }
}

// Helper functions
function analyzePerformance(bde: any, leads: any[], events: any[], alerts: any[]) {
  const totalLeads = leads.length
  const conversions = leads.filter(l => l.status === 'DISBURSED').length
  const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0
  const revenue = leads.filter(l => l.status === 'DISBURSED').reduce((sum, l) => sum + (l.loan_amount || 0), 0)

  // Activity analysis
  const totalActivities = events.length
  const avgActivitiesPerLead = totalLeads > 0 ? totalActivities / totalLeads : 0
  const notesCount = events.filter(e => e.event_type === 'NOTE_ADDED').length
  const callsCount = events.filter(e => e.event_type === 'CALL_LOGGED').length
  const documentsCount = events.filter(e => e.event_type === 'DOCUMENT_UPLOADED').length

  // Response time analysis
  const leadActivities = new Map<string, any[]>()
  events.forEach(event => {
    if (!leadActivities.has(event.lead_id)) {
      leadActivities.set(event.lead_id, [])
    }
    leadActivities.get(event.lead_id)!.push(event)
  })

  let totalResponseTime = 0
  let responseCount = 0
  leads.forEach(lead => {
    const leadEvents = leadActivities.get(lead.id) || []
    if (leadEvents.length > 0) {
      const firstEvent = leadEvents.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
      const responseTime = (new Date(firstEvent.created_at).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60)
      totalResponseTime += responseTime
      responseCount++
    }
  })
  const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0

  // Stage analysis
  const staleLeads = leads.filter(l => (l.days_in_current_stage || 0) > 7).length
  const staleRate = totalLeads > 0 ? (staleLeads / totalLeads) * 100 : 0

  const newLeads = leads.filter(l => l.status === 'NEW').length
  const contactedLeads = leads.filter(l => l.status === 'CONTACTED').length
  const docsPendingLeads = leads.filter(l => l.status === 'DOCUMENTS_PENDING').length
  const rejectedLeads = leads.filter(l => l.status === 'REJECTED').length
  const rejectionRate = totalLeads > 0 ? (rejectedLeads / totalLeads) * 100 : 0

  // Alert analysis
  const unresolvedAlerts = alerts.filter(a => !a.is_resolved).length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length

  // Priority handling
  const criticalLeads = leads.filter(l => l.priority === 'CRITICAL').length
  const highPriorityLeads = leads.filter(l => l.priority === 'HIGH').length

  // Calculate performance score
  const performanceScore = calculatePerformanceScore({
    conversionRate,
    avgActivitiesPerLead,
    staleRate,
    avgResponseTime,
    rejectionRate,
  })

  return {
    totalLeads,
    conversions,
    conversionRate,
    revenue,
    totalActivities,
    avgActivitiesPerLead,
    notesCount,
    callsCount,
    documentsCount,
    avgResponseTime,
    staleLeads,
    staleRate,
    newLeads,
    contactedLeads,
    docsPendingLeads,
    rejectedLeads,
    rejectionRate,
    unresolvedAlerts,
    criticalAlerts,
    criticalLeads,
    highPriorityLeads,
    performanceScore,
  }
}

function generateRecommendations(analysis: any) {
  const recommendations = []

  // Conversion rate recommendations
  if (analysis.conversionRate > 35) {
    recommendations.push({
      type: 'strength',
      category: 'conversion',
      title: 'Excellent Conversion Rate',
      description: `Your conversion rate of ${analysis.conversionRate.toFixed(1)}% is above average. Keep up the great work!`,
      impact: 'high',
      priority: 'low',
      icon: 'thumbs-up',
      color: '#10B981',
    })
  } else if (analysis.conversionRate < 20 && analysis.totalLeads > 10) {
    recommendations.push({
      type: 'improvement',
      category: 'conversion',
      title: 'Improve Conversion Rate',
      description: `Your conversion rate of ${analysis.conversionRate.toFixed(1)}% is below average. Focus on qualifying leads better and improving follow-up.`,
      impact: 'high',
      priority: 'high',
      icon: 'alert-circle',
      color: '#EF4444',
    })

    recommendations.push({
      type: 'action',
      category: 'conversion',
      title: 'Action: Review Lead Qualification',
      description: 'Review your lead qualification criteria. Focus on leads that match your best-converting profile.',
      impact: 'high',
      priority: 'high',
      icon: 'target',
      color: '#F59E0B',
      actionItems: [
        'Analyze characteristics of successfully converted leads',
        'Create a lead scoring checklist',
        'Prioritize high-score leads for follow-up',
      ],
    })
  }

  // Activity level recommendations
  if (analysis.avgActivitiesPerLead < 2 && analysis.totalLeads > 5) {
    recommendations.push({
      type: 'improvement',
      category: 'activity',
      title: 'Increase Activity Level',
      description: `Average of ${analysis.avgActivitiesPerLead.toFixed(1)} activities per lead is low. More frequent touchpoints improve conversion.`,
      impact: 'high',
      priority: 'high',
      icon: 'activity',
      color: '#EF4444',
    })

    recommendations.push({
      type: 'action',
      category: 'activity',
      title: 'Action: Implement Follow-up Schedule',
      description: 'Create a systematic follow-up schedule for each lead stage.',
      impact: 'high',
      priority: 'high',
      icon: 'calendar',
      color: '#F59E0B',
      actionItems: [
        'Day 1: Initial contact within 1 hour',
        'Day 2: Follow-up call if no response',
        'Day 3-7: Regular check-ins every 2 days',
        'Weekly: Status update and next steps',
      ],
    })
  } else if (analysis.avgActivitiesPerLead > 5) {
    recommendations.push({
      type: 'strength',
      category: 'activity',
      title: 'High Activity Level',
      description: `Excellent engagement with ${analysis.avgActivitiesPerLead.toFixed(1)} activities per lead. Your follow-up is thorough.`,
      impact: 'medium',
      priority: 'low',
      icon: 'thumbs-up',
      color: '#10B981',
    })
  }

  // Response time recommendations
  if (analysis.avgResponseTime > 24) {
    recommendations.push({
      type: 'improvement',
      category: 'responsiveness',
      title: 'Improve Response Time',
      description: `Average response time of ${analysis.avgResponseTime.toFixed(1)} hours is too slow. Aim for under 2 hours.`,
      impact: 'high',
      priority: 'critical',
      icon: 'clock',
      color: '#DC2626',
    })

    recommendations.push({
      type: 'action',
      category: 'responsiveness',
      title: 'Action: Set Response Time Goals',
      description: 'Prioritize quick initial response to new leads.',
      impact: 'high',
      priority: 'critical',
      icon: 'zap',
      color: '#DC2626',
      actionItems: [
        'Check for new leads every 30 minutes',
        'Respond to critical leads within 1 hour',
        'Respond to high-priority leads within 2 hours',
        'Use templates for faster initial responses',
      ],
    })
  } else if (analysis.avgResponseTime < 2) {
    recommendations.push({
      type: 'strength',
      category: 'responsiveness',
      title: 'Excellent Response Time',
      description: `Outstanding response time of ${analysis.avgResponseTime.toFixed(1)} hours. Quick responses build trust.`,
      impact: 'high',
      priority: 'low',
      icon: 'zap',
      color: '#10B981',
    })
  }

  // Stale leads recommendations
  if (analysis.staleRate > 30) {
    recommendations.push({
      type: 'improvement',
      category: 'pipeline_health',
      title: 'Too Many Stale Leads',
      description: `${analysis.staleRate.toFixed(0)}% of leads are stale (7+ days in stage). Move them forward or close them.`,
      impact: 'medium',
      priority: 'high',
      icon: 'alert-triangle',
      color: '#F59E0B',
    })

    recommendations.push({
      type: 'action',
      category: 'pipeline_health',
      title: 'Action: Clean Up Stale Leads',
      description: 'Review and act on leads stuck in the same stage.',
      impact: 'medium',
      priority: 'high',
      icon: 'refresh-cw',
      color: '#F59E0B',
      actionItems: [
        `Review ${analysis.staleLeads} stale leads this week`,
        'Move forward or mark as rejected/on-hold',
        'Set reminders for pending actions',
        'Update lead status with current information',
      ],
    })
  }

  // Documentation recommendations
  if (analysis.documentsCount < analysis.totalLeads * 0.3 && analysis.totalLeads > 5) {
    recommendations.push({
      type: 'improvement',
      category: 'documentation',
      title: 'Improve Documentation',
      description: 'Document uploads are low. Better documentation speeds up approvals.',
      impact: 'medium',
      priority: 'medium',
      icon: 'file-text',
      color: '#3B82F6',
    })

    recommendations.push({
      type: 'action',
      category: 'documentation',
      title: 'Action: Document Collection Drive',
      description: 'Focus on collecting and uploading required documents.',
      impact: 'medium',
      priority: 'medium',
      icon: 'upload',
      color: '#3B82F6',
      actionItems: [
        'Send document checklist to all active leads',
        'Follow up on missing documents daily',
        'Upload documents within 24 hours of receipt',
        'Use document templates to speed up collection',
      ],
    })
  }

  // Rejection rate recommendations
  if (analysis.rejectionRate > 25 && analysis.totalLeads > 10) {
    recommendations.push({
      type: 'improvement',
      category: 'quality',
      title: 'High Rejection Rate',
      description: `${analysis.rejectionRate.toFixed(0)}% rejection rate suggests lead quality issues. Better qualification needed.`,
      impact: 'high',
      priority: 'high',
      icon: 'x-circle',
      color: '#EF4444',
    })

    recommendations.push({
      type: 'action',
      category: 'quality',
      title: 'Action: Improve Lead Qualification',
      description: 'Screen leads better before submission to reduce rejections.',
      impact: 'high',
      priority: 'high',
      icon: 'filter',
      color: '#EF4444',
      actionItems: [
        'Analyze reasons for recent rejections',
        'Create pre-qualification checklist',
        'Verify customer eligibility before proceeding',
        'Focus on leads matching bank criteria',
      ],
    })
  }

  // Alert management recommendations
  if (analysis.unresolvedAlerts > 5) {
    recommendations.push({
      type: 'improvement',
      category: 'alert_management',
      title: 'Address Pending Alerts',
      description: `You have ${analysis.unresolvedAlerts} unresolved alerts. Stay on top of issues.`,
      impact: 'medium',
      priority: 'high',
      icon: 'bell',
      color: '#F59E0B',
    })

    recommendations.push({
      type: 'action',
      category: 'alert_management',
      title: 'Action: Review and Resolve Alerts',
      description: 'Clear pending alerts to avoid missing critical issues.',
      impact: 'medium',
      priority: 'high',
      icon: 'check-circle',
      color: '#F59E0B',
      actionItems: [
        'Review all critical alerts immediately',
        'Resolve or acknowledge high-priority alerts',
        'Set up daily alert review routine',
        'Address root causes, not just symptoms',
      ],
    })
  }

  // Priority handling recommendations
  if ((analysis.criticalLeads + analysis.highPriorityLeads) > 0) {
    recommendations.push({
      type: 'action',
      category: 'prioritization',
      title: 'Focus on High-Priority Leads',
      description: `You have ${analysis.criticalLeads} critical and ${analysis.highPriorityLeads} high-priority leads requiring attention.`,
      impact: 'high',
      priority: 'critical',
      icon: 'flag',
      color: '#DC2626',
      actionItems: [
        'Work on critical leads first thing each day',
        'Schedule specific time blocks for high-priority leads',
        'Ensure daily progress on top priority items',
        'Escalate blockers immediately',
      ],
    })
  }

  // New leads recommendations
  if (analysis.newLeads > 10) {
    recommendations.push({
      type: 'action',
      category: 'new_leads',
      title: 'Process New Leads',
      description: `You have ${analysis.newLeads} new leads waiting for initial contact.`,
      impact: 'high',
      priority: 'high',
      icon: 'user-plus',
      color: '#3B82F6',
      actionItems: [
        'Contact all new leads within 1 hour',
        'Qualify leads during first call',
        'Set expectations for next steps',
        'Update lead status after initial contact',
      ],
    })
  }

  // Call activity recommendations
  if (analysis.callsCount < analysis.totalLeads * 0.5 && analysis.totalLeads > 5) {
    recommendations.push({
      type: 'improvement',
      category: 'communication',
      title: 'Increase Call Activity',
      description: 'Phone calls are more effective than text-only communication. Increase call volume.',
      impact: 'medium',
      priority: 'medium',
      icon: 'phone',
      color: '#3B82F6',
    })
  }

  // Sort by priority
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 }
  recommendations.sort((a, b) => {
    return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
  })

  return recommendations
}

function calculatePerformanceScore(metrics: {
  conversionRate: number
  avgActivitiesPerLead: number
  staleRate: number
  avgResponseTime: number
  rejectionRate: number
}): number {
  let score = 50 // Start at 50

  // Conversion rate impact (0-25 points)
  score += Math.min(metrics.conversionRate * 0.7, 25)

  // Activity level impact (0-15 points)
  score += Math.min(metrics.avgActivitiesPerLead * 3, 15)

  // Response time impact (0-15 points, inverse)
  score += Math.max(15 - (metrics.avgResponseTime / 2), 0)

  // Stale rate penalty (0 to -20 points)
  score -= Math.min(metrics.staleRate * 0.4, 20)

  // Rejection rate penalty (0 to -15 points)
  score -= Math.min(metrics.rejectionRate * 0.3, 15)

  return Math.max(0, Math.min(100, Math.round(score)))
}
