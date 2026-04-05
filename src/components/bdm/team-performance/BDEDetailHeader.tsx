'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { BDEDetailHeader } from '@/types/bdm-team-performance'
import { TrendingUp, Target, DollarSign, Activity } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/bdm/team-performance-utils'

interface BDEDetailHeaderProps {
  header: BDEDetailHeader
}

export default function BDEDetailHeader({ header }: BDEDetailHeaderProps) {
  return (
    <div className="space-y-6">
      {/* BDE Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-600">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            {/* Left: BDE Info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {header.bdeName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{header.bdeName}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  <span className="font-medium">{header.employeeCode}</span>
                  <span className="text-gray-400">•</span>
                  <span>{header.email}</span>
                </div>
              </div>
            </div>

            {/* Right: Performance Badge */}
            <div className="text-right">
              <div
                className={`inline-block px-4 py-2 rounded-lg font-bold text-3xl ${header.gradeColor} shadow-md`}
              >
                {header.grade}
              </div>
              <div className="mt-2">
                <span
                  className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusBadge(header.status)}`}
                >
                  {header.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {header.overallAchievement}% Overall Achievement
              </div>
            </div>
          </div>

          {/* Period Info */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Activity className="h-4 w-4" />
              <span>
                Day {header.currentDay} of {header.totalDays} • {header.periodInfo?.monthName}{' '}
                {header.year}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Conversions */}
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Target className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Conversions</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {formatNumber(header.metrics.conversions.actual)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Target: {formatNumber(header.metrics.conversions.target)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getAchievementColor(header.metrics.conversions.achievement)}`}
                >
                  {header.metrics.conversions.achievement}%
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>Projected: {formatNumber(header.metrics.conversions.projected)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(header.metrics.conversions.achievement)} transition-all duration-500`}
                  style={{
                    width: `${Math.min(100, header.metrics.conversions.achievement)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Revenue</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(header.metrics.revenue.actual, true)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Target: {formatCurrency(header.metrics.revenue.target, true)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getAchievementColor(header.metrics.revenue.achievement)}`}
                >
                  {header.metrics.revenue.achievement}%
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>Proj: {formatCurrency(header.metrics.revenue.projected, true)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(header.metrics.revenue.achievement)} transition-all duration-500`}
                  style={{ width: `${Math.min(100, header.metrics.revenue.achievement)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disbursal */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Disbursal</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(header.metrics.disbursal.actual, true)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Target: {formatCurrency(header.metrics.disbursal.target, true)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${getAchievementColor(header.metrics.disbursal.achievement)}`}
                >
                  {header.metrics.disbursal.achievement}%
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getProgressBarColor(header.metrics.disbursal.achievement)} transition-all duration-500`}
                  style={{
                    width: `${Math.min(100, header.metrics.disbursal.achievement)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Activity className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">Conversion Rate</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {header.metrics.conversionRate.value.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">Lead to Conversion</div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${header.metrics.conversionRate.status === 'good' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                >
                  {header.metrics.conversionRate.status === 'good' ? 'GOOD' : 'NEEDS WORK'}
                </span>
              </div>
            </div>

            {/* Visual Indicator */}
            <div className="mt-3">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-8 flex-1 rounded ${i < Math.floor(header.metrics.conversionRate.value / 5) ? 'bg-orange-500' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Helper functions
function getStatusBadge(status: string) {
  switch (status) {
    case 'exceeding':
      return 'bg-green-100 text-green-800 border border-green-300'
    case 'on_track':
      return 'bg-blue-100 text-blue-800 border border-blue-300'
    case 'at_risk':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300'
    case 'behind':
      return 'bg-red-100 text-red-800 border border-red-300'
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300'
  }
}

function getAchievementColor(achievement: number) {
  if (achievement >= 100) return 'text-green-600'
  if (achievement >= 80) return 'text-blue-600'
  if (achievement >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getProgressBarColor(achievement: number) {
  if (achievement >= 100) return 'bg-green-500'
  if (achievement >= 80) return 'bg-blue-500'
  if (achievement >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}
