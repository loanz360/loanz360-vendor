'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, TrendingDown, Target, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PerformanceSummary } from '@/lib/types/performance.types'

interface PerformanceSummaryCardProps {
  summary: PerformanceSummary
  className?: string
}

export function PerformanceSummaryCard({ summary, className }: PerformanceSummaryCardProps) {
  const {
    overallScore,
    grade,
    rank,
    totalEmployees,
    percentile,
    targetAchievement,
    trend,
    changeFromLastMonth,
  } = summary

  // Get grade color and description
  const getGradeInfo = (grade: string) => {
    switch (grade) {
      case 'A+':
        return { color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'Outstanding' }
      case 'A':
        return { color: 'text-green-600', bgColor: 'bg-green-100', description: 'Excellent' }
      case 'B+':
        return { color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Very Good' }
      case 'B':
        return { color: 'text-cyan-600', bgColor: 'bg-cyan-100', description: 'Good' }
      case 'C+':
        return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', description: 'Satisfactory' }
      case 'C':
        return { color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'Needs Improvement' }
      case 'D':
        return { color: 'text-red-600', bgColor: 'bg-red-100', description: 'Below Expectations' }
      case 'F':
        return { color: 'text-red-800', bgColor: 'bg-red-200', description: 'Unsatisfactory' }
      default:
        return { color: 'text-gray-600', bgColor: 'bg-gray-100', description: 'Not Graded' }
    }
  }

  const gradeInfo = getGradeInfo(grade)

  // Get percentile badge color
  const getPercentileBadge = () => {
    if (percentile >= 90) return <Badge className="bg-purple-500">Top 10%</Badge>
    if (percentile >= 75) return <Badge className="bg-green-500">Top 25%</Badge>
    if (percentile >= 50) return <Badge className="bg-blue-500">Top 50%</Badge>
    return <Badge variant="outline">Bottom 50%</Badge>
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4', className)}>
      {/* Overall Score & Grade */}
      <Card className="border-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-gray-600">Overall Performance</span>
            </div>
          </div>

          <div className="text-center">
            <div className={cn('text-6xl font-bold mb-2', gradeInfo.color)}>
              {grade}
            </div>
            <p className="text-sm text-gray-600 mb-3">{gradeInfo.description}</p>

            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{overallScore}</span>
              <span className="text-sm text-gray-500">/100</span>
            </div>

            <div className={cn('mt-4 p-2 rounded-lg', gradeInfo.bgColor)}>
              <p className="text-xs font-semibold">Performance Score</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Rank */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-600">Company Rank</span>
            </div>
            {getPercentileBadge()}
          </div>

          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-5xl font-bold text-gray-900">#{rank}</span>
              <span className="text-lg text-gray-500">/ {totalEmployees}</span>
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700">
                {percentile >= 90 && 'Elite Performer'}
                {percentile >= 75 && percentile < 90 && 'Top Performer'}
                {percentile >= 50 && percentile < 75 && 'Above Average'}
                {percentile < 50 && 'Keep Pushing'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Top {(100 - percentile).toFixed(0)}th percentile
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Achievement */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600">Target Achievement</span>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className={cn(
                'text-5xl font-bold',
                targetAchievement >= 100 ? 'text-green-600' :
                targetAchievement >= 80 ? 'text-blue-600' :
                targetAchievement >= 60 ? 'text-yellow-600' :
                'text-red-600'
              )}>
                {targetAchievement.toFixed(0)}
              </span>
              <span className="text-2xl font-semibold text-gray-500">%</span>
            </div>

            {/* Progress Ring Visual */}
            <div className="relative w-32 h-32 mx-auto mt-4" role="progressbar" aria-valuenow={Math.round(Math.min(targetAchievement, 100))} aria-valuemin={0} aria-valuemax={100} aria-label={`Target achievement: ${targetAchievement.toFixed(0)}%`}>
              <svg className="w-full h-full transform -rotate-90" aria-hidden="true">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="#E5E7EB"
                  strokeWidth="8"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={
                    targetAchievement >= 100 ? '#10B981' :
                    targetAchievement >= 80 ? '#3B82F6' :
                    targetAchievement >= 60 ? '#F59E0B' :
                    '#EF4444'
                  }
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(Math.min(targetAchievement, 100) / 100) * 352} 352`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">
                  {targetAchievement >= 100 ? '✓' : `${(100 - targetAchievement).toFixed(0)}% to go`}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card className="shadow-lg hover:shadow-xl transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {trend === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingUp className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-600">Monthly Trend</span>
            </div>
          </div>

          <div className="text-center">
            <div className={cn(
              'flex items-baseline justify-center gap-2 mb-2',
              trend === 'up' ? 'text-green-600' :
              trend === 'down' ? 'text-red-600' :
              'text-gray-600'
            )}>
              {trend === 'up' && <TrendingUp className="w-8 h-8" />}
              {trend === 'down' && <TrendingDown className="w-8 h-8" />}
              <span className="text-5xl font-bold">
                {trend === 'up' && '+'}
                {trend === 'down' && '-'}
                {Math.abs(changeFromLastMonth).toFixed(1)}
              </span>
              <span className="text-2xl font-semibold">%</span>
            </div>

            <p className="text-sm text-gray-600 mb-4">vs Last Month</p>

            <div className={cn(
              'p-3 rounded-lg',
              trend === 'up' ? 'bg-green-50' :
              trend === 'down' ? 'bg-red-50' :
              'bg-gray-50'
            )}>
              <p className={cn(
                'text-sm font-semibold',
                trend === 'up' ? 'text-green-700' :
                trend === 'down' ? 'text-red-700' :
                'text-gray-700'
              )}>
                {trend === 'up' && 'Great Progress!'}
                {trend === 'down' && 'Needs Attention'}
                {trend === 'stable' && 'Consistent'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {trend === 'up' && 'Keep up the excellent work'}
                {trend === 'down' && 'Time to step up the game'}
                {trend === 'stable' && 'Maintaining performance'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Performance Summary Skeleton Loader
export function PerformanceSummaryCardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="text-center space-y-4">
              <div className="h-16 w-24 bg-gray-200 rounded mx-auto" />
              <div className="h-4 w-20 bg-gray-200 rounded mx-auto" />
              <div className="h-12 w-full bg-gray-200 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
