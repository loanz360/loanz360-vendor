'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone,
  TrendingUp,
  MessageSquare,
  Clock,
  Star,
  Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────────

interface ActivityDataPoint {
  dayOfWeek: number // 0=Monday, 6=Sunday
  hour: number // 0-23
  count: number
  successRate?: number
}

interface ActivityHeatmapProps {
  data: ActivityDataPoint[]
  metric?: 'calls' | 'conversions' | 'responses'
  bestTime?: { day: string; hour: string; reason: string }
}

// ── Constants ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Display hours: 8AM - 8PM (indices 8 through 20)
const DISPLAY_HOURS_START = 8
const DISPLAY_HOURS_END = 20
const DISPLAY_HOURS = Array.from(
  { length: DISPLAY_HOURS_END - DISPLAY_HOURS_START + 1 },
  (_, i) => DISPLAY_HOURS_START + i
)

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 12) return hour === 0 ? '12AM' : '12PM'
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`
}

const METRIC_CONFIG = {
  calls: {
    label: 'Calls',
    icon: Phone,
    unit: 'calls',
  },
  conversions: {
    label: 'Conversions',
    icon: TrendingUp,
    unit: 'conversions',
  },
  responses: {
    label: 'Responses',
    icon: MessageSquare,
    unit: 'responses',
  },
}

// Color scale: dark -> green -> bright green -> orange (peak)
// 5 levels including zero
const INTENSITY_COLORS = [
  { bg: 'bg-white/[0.03]', border: 'border-white/5', label: 'No activity' },
  { bg: 'bg-emerald-900/40', border: 'border-emerald-800/30', label: 'Low' },
  { bg: 'bg-emerald-600/50', border: 'border-emerald-600/30', label: 'Medium' },
  { bg: 'bg-green-500/60', border: 'border-green-500/30', label: 'High' },
  { bg: 'bg-orange-500/70', border: 'border-orange-500/40', label: 'Peak' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getIntensityLevel(count: number, maxCount: number): number {
  if (count === 0 || maxCount === 0) return 0
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

// ── Tooltip ──────────────────────────────────────────────────────────────────────

interface TooltipData {
  day: string
  hour: string
  count: number
  successRate?: number
  x: number
  y: number
}

function HeatmapTooltip({
  data,
  metric,
}: {
  data: TooltipData
  metric: 'calls' | 'conversions' | 'responses'
}) {
  const config = METRIC_CONFIG[metric]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 4 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[100] pointer-events-none"
      style={{ left: data.x, top: data.y - 8, transform: 'translate(-50%, -100%)' }}
    >
      <div className="bg-gray-900 border border-white/15 rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/50 min-w-[160px]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-100">
            {data.day}, {data.hour}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <config.icon className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-sm font-bold text-white tabular-nums">
            {data.count}
          </span>
          <span className="text-xs text-gray-500">{config.unit}</span>
        </div>
        {data.successRate !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-gray-300 tabular-nums">
              {data.successRate}% success rate
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────────

export default function ActivityHeatmap({
  data,
  metric = 'calls',
  bestTime,
}: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const metricConfig = METRIC_CONFIG[metric]
  const MetricIcon = metricConfig.icon

  // Build a lookup map for O(1) access: "day-hour" -> dataPoint
  const dataMap = useMemo(() => {
    const map = new Map<string, ActivityDataPoint>()
    for (const point of data) {
      map.set(`${point.dayOfWeek}-${point.hour}`, point)
    }
    return map
  }, [data])

  // Compute max count for intensity scaling
  const maxCount = useMemo(() => {
    if (data.length === 0) return 0
    return Math.max(...data.map(d => d.count))
  }, [data])

  // Compute total activity
  const totalActivity = useMemo(() => {
    return data.reduce((sum, d) => sum + d.count, 0)
  }, [data])

  // Compute average success rate
  const avgSuccessRate = useMemo(() => {
    const withRate = data.filter(d => d.successRate !== undefined)
    if (withRate.length === 0) return null
    const sum = withRate.reduce((acc, d) => acc + (d.successRate || 0), 0)
    return Math.round(sum / withRate.length)
  }, [data])

  const handleCellHover = useCallback(
    (dayIdx: number, hour: number, e: React.MouseEvent) => {
      const point = dataMap.get(`${dayIdx}-${hour}`)
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      setTooltip({
        day: DAY_LABELS[dayIdx],
        hour: formatHourLabel(hour),
        count: point?.count ?? 0,
        successRate: point?.successRate,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
    },
    [dataMap]
  )

  const handleCellLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <MetricIcon className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">
              Activity Heatmap
            </h3>
            <p className="text-[11px] text-gray-500">
              Weekly {metricConfig.label.toLowerCase()} pattern
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold text-gray-100 tabular-nums">
              {totalActivity.toLocaleString()}
            </p>
          </div>
          {avgSuccessRate !== null && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Avg Success</p>
              <p className="text-sm font-bold text-green-400 tabular-nums">
                {avgSuccessRate}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="px-4 py-4 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels (X-axis) */}
          <div className="flex ml-12 mb-2">
            {DISPLAY_HOURS.map(hour => (
              <div
                key={hour}
                className="flex-1 text-center text-[10px] text-gray-500 tabular-nums"
              >
                {/* Show every other label to avoid crowding */}
                {hour % 2 === 0 ? formatHourLabel(hour) : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="space-y-1">
            {DAY_LABELS.map((day, dayIdx) => (
              <div key={day} className="flex items-center gap-2">
                {/* Day label (Y-axis) */}
                <span className="w-10 text-right text-[11px] text-gray-500 font-medium flex-shrink-0">
                  {day}
                </span>

                {/* Hour cells */}
                <div className="flex flex-1 gap-1">
                  {DISPLAY_HOURS.map(hour => {
                    const point = dataMap.get(`${dayIdx}-${hour}`)
                    const count = point?.count ?? 0
                    const level = getIntensityLevel(count, maxCount)
                    const colorConfig = INTENSITY_COLORS[level]

                    return (
                      <div
                        key={hour}
                        className={`
                          flex-1 aspect-square rounded-[4px] border cursor-pointer
                          transition-all duration-150
                          hover:scale-110 hover:z-10 hover:shadow-lg hover:shadow-black/30
                          ${colorConfig.bg} ${colorConfig.border}
                        `}
                        onMouseEnter={e => handleCellHover(dayIdx, hour, e)}
                        onMouseLeave={handleCellLeave}
                        role="gridcell"
                        aria-label={`${day} ${formatHourLabel(hour)}: ${count} ${metricConfig.unit}`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            Less
          </span>
          <div className="flex items-center gap-1">
            {INTENSITY_COLORS.map((config, idx) => (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-[3px] border ${config.bg} ${config.border}`}
                title={config.label}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            More
          </span>
        </div>
        <span className="text-[10px] text-gray-600">
          Peak: {maxCount > 0 ? `${maxCount} ${metricConfig.unit}` : 'No data'}
        </span>
      </div>

      {/* Best Time Indicator */}
      {bestTime && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Star className="w-4 h-4 text-orange-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-orange-400">
                  Best Time to Call
                </span>
                <Clock className="w-3 h-3 text-orange-500/60" />
              </div>
              <p className="text-sm font-medium text-gray-100 mt-0.5">
                {bestTime.day}, {bestTime.hour}
              </p>
              <div className="flex items-start gap-1 mt-1">
                <Info className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {bestTime.reason}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Tooltip */}
      <AnimatePresence>
        {tooltip && <HeatmapTooltip data={tooltip} metric={metric} />}
      </AnimatePresence>
    </div>
  )
}
