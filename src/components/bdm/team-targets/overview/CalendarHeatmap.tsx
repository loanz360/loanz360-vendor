'use client'

import React, { useEffect, useState } from 'react'

interface CalendarHeatmapProps {
  month: number
  year: number
}

interface DayData {
  date: string
  day: number
  dayOfWeek: number
  status: 'exceeded' | 'met' | 'partial' | 'missed' | 'no_activity'
  intensity: number
  metrics: {
    leadsContacted: number
    conversions: number
    revenue: number
    activeBDEs: number
    totalBDEs: number
    achievementRate: number
  }
  breakdown: {
    exceeded: number
    met: number
    partial: number
    missed: number
    noActivity: number
  }
}

export default function CalendarHeatmap({ month, year }: CalendarHeatmapProps) {
  const [calendarData, setCalendarData] = useState<DayData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null)

  useEffect(() => {
    fetchCalendarData()
  }, [month, year])

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/bdm/team-targets/overview/calendar-heatmap?month=${month}&year=${year}`)
      const data = await response.json()

      if (data.success) {
        setCalendarData(data.data.days)
      }
    } catch (error) {
      console.error('Error fetching calendar data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string, intensity: number) => {
    const colors = {
      exceeded: `rgba(16, 185, 129, ${0.3 + (intensity / 100) * 0.7})`, // Green
      met: `rgba(59, 130, 246, ${0.3 + (intensity / 100) * 0.7})`, // Blue
      partial: `rgba(251, 191, 36, ${0.3 + (intensity / 100) * 0.7})`, // Yellow
      missed: `rgba(239, 68, 68, ${0.3 + (intensity / 100) * 0.7})`, // Red
      no_activity: 'rgba(75, 85, 99, 0.2)', // Gray
    }
    return colors[status as keyof typeof colors] || colors.no_activity
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date()
  const isCurrentMonth = month === today.getMonth() && year === today.getFullYear()
  const currentDay = isCurrentMonth ? today.getDate() : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Week Day Headers */}
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 pb-2">
            {day}
          </div>
        ))}

        {/* Empty cells for days before month starts */}
        {calendarData.length > 0 &&
          Array.from({ length: calendarData[0].dayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

        {/* Calendar Days */}
        {calendarData.map((dayData) => (
          <div
            key={dayData.date}
            className="relative group cursor-pointer"
            onMouseEnter={() => setHoveredDay(dayData)}
            onMouseLeave={() => setHoveredDay(null)}
          >
            <div
              className="aspect-square rounded-lg border-2 transition-all duration-200 hover:scale-110 hover:z-10 flex flex-col items-center justify-center"
              style={{
                backgroundColor: getStatusColor(dayData.status, dayData.intensity),
                borderColor:
                  currentDay === dayData.day
                    ? '#f97316'
                    : dayData.status === 'exceeded'
                      ? '#10b981'
                      : 'transparent',
              }}
            >
              <span className="text-sm font-semibold text-white">{dayData.day}</span>
              {dayData.metrics.activeBDEs > 0 && (
                <span className="text-[10px] text-gray-300">
                  {dayData.metrics.activeBDEs}/{dayData.metrics.totalBDEs}
                </span>
              )}
            </div>

            {/* Tooltip */}
            {hoveredDay?.date === dayData.date && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
                <div className="text-xs space-y-2">
                  <div className="font-semibold text-white border-b border-gray-700 pb-2">
                    {new Date(dayData.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>
                      <div className="text-gray-500">Leads</div>
                      <div className="font-semibold">{dayData.metrics.leadsContacted}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Conversions</div>
                      <div className="font-semibold">{dayData.metrics.conversions}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Revenue</div>
                      <div className="font-semibold">₹{(dayData.metrics.revenue / 100000).toFixed(1)}L</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Active</div>
                      <div className="font-semibold">
                        {dayData.metrics.activeBDEs}/{dayData.metrics.totalBDEs}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-2">
                    <div className="text-gray-500 mb-1">Team Breakdown</div>
                    <div className="flex gap-2 flex-wrap">
                      {dayData.breakdown.exceeded > 0 && (
                        <span className="px-2 py-0.5 bg-green-900/50 text-green-400 rounded text-[10px]">
                          ⭐ {dayData.breakdown.exceeded}
                        </span>
                      )}
                      {dayData.breakdown.met > 0 && (
                        <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 rounded text-[10px]">
                          ✓ {dayData.breakdown.met}
                        </span>
                      )}
                      {dayData.breakdown.partial > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 rounded text-[10px]">
                          ~ {dayData.breakdown.partial}
                        </span>
                      )}
                      {dayData.breakdown.missed > 0 && (
                        <span className="px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-[10px]">
                          ✗ {dayData.breakdown.missed}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-gray-400">Performance:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('exceeded', 80) }} />
            <span className="text-gray-400">Exceeded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('met', 80) }} />
            <span className="text-gray-400">Met</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('partial', 80) }} />
            <span className="text-gray-400">Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('missed', 80) }} />
            <span className="text-gray-400">Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: getStatusColor('no_activity', 0) }} />
            <span className="text-gray-400">No Activity</span>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          {currentDay && <span className="text-orange-500">● </span>}
          Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  )
}
