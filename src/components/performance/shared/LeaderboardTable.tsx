'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/types/performance.types'

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  title?: string
  description?: string
  showTopOnly?: number
  primaryMetricLabel?: string
  secondaryMetricLabel?: string
  tertiaryMetricLabel?: string
  className?: string
  currentUserId?: string
}

export function LeaderboardTable({
  entries,
  title = 'Leaderboard',
  description = 'Top performers this month',
  showTopOnly,
  primaryMetricLabel = 'Performance',
  secondaryMetricLabel,
  tertiaryMetricLabel,
  className,
  currentUserId,
}: LeaderboardTableProps) {
  const displayEntries = showTopOnly ? entries.slice(0, showTopOnly) : entries

  // Get rank badge color and icon
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1 text-yellow-400">
          <Trophy className="w-5 h-5" />
          <span className="font-bold hidden sm:inline">1st</span>
        </div>
      )
    }
    if (rank === 2) {
      return (
        <div className="flex items-center gap-1 text-gray-300">
          <Medal className="w-5 h-5" />
          <span className="font-bold hidden sm:inline">2nd</span>
        </div>
      )
    }
    if (rank === 3) {
      return (
        <div className="flex items-center gap-1 text-orange-400">
          <Medal className="w-5 h-5" />
          <span className="font-bold hidden sm:inline">3rd</span>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 text-gray-300 font-semibold text-sm">
        {rank}
      </div>
    )
  }

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable', changePercentage: number) => {
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

    return (
      <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
        <TrendIcon className="w-3 h-3" />
        <span>{Math.abs(changePercentage).toFixed(1)}%</span>
      </div>
    )
  }

  // Format metric value
  const formatMetric = (value: number): string => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)}Cr`
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`
    }
    if (value >= 1000) {
      return value.toLocaleString('en-IN')
    }
    return value.toString()
  }

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // Determine if an entry is the current user
  const isCurrentUserEntry = (entry: LeaderboardEntry) => {
    return entry.isCurrentUser || (currentUserId && entry.userId === currentUserId)
  }

  return (
    <Card className={cn('bg-gray-900 border-gray-700', className)}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="w-5 h-5 text-yellow-400" />
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1 text-gray-400">{description}</CardDescription>}
          </div>
          {showTopOnly && entries.length > showTopOnly && (
            <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
              Top {showTopOnly} of {entries.length}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {displayEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-2 text-gray-600" />
              <p>No leaderboard data available</p>
            </div>
          ) : (
            displayEntries.map((entry) => {
              const isCurrent = isCurrentUserEntry(entry)
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    'flex items-center gap-2 sm:gap-4 p-3 rounded-lg border transition-all duration-200',
                    isCurrent
                      ? 'bg-orange-500/20 border-orange-500/50 shadow-md'
                      : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:shadow-sm'
                  )}
                >
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">{getRankBadge(entry.rank)}</div>

                  {/* Avatar */}
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
                    <AvatarImage src={entry.avatar} alt={entry.employeeId || entry.name} />
                    <AvatarFallback className={cn(isCurrent ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-200')}>
                      {entry.employeeId ? entry.employeeId.slice(0, 2).toUpperCase() : getInitials(entry.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Employee ID and Location */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('font-semibold truncate text-sm sm:text-base', isCurrent ? 'text-orange-400' : 'text-white')}>
                        {entry.employeeId || entry.userId.slice(0, 8)}
                      </p>
                      {isCurrent && (
                        <Badge className="bg-orange-500 text-xs px-2 py-0 text-white">You</Badge>
                      )}
                      {entry.badge && (
                        <Badge variant="outline" className="text-xs px-2 py-0 border-gray-600 text-gray-300 hidden sm:inline-flex">
                          {entry.badge}
                        </Badge>
                      )}
                    </div>
                    {entry.location && <p className="text-xs text-gray-500 truncate hidden sm:block">{entry.location}</p>}
                  </div>

                  {/* Metrics - responsive layout */}
                  <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
                    {/* Primary Metric - always visible */}
                    <div className="text-right">
                      <p className="text-xs text-gray-500 hidden sm:block">{primaryMetricLabel}</p>
                      <p className="text-xs sm:text-sm font-bold text-white">{formatMetric(entry.primaryMetric)}</p>
                    </div>

                    {/* Secondary Metric - hidden on mobile */}
                    {entry.secondaryMetric !== undefined && secondaryMetricLabel && (
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-gray-500">{secondaryMetricLabel}</p>
                        <p className="text-sm font-semibold text-gray-300">{formatMetric(entry.secondaryMetric)}</p>
                      </div>
                    )}

                    {/* Tertiary Metric - hidden on mobile and tablet */}
                    {entry.tertiaryMetric !== undefined && tertiaryMetricLabel && (
                      <div className="text-right hidden lg:block">
                        <p className="text-xs text-gray-500">{tertiaryMetricLabel}</p>
                        <p className="text-sm font-semibold text-gray-300">{entry.tertiaryMetric.toFixed(1)}%</p>
                      </div>
                    )}

                    {/* Trend - hidden on very small screens */}
                    <div className="flex-shrink-0 hidden sm:block">{getTrendIcon(entry.trend, entry.changePercentage)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Show more indicator */}
        {showTopOnly && entries.length > showTopOnly && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-400">
              and {entries.length - showTopOnly} more {entries.length - showTopOnly === 1 ? 'person' : 'people'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Leaderboard Skeleton Loader
export function LeaderboardTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <div className="h-6 w-48 bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-700 rounded mt-2 animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 sm:gap-4 p-3 rounded-lg border border-gray-700 bg-gray-800">
              <div className="w-8 h-8 bg-gray-700 rounded-full animate-pulse" />
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 sm:w-32 bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-16 sm:w-24 bg-gray-700 rounded animate-pulse hidden sm:block" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-12 sm:w-16 bg-gray-700 rounded animate-pulse hidden sm:block" />
                <div className="h-4 w-16 sm:w-20 bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
