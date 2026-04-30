'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CoachingInsight } from '@/types/bdm-team-performance'
import { Lightbulb, Trophy, AlertTriangle, TrendingUp, Target, CheckCircle } from 'lucide-react'

interface CoachingInsightsPanelProps {
  insights: CoachingInsight[]
}

export default function CoachingInsightsPanel({ insights }: CoachingInsightsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-600" />
          Coaching Insights & Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.length > 0 ? (
          insights.map((insight) => {
            const Icon = getInsightIcon(insight.icon)
            const { bgColor, borderColor, iconColor } = getInsightColors(insight.type)

            return (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-l-4 ${bgColor} ${borderColor} hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${bgColor} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {/* Title & Priority */}
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-sm text-gray-900">{insight.title}</h4>
                      {insight.priority && insight.priority !== 'low' && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${getPriorityBadge(insight.priority)}`}
                        >
                          {insight.priority.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 leading-relaxed mb-3">{insight.description}</p>

                    {/* Category Badge */}
                    <div className="mb-3">
                      <span className="text-xs px-2 py-1 bg-white rounded border border-gray-200 text-gray-600 font-medium">
                        {getCategoryEmoji(insight.category)} {insight.category}
                      </span>
                    </div>

                    {/* Action Items */}
                    {insight.actionItems && insight.actionItems.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                          Recommended Actions:
                        </div>
                        <ul className="space-y-1.5">
                          {insight.actionItems.map((action, idx) => (
                            <li key={idx} className="text-xs text-gray-700 flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Confidence Level (for predictions) */}
                    {insight.confidenceLevel !== undefined && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-gray-600">Confidence:</div>
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${insight.confidenceLevel}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 font-medium">
                            {insight.confidenceLevel}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No coaching insights available</p>
            <p className="text-xs mt-1">
              Insights will be generated based on performance patterns
            </p>
          </div>
        )}

        {/* Insight Types Legend */}
        {insights.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <div className="text-xs text-gray-500 space-y-2">
              <div className="font-semibold mb-2">Insight Categories:</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-blue-600" />
                  <span>Performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span>Efficiency</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-purple-600" />
                  <span>Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3 w-3 text-yellow-600" />
                  <span>Forecast</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getInsightIcon(iconName: string) {
  const icons: Record<string, unknown> = {
    Trophy,
    AlertTriangle,
    Lightbulb,
    TrendingUp,
    CheckCircle,
    Target,
  }
  return icons[iconName] || Lightbulb
}

function getInsightColors(type: string) {
  switch (type) {
    case 'strength':
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-500',
        iconColor: 'text-green-600',
      }
    case 'alert':
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        iconColor: 'text-red-600',
      }
    case 'recommendation':
      return {
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-500',
        iconColor: 'text-blue-600',
      }
    case 'prediction':
      return {
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-500',
        iconColor: 'text-purple-600',
      }
    default:
      return {
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-300',
        iconColor: 'text-gray-600',
      }
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 border border-red-300'
    case 'high':
      return 'bg-orange-100 text-orange-800 border border-orange-300'
    case 'medium':
      return 'bg-blue-100 text-blue-800 border border-blue-300'
    case 'low':
      return 'bg-gray-100 text-gray-800 border border-gray-300'
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300'
  }
}

function getCategoryEmoji(category: string) {
  switch (category) {
    case 'performance':
      return '🎯'
    case 'efficiency':
      return '⚡'
    case 'activity':
      return '📊'
    case 'forecast':
      return '🔮'
    default:
      return '💡'
  }
}
