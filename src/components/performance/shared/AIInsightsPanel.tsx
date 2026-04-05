'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, AlertTriangle, CheckCircle2, Lightbulb, TrendingUp, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIInsight } from '@/lib/types/performance.types'

interface AIInsightsPanelProps {
  insights: AIInsight[]
  title?: string
  description?: string
  maxVisible?: number
  className?: string
  onMarkAsRead?: (insightId: string) => void
  onMarkAsActioned?: (insightId: string) => void
}

export function AIInsightsPanel({
  insights,
  title = 'AI-Powered Insights',
  description = 'Personalized recommendations to improve your performance',
  maxVisible = 5,
  className,
  onMarkAsRead,
  onMarkAsActioned,
}: AIInsightsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  // Sort insights by priority and date
  const sortedInsights = [...insights].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Show limited or all insights
  const displayedInsights = expanded ? sortedInsights : sortedInsights.slice(0, maxVisible)

  // Get insight icon and color
  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'strength':
        return <Trophy className="w-5 h-5 text-green-500" />
      case 'improvement':
        return <TrendingUp className="w-5 h-5 text-blue-500" />
      case 'recommendation':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case 'achievement':
        return <CheckCircle2 className="w-5 h-5 text-purple-500" />
    }
  }

  // Get priority badge
  const getPriorityBadge = (priority: AIInsight['priority']) => {
    const variants = {
      critical: 'bg-red-500 hover:bg-red-600 text-white',
      high: 'bg-orange-500 hover:bg-orange-600 text-white',
      medium: 'bg-blue-500 hover:bg-blue-600 text-white',
      low: 'bg-gray-500 hover:bg-gray-600 text-white',
    }

    return (
      <Badge className={cn('text-xs px-2 py-0.5', variants[priority])}>
        {priority.toUpperCase()}
      </Badge>
    )
  }

  // Get insight card background
  const getInsightBackground = (type: AIInsight['type']) => {
    switch (type) {
      case 'strength':
        return 'bg-green-50 border-green-200'
      case 'improvement':
        return 'bg-blue-50 border-blue-200'
      case 'recommendation':
        return 'bg-yellow-50 border-yellow-200'
      case 'warning':
        return 'bg-red-50 border-red-200'
      case 'achievement':
        return 'bg-purple-50 border-purple-200'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
          {insights.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {insights.filter((i) => !i.isRead).length} New
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No insights available yet</p>
            <p className="text-sm mt-1">Check back later for personalized recommendations</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayedInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    'p-4 rounded-lg border transition-all duration-200',
                    getInsightBackground(insight.type),
                    !insight.isRead && 'shadow-md'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{insight.title}</h4>
                          {!insight.isRead && (
                            <Badge className="bg-blue-500 text-xs px-2 py-0">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{insight.description}</p>
                      </div>
                    </div>
                    {getPriorityBadge(insight.priority)}
                  </div>

                  {/* Metrics */}
                  {insight.metricName && (
                    <div className="flex items-center gap-4 mt-3 p-2 bg-white/60 rounded text-sm">
                      <div>
                        <span className="text-gray-600">Metric: </span>
                        <span className="font-semibold text-gray-900">{insight.metricName}</span>
                      </div>
                      {insight.currentValue !== undefined && (
                        <div>
                          <span className="text-gray-600">Current: </span>
                          <span className="font-semibold text-gray-900">{insight.currentValue.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {insight.targetValue !== undefined && (
                        <div>
                          <span className="text-gray-600">Target: </span>
                          <span className="font-semibold text-gray-900">{insight.targetValue.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {insight.variancePercentage !== undefined && (
                        <div>
                          <span className="text-gray-600">Variance: </span>
                          <span
                            className={cn(
                              'font-semibold',
                              insight.variancePercentage >= 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {insight.variancePercentage > 0 && '+'}
                            {insight.variancePercentage.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Items */}
                  {insight.actionItems && insight.actionItems.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Recommended Actions:</p>
                      <ul className="space-y-1">
                        {insight.actionItems.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/50">
                    {!insight.isRead && onMarkAsRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onMarkAsRead(insight.id)}
                        className="text-xs"
                      >
                        Mark as Read
                      </Button>
                    )}
                    {!insight.isActioned && onMarkAsActioned && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onMarkAsActioned(insight.id)}
                        className="text-xs"
                      >
                        Mark as Actioned
                      </Button>
                    )}
                    {insight.isActioned && (
                      <Badge className="bg-green-500 text-xs px-2 py-1">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Actioned
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Show More/Less Button */}
            {insights.length > maxVisible && (
              <Button
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                className="w-full mt-4"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Show {insights.length - maxVisible} More Insights
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// AI Insights Panel Skeleton Loader
export function AIInsightsPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-56 bg-gray-200 rounded" />
            <div className="h-4 w-80 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-5 h-5 bg-gray-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 bg-gray-200 rounded" />
                  <div className="h-4 w-full bg-gray-200 rounded" />
                  <div className="h-4 w-5/6 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
              <div className="flex gap-2 mt-3">
                <div className="h-8 w-24 bg-gray-200 rounded" />
                <div className="h-8 w-32 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
