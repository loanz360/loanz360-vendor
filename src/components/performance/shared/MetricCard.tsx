'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetricCard as MetricCardType } from '@/lib/types/performance.types'

/** Static Tailwind color mappings — dynamic template literals don't compile */
const METRIC_BG_COLORS: Record<string, string> = {
  blue: 'bg-blue-100', green: 'bg-green-100', red: 'bg-red-100',
  yellow: 'bg-yellow-100', orange: 'bg-orange-100', purple: 'bg-purple-100',
  cyan: 'bg-cyan-100', pink: 'bg-pink-100', gray: 'bg-gray-100',
}

const METRIC_TEXT_COLORS: Record<string, string> = {
  blue: 'text-blue-600', green: 'text-green-600', red: 'text-red-600',
  yellow: 'text-yellow-600', orange: 'text-orange-600', purple: 'text-purple-600',
  cyan: 'text-cyan-600', pink: 'text-pink-600', gray: 'text-gray-600',
}

interface MetricCardProps {
  metric: MetricCardType
  showRank?: boolean
  showTrend?: boolean
  className?: string
}

export function MetricCard({ metric, showRank = true, showTrend = true, className }: MetricCardProps) {
  const {
    label,
    value,
    target,
    unit = '',
    achievementPercentage,
    trend,
    changePercentage,
    rank,
    totalEmployees,
    icon,
    color,
    description,
  } = metric

  // Format value based on unit
  const formatValue = (val: number): string => {
    if (unit === '₹') {
      return `₹${val.toLocaleString('en-IN')}`
    }
    if (unit === '%') {
      return `${val.toFixed(1)}%`
    }
    if (unit === 'min') {
      return `${val} min`
    }
    if (unit === 'km') {
      return `${val.toFixed(1)} km`
    }
    return val.toLocaleString('en-IN')
  }

  // Get progress bar color based on achievement
  const getProgressColor = (): string => {
    if (achievementPercentage >= 100) return 'bg-green-500'
    if (achievementPercentage >= 80) return 'bg-blue-500'
    if (achievementPercentage >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Get trend icon and color
  const getTrendIcon = () => {
    if (!trend || !showTrend) return null

    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

    return (
      <div className={cn('flex items-center gap-1 text-sm', trendColor)}>
        <TrendIcon className="w-4 h-4" />
        {changePercentage !== undefined && (
          <span className="font-semibold">{Math.abs(changePercentage).toFixed(1)}%</span>
        )}
      </div>
    )
  }

  // Get achievement status badge
  const getAchievementBadge = () => {
    if (achievementPercentage >= 100) {
      return <Badge className="bg-green-500 hover:bg-green-600">Target Achieved</Badge>
    }
    if (achievementPercentage >= 80) {
      return <Badge className="bg-blue-500 hover:bg-blue-600">On Track</Badge>
    }
    if (achievementPercentage >= 60) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Needs Attention</Badge>
    }
    return <Badge variant="destructive">At Risk</Badge>
  }

  return (
    <Card className={cn('hover:shadow-lg transition-shadow duration-200', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg', METRIC_BG_COLORS[color] || 'bg-gray-100')}>
              <div className={cn('text-2xl', METRIC_TEXT_COLORS[color] || 'text-gray-600')}>{icon}</div>
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
              {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>
          </div>
          {showRank && rank && totalEmployees && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Trophy className="w-3 h-3" />
              <span>
                #{rank} of {totalEmployees}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Value */}
        <div>
          <div className="text-3xl font-bold text-gray-900">{formatValue(value)}</div>
          <div className="text-sm text-gray-500 mt-1">
            Target: {formatValue(target)} {unit}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="font-semibold text-gray-900">{achievementPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(achievementPercentage, 100)} className="h-2" indicatorClassName={getProgressColor()} />
        </div>

        {/* Footer - Trend and Achievement Status */}
        <div className="flex items-center justify-between pt-2 border-t">
          {getTrendIcon()}
          {getAchievementBadge()}
        </div>
      </CardContent>
    </Card>
  )
}

// Metric Card Skeleton Loader
export function MetricCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-32 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="h-4 w-16 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="h-8 w-32 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded mt-2" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-12 bg-gray-200 rounded" />
          </div>
          <div className="h-2 w-full bg-gray-200 rounded" />
        </div>
        <div className="flex justify-between pt-2">
          <div className="h-6 w-16 bg-gray-200 rounded" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
