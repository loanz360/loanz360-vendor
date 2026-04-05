'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CalendarHeatmap as CalendarHeatmapType } from '@/types/bdm-team-performance'
import { formatCurrency } from '@/lib/bdm/team-performance-utils'
import { useState } from 'react'

interface CalendarHeatmapProps {
  heatmap: CalendarHeatmapType
}

export default function CalendarHeatmap({ heatmap }: CalendarHeatmapProps) {
  const { days, monthSummary } = heatmap
  const [hoveredDay, setHoveredDay] = useState<typeof days[0] | null>(null)

  // Add empty cells at the beginning if month doesn't start on Sunday
  const firstDay = new Date(days[0]?.date || new Date())
  const startDayOfWeek = firstDay.getDay()
  const emptyCells = Array(startDayOfWeek).fill(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Daily Performance Calendar</span>
          <span className="text-sm font-normal text-gray-600">
            {heatmap.monthName} {heatmap.year}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Calendar Grid */}
        <div className="mb-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for alignment */}
            {emptyCells.map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}

            {/* Actual days */}
            {days.map((day) => (
              <div
                key={day.date}
                className={`
                  aspect-square rounded-lg p-2 cursor-pointer transition-all hover:scale-105 hover:z-10
                  ${day.bgColor} ${day.isWeekend ? 'opacity-60' : ''}
                  border-2 ${hoveredDay?.date === day.date ? 'border-gray-600 shadow-lg' : 'border-transparent'}
                `}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                title={`${day.date}: ${day.teamMetrics.conversions} conversions`}
              >
                <div className="text-xs font-semibold text-gray-700">{day.dayOfMonth}</div>
                {day.teamMetrics.conversions > 0 && (
                  <div className="text-xs font-bold text-gray-900 mt-1">
                    {day.teamMetrics.conversions}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Hover Tooltip */}
        {hoveredDay && (
          <div className="bg-gray-800 text-white rounded-lg p-3 mb-4 text-sm">
            <div className="font-semibold mb-1">
              {hoveredDay.dayOfWeek}, {hoveredDay.dayOfMonth}
            </div>
            <div className="space-y-1 text-xs">
              <div>Leads: {hoveredDay.teamMetrics.leadsContacted}</div>
              <div>Conversions: {hoveredDay.teamMetrics.conversions}</div>
              <div>Revenue: {formatCurrency(hoveredDay.teamMetrics.revenue, true)}</div>
              <div>Active BDEs: {hoveredDay.teamMetrics.bdesWithActivity}</div>
              {hoveredDay.topPerformer && (
                <div className="pt-1 border-t border-gray-600">
                  Top: {hoveredDay.topPerformer.bdeName} ({hoveredDay.topPerformer.conversions})
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
            <span>Exceeded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 border border-blue-300" />
            <span>Met</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
            <span>No Activity</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {monthSummary.daysWithActivity}/{monthSummary.totalWorkingDays}
            </div>
            <div className="text-sm text-gray-600">Active Days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {monthSummary.averageDailyConversions}
            </div>
            <div className="text-sm text-gray-600">Avg Conversions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(monthSummary.averageDailyRevenue, true)}
            </div>
            <div className="text-sm text-gray-600">Avg Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {monthSummary.bestDay?.dayOfMonth || '-'}
            </div>
            <div className="text-sm text-gray-600">Best Day</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
