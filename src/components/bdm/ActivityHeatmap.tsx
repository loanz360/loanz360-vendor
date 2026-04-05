'use client'

import React from 'react'

interface HourData {
  hour: number
  activityCount: number
  intensity: number
  intensityLevel: 'none' | 'low' | 'medium' | 'high'
}

interface DayData {
  day: string
  dayIndex: number
  hours: HourData[]
  totalActivity: number
}

interface BDEActivity {
  bdeId: string
  bdeName: string
  activityByDay: DayData[]
  totalActivity: number
  peakHours: Array<{ day: string; hour: number; count: number }>
  avgDailyActivity: number
}

interface ActivityHeatmapProps {
  data: BDEActivity[]
  selectedBDE?: string
  onBDESelect?: (bdeId: string) => void
  isLoading?: boolean
}

export function ActivityHeatmap({
  data,
  selectedBDE,
  onBDESelect,
  isLoading = false,
}: ActivityHeatmapProps) {
  if (isLoading) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-gray-500">
        No activity data available
      </div>
    )
  }

  const displayData = selectedBDE
    ? data.filter(d => d.bdeId === selectedBDE)
    : data

  const getIntensityColor = (level: string) => {
    const colors = {
      none: '#F3F4F6',
      low: '#DBEAFE',
      medium: '#93C5FD',
      high: '#3B82F6',
    }
    return colors[level as keyof typeof colors] || colors.none
  }

  const getIntensityLabel = (level: string) => {
    const labels = {
      none: 'No Activity',
      low: 'Low Activity',
      medium: 'Medium Activity',
      high: 'High Activity',
    }
    return labels[level as keyof typeof labels] || 'No Activity'
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  return (
    <div className="space-y-6">
      {/* BDE Selector */}
      {data.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">Select BDE:</span>
          <button
            onClick={() => onBDESelect?.('')}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              !selectedBDE
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({data.length})
          </button>
          {data.map(bde => (
            <button
              key={bde.bdeId}
              onClick={() => onBDESelect?.(bde.bdeId)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedBDE === bde.bdeId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {bde.bdeName}
            </button>
          ))}
        </div>
      )}

      {/* Heatmaps */}
      <div className="space-y-8">
        {displayData.map(bde => (
          <div key={bde.bdeId} className="bg-white rounded-lg border border-gray-200 p-6">
            {/* BDE Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{bde.bdeName}</h3>
                <p className="text-sm text-gray-600">
                  Total Activity: <span className="font-medium">{bde.totalActivity}</span>
                  {' | '}
                  Daily Avg: <span className="font-medium">{bde.avgDailyActivity}</span>
                </p>
              </div>

              {/* Peak Hours */}
              {bde.peakHours.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-600 mb-1">Peak Activity Hours</p>
                  <div className="flex gap-2">
                    {bde.peakHours.slice(0, 3).map((peak, idx) => (
                      <div
                        key={idx}
                        className="bg-blue-50 border border-blue-200 rounded px-2 py-1"
                      >
                        <p className="text-xs font-medium text-blue-900">
                          {peak.day.slice(0, 3)} {peak.hour}:00
                        </p>
                        <p className="text-xs text-blue-700">{peak.count} activities</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Hour Labels */}
                <div className="flex items-center mb-2">
                  <div className="w-24 flex-shrink-0" />
                  <div className="flex gap-0.5">
                    {hours.map(hour => (
                      <div
                        key={hour}
                        className="w-8 text-center text-xs text-gray-600"
                      >
                        {hour % 3 === 0 ? hour : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day Rows */}
                {bde.activityByDay.map(dayData => (
                  <div key={dayData.dayIndex} className="flex items-center mb-1">
                    {/* Day Label */}
                    <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700 text-right pr-3">
                      {dayData.day.slice(0, 3)}
                    </div>

                    {/* Hour Cells */}
                    <div className="flex gap-0.5">
                      {dayData.hours.map(hourData => (
                        <div
                          key={hourData.hour}
                          className="w-8 h-8 rounded group relative cursor-pointer transition-transform hover:scale-110"
                          style={{
                            backgroundColor: getIntensityColor(hourData.intensityLevel),
                          }}
                          title={`${dayData.day} ${hourData.hour}:00 - ${hourData.activityCount} activities (${hourData.intensity}% intensity)`}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            <div className="font-medium">{dayData.day} {hourData.hour}:00</div>
                            <div>{hourData.activityCount} activities</div>
                            <div>{getIntensityLabel(hourData.intensityLevel)}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Day Total */}
                    <div className="ml-3 text-sm text-gray-600 font-medium">
                      {dayData.totalActivity}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-600">Activity Level:</span>
                <div className="flex items-center gap-2">
                  {['none', 'low', 'medium', 'high'].map(level => (
                    <div key={level} className="flex items-center gap-1">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: getIntensityColor(level) }}
                      />
                      <span className="text-xs text-gray-600 capitalize">{level}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Hover over cells for details
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      {data.length > 1 && !selectedBDE && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h4 className="text-sm font-semibold text-blue-900 mb-3">Team Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-blue-700">Total Team Activity</p>
              <p className="text-2xl font-bold text-blue-900">
                {data.reduce((sum, bde) => sum + bde.totalActivity, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-700">Avg Per BDE</p>
              <p className="text-2xl font-bold text-blue-900">
                {Math.round(data.reduce((sum, bde) => sum + bde.totalActivity, 0) / data.length)}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-700">Most Active BDE</p>
              <p className="text-lg font-bold text-blue-900">
                {data.reduce((max, bde) => bde.totalActivity > max.totalActivity ? bde : max).bdeName}
              </p>
            </div>
            <div>
              <p className="text-xs text-blue-700">Team Avg Daily</p>
              <p className="text-2xl font-bold text-blue-900">
                {Math.round(data.reduce((sum, bde) => sum + bde.avgDailyActivity, 0) / data.length)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact heatmap for dashboard widgets
export function ActivityHeatmapCompact({ data }: { data: BDEActivity }) {
  if (!data || !data.activityByDay) return null

  const getIntensityColor = (level: string) => {
    const colors = {
      none: '#F3F4F6',
      low: '#DBEAFE',
      medium: '#93C5FD',
      high: '#3B82F6',
    }
    return colors[level as keyof typeof colors] || colors.none
  }

  return (
    <div className="space-y-1">
      {data.activityByDay.map(dayData => (
        <div key={dayData.dayIndex} className="flex gap-0.5">
          {dayData.hours.filter((_, i) => i % 2 === 0).map(hourData => (
            <div
              key={hourData.hour}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: getIntensityColor(hourData.intensityLevel),
              }}
              title={`${hourData.activityCount} activities`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
