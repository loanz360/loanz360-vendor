'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DailyPerformanceTrend } from '@/types/bdm-team-performance'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface DailyPerformanceChartProps {
  trends: DailyPerformanceTrend[]
  metric: 'conversions' | 'revenue'
}

export default function DailyPerformanceChart({ trends, metric }: DailyPerformanceChartProps) {
  const title = metric === 'conversions' ? 'Daily Conversions Trend' : 'Daily Revenue Trend'
  const color = metric === 'conversions' ? 'blue' : 'green'

  // Calculate max value for scaling
  const maxActual = Math.max(...trends.map((t) => t[metric].actual))
  const maxTarget = Math.max(...trends.map((t) => t[metric].target))
  const maxValue = Math.max(maxActual, maxTarget)

  // Calculate summary stats
  const totalActual = trends.reduce((sum, t) => sum + t[metric].actual, 0)
  const totalTarget = trends.reduce((sum, t) => sum + t[metric].target, 0)
  const avgActual = totalActual / trends.filter((t) => !t.isFutureDate).length
  const avgTarget = totalTarget / trends.length
  const trend = avgActual > avgTarget ? 'up' : 'down'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {trend === 'up' ? (
              <TrendingUp className={`h-5 w-5 text-${color}-600`} />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            {title}
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full bg-${color}-500`} />
              <span className="text-gray-600">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-gray-600" />
              <span className="text-gray-600">Target</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart Area */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {trends.map((day) => {
            const actualHeight = maxValue > 0 ? (day[metric].actual / maxValue) * 100 : 0
            const targetHeight = maxValue > 0 ? (day[metric].target / maxValue) * 100 : 0
            const isWeekend = day.isWeekend
            const isFuture = day.isFutureDate

            return (
              <div
                key={day.day}
                className={`flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors ${isWeekend ? 'bg-gray-50' : ''} ${isFuture ? 'opacity-40' : ''}`}
              >
                {/* Day Label */}
                <div className="w-12 text-right">
                  <div className="text-sm font-medium text-gray-900">Day {day.day}</div>
                  <div className="text-xs text-gray-500">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>

                {/* Bar Chart */}
                <div className="flex-1 relative h-12">
                  {/* Target Line (Dotted) */}
                  <div
                    className="absolute top-0 left-0 bg-gray-300 border-2 border-dashed border-gray-600 rounded opacity-50"
                    style={{ width: `${targetHeight}%`, height: '24px' }}
                  />

                  {/* Actual Bar */}
                  <div
                    className={`absolute bottom-0 left-0 bg-${color}-500 rounded transition-all duration-500 ${day[metric].achievement >= 100 ? 'shadow-md' : ''}`}
                    style={{ width: `${actualHeight}%`, height: '40px' }}
                  >
                    {day[metric].actual > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-white">
                        {metric === 'revenue'
                          ? `₹${(day[metric].actual / 100000).toFixed(1)}L`
                          : day[metric].actual}
                      </span>
                    )}
                  </div>
                </div>

                {/* Achievement Badge */}
                <div className="w-16 text-right">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${getAchievementBadge(day[metric].achievement)}`}
                  >
                    {day[metric].achievement}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 mb-1">Total Actual</div>
            <div className="text-lg font-bold text-gray-900">
              {metric === 'revenue'
                ? `₹${(totalActual / 10000000).toFixed(2)}Cr`
                : totalActual.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Avg/Day</div>
            <div className="text-lg font-bold text-gray-900">
              {metric === 'revenue'
                ? `₹${(avgActual / 100000).toFixed(1)}L`
                : avgActual.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Achievement</div>
            <div className={`text-lg font-bold ${getAchievementColor((totalActual / totalTarget) * 100)}`}>
              {((totalActual / totalTarget) * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function getAchievementBadge(achievement: number) {
  if (achievement >= 100) return 'bg-green-100 text-green-800'
  if (achievement >= 80) return 'bg-blue-100 text-blue-800'
  if (achievement >= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function getAchievementColor(achievement: number) {
  if (achievement >= 100) return 'text-green-600'
  if (achievement >= 80) return 'text-blue-600'
  if (achievement >= 60) return 'text-yellow-600'
  return 'text-red-600'
}
