'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { TeamSummaryKPI } from '@/types/bdm-team-performance'
import { TrendingUp, TrendingDown, Minus, Users, DollarSign, Activity, Target, Award } from 'lucide-react'

interface TeamSummaryCardsProps {
  kpis: TeamSummaryKPI[]
}

export default function TeamSummaryCards({ kpis }: TeamSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kpis.map((kpi) => {
        const TrendIcon =
          kpi.trend.direction === 'up'
            ? TrendingUp
            : kpi.trend.direction === 'down'
            ? TrendingDown
            : Minus

        const MainIcon = getMainIcon(kpi.icon)

        return (
          <Card key={kpi.id} className={`${kpi.bgColor} border-l-4 ${getBorderColor(kpi.status)} hover:shadow-lg transition-shadow`}>
            <CardContent className="p-6">
              {/* Header with Icon */}
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                  <MainIcon className={`h-6 w-6 ${kpi.color}`} />
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendIcon className={`h-4 w-4 ${getTrendColor(kpi.trend.direction)}`} />
                  {kpi.trend.percentage > 0 && (
                    <span className={getTrendColor(kpi.trend.direction)}>
                      {kpi.trend.percentage}%
                    </span>
                  )}
                </div>
              </div>

              {/* Label */}
              <h3 className="text-sm font-medium text-gray-600 mb-1">{kpi.label}</h3>

              {/* Value */}
              <div className="text-3xl font-bold text-gray-900 mb-2">
                {kpi.formattedValue}
              </div>

              {/* Target Progress (if applicable) */}
              {kpi.target && kpi.achievementPercentage !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Target: {kpi.targetFormatted}
                    </span>
                    <span className={`font-semibold ${getAchievementColor(kpi.achievementPercentage)}`}>
                      {kpi.achievementPercentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getProgressBarColor(kpi.achievementPercentage)} transition-all duration-500`}
                      style={{ width: `${Math.min(100, kpi.achievementPercentage)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Subtitle */}
              {kpi.subtitle && (
                <p className="text-sm text-gray-500 mt-2">{kpi.subtitle}</p>
              )}

              {/* Trend Description */}
              <p className="text-xs text-gray-400 mt-1">{kpi.trend.comparisonText}</p>

              {/* Sub Metrics */}
              {kpi.subMetrics && kpi.subMetrics.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                  {kpi.subMetrics.map((sub, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="text-gray-500">{sub.label}: </span>
                      <span className="font-semibold text-gray-700">{sub.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Helper functions
function getMainIcon(iconName: string) {
  const icons: Record<string, any> = {
    Users,
    TrendingUp,
    DollarSign,
    Activity,
    Target,
    Award,
  }
  return icons[iconName] || Activity
}

function getBorderColor(status: string) {
  switch (status) {
    case 'excellent':
      return 'border-green-500'
    case 'good':
      return 'border-blue-500'
    case 'warning':
      return 'border-yellow-500'
    case 'critical':
      return 'border-red-500'
    default:
      return 'border-gray-300'
  }
}

function getTrendColor(direction: string) {
  switch (direction) {
    case 'up':
      return 'text-green-600'
    case 'down':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

function getAchievementColor(percentage: number) {
  if (percentage >= 100) return 'text-green-600'
  if (percentage >= 80) return 'text-blue-600'
  if (percentage >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getProgressBarColor(percentage: number) {
  if (percentage >= 100) return 'bg-green-500'
  if (percentage >= 80) return 'bg-blue-500'
  if (percentage >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}
