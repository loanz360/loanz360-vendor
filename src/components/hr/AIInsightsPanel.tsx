'use client'

import React, { useState, useMemo } from 'react'
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Award, ChevronDown, ChevronUp } from 'lucide-react'

interface HRMetrics {
  totalEmployees: number
  newHiresThisMonth: number
  resignationsThisMonth: number
  avgTenureDays: number
  pendingLeaves: number
  attendanceRate: number
  openPositions: number
  upcomingReviews: number
  probationEnding: number
  birthdaysThisWeek: number
}

interface Insight {
  id: string
  type: 'positive' | 'warning' | 'neutral' | 'critical'
  title: string
  description: string
  metric?: string
  trend?: 'up' | 'down' | 'stable'
  priority: number
}

function generateInsights(metrics: HRMetrics): Insight[] {
  const insights: Insight[] = []

  // Attrition alert
  const monthlyAttritionRate = metrics.totalEmployees > 0
    ? (metrics.resignationsThisMonth / metrics.totalEmployees) * 100
    : 0
  if (monthlyAttritionRate > 3) {
    insights.push({
      id: 'high-attrition',
      type: 'critical',
      title: 'High Attrition Alert',
      description: `${metrics.resignationsThisMonth} resignations this month (${monthlyAttritionRate.toFixed(1)}% monthly rate). Investigate exit patterns and conduct stay interviews.`,
      metric: `${monthlyAttritionRate.toFixed(1)}%`,
      trend: 'up',
      priority: 1,
    })
  } else if (monthlyAttritionRate > 1.5) {
    insights.push({
      id: 'moderate-attrition',
      type: 'warning',
      title: 'Attrition Trending Up',
      description: `${metrics.resignationsThisMonth} resignations this month. Monitor closely and review engagement scores.`,
      metric: `${monthlyAttritionRate.toFixed(1)}%`,
      trend: 'up',
      priority: 2,
    })
  }

  // Hiring velocity
  if (metrics.newHiresThisMonth > 0 && metrics.openPositions > 0) {
    const fillRate = (metrics.newHiresThisMonth / (metrics.newHiresThisMonth + metrics.openPositions)) * 100
    insights.push({
      id: 'hiring-velocity',
      type: fillRate > 60 ? 'positive' : 'warning',
      title: 'Hiring Progress',
      description: `${metrics.newHiresThisMonth} new hires this month, ${metrics.openPositions} positions still open. Fill rate: ${fillRate.toFixed(0)}%.`,
      metric: `${fillRate.toFixed(0)}%`,
      trend: fillRate > 50 ? 'up' : 'down',
      priority: 3,
    })
  }

  // Attendance health
  if (metrics.attendanceRate < 85) {
    insights.push({
      id: 'low-attendance',
      type: 'warning',
      title: 'Below-Target Attendance',
      description: `Attendance rate at ${metrics.attendanceRate.toFixed(1)}%. Consider reviewing remote work policies or checking for seasonal patterns.`,
      metric: `${metrics.attendanceRate.toFixed(1)}%`,
      trend: 'down',
      priority: 2,
    })
  } else if (metrics.attendanceRate > 95) {
    insights.push({
      id: 'great-attendance',
      type: 'positive',
      title: 'Excellent Attendance',
      description: `Attendance rate at ${metrics.attendanceRate.toFixed(1)}% — above industry benchmark of 95%.`,
      metric: `${metrics.attendanceRate.toFixed(1)}%`,
      trend: 'up',
      priority: 5,
    })
  }

  // Pending actions
  if (metrics.pendingLeaves > 5) {
    insights.push({
      id: 'pending-leaves',
      type: 'warning',
      title: 'Leave Requests Piling Up',
      description: `${metrics.pendingLeaves} leave requests awaiting approval. Delayed responses impact employee satisfaction.`,
      metric: `${metrics.pendingLeaves}`,
      priority: 2,
    })
  }

  // Probation ending
  if (metrics.probationEnding > 0) {
    insights.push({
      id: 'probation-ending',
      type: 'neutral',
      title: 'Probation Reviews Due',
      description: `${metrics.probationEnding} employees completing probation soon. Schedule confirmation reviews.`,
      metric: `${metrics.probationEnding}`,
      priority: 3,
    })
  }

  // Upcoming reviews
  if (metrics.upcomingReviews > 0) {
    insights.push({
      id: 'upcoming-reviews',
      type: 'neutral',
      title: 'Performance Reviews Coming Up',
      description: `${metrics.upcomingReviews} performance reviews scheduled. Ensure managers have submitted their assessments.`,
      metric: `${metrics.upcomingReviews}`,
      priority: 4,
    })
  }

  // Birthdays
  if (metrics.birthdaysThisWeek > 0) {
    insights.push({
      id: 'birthdays',
      type: 'positive',
      title: 'Celebrate Your Team',
      description: `${metrics.birthdaysThisWeek} team member${metrics.birthdaysThisWeek > 1 ? 's have' : ' has'} birthdays this week. Send wishes to boost morale!`,
      metric: `${metrics.birthdaysThisWeek}`,
      priority: 6,
    })
  }

  // Growth insight
  const netGrowth = metrics.newHiresThisMonth - metrics.resignationsThisMonth
  insights.push({
    id: 'net-growth',
    type: netGrowth > 0 ? 'positive' : netGrowth < 0 ? 'warning' : 'neutral',
    title: 'Headcount Trend',
    description: `Net headcount change: ${netGrowth > 0 ? '+' : ''}${netGrowth} this month (${metrics.newHiresThisMonth} joined, ${metrics.resignationsThisMonth} left).`,
    metric: `${netGrowth > 0 ? '+' : ''}${netGrowth}`,
    trend: netGrowth > 0 ? 'up' : netGrowth < 0 ? 'down' : 'stable',
    priority: 3,
  })

  return insights.sort((a, b) => a.priority - b.priority)
}

const typeStyles = {
  positive: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: Award },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: AlertTriangle },
  neutral: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: Sparkles },
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: AlertTriangle },
}

export default function AIInsightsPanel({ metrics }: { metrics: HRMetrics }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const insights = useMemo(() => generateInsights(metrics), [metrics])

  if (insights.length === 0) return null

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FF6700]" />
          <span className="text-sm font-medium text-white">AI Insights</span>
          <span className="px-1.5 py-0.5 bg-[#FF6700]/20 text-[#FF6700] text-xs rounded-full">{insights.length}</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 space-y-2">
          {insights.map(insight => {
            const style = typeStyles[insight.type]
            const TrendIcon = insight.trend === 'up' ? TrendingUp : insight.trend === 'down' ? TrendingDown : null
            return (
              <div key={insight.id} className={`flex items-start gap-3 p-3 rounded-lg ${style.bg} border ${style.border}`}>
                <style.icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${style.text}`}>{insight.title}</span>
                    {insight.metric && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400">
                        {TrendIcon && <TrendIcon className="w-3 h-3" />}
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{insight.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { HRMetrics }
