'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AIInsightCard } from '@/types/bdm-team-performance'
import { Sparkles, Trophy, AlertTriangle, Lightbulb, TrendingUp, CheckCircle } from 'lucide-react'

interface AIInsightsPanelProps {
  insights: AIInsightCard[]
}

export default function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
        {insights.length > 0 ? (
          insights.map((insight) => {
            const Icon = getInsightIcon(insight.icon)

            return (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-l-4 ${insight.bgColor} ${getBorderColor(insight.type)} hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${insight.bgColor} flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${insight.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      {insight.priority && insight.priority !== 'low' && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPriorityBadge(insight.priority)}`}>
                          {insight.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{insight.description}</p>

                    {/* Action Items */}
                    {insight.actionItems && insight.actionItems.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {insight.actionItems.map((action, idx) => (
                          <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Related BDEs */}
                    {insight.relatedBDEs && insight.relatedBDEs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {insight.relatedBDEs.map((bde) => (
                          <span
                            key={bde.id}
                            className="text-xs bg-white px-2 py-1 rounded border border-gray-200"
                          >
                            {bde.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Confidence Level */}
                    {insight.confidenceLevel !== undefined && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${insight.confidenceLevel}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {insight.confidenceLevel}% confidence
                        </span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="mt-2 text-xs text-gray-400">
                      {new Date(insight.createdAt).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">No insights available yet</p>
            <p className="text-xs mt-1">AI insights will appear as performance data is collected</p>
          </div>
        )}

        {/* Insight Type Legend */}
        {insights.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <div className="text-xs text-gray-500 space-y-2">
              <div className="font-semibold mb-2">Insight Types:</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-green-600" />
                  <span>Strength</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                  <span>Alert</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3 w-3 text-blue-600" />
                  <span>Recommendation</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-purple-600" />
                  <span>Prediction</span>
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
    Sparkles,
  }
  return icons[iconName] || Sparkles
}

function getBorderColor(type: string) {
  switch (type) {
    case 'strength':
      return 'border-green-500'
    case 'alert':
      return 'border-red-500'
    case 'recommendation':
      return 'border-blue-500'
    case 'prediction':
      return 'border-purple-500'
    default:
      return 'border-gray-300'
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
