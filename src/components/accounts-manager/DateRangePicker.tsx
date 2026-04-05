'use client'

import React from 'react'
import { Calendar } from 'lucide-react'

interface Props {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  onRangeChange: (start: string, end: string) => void
  presets?: boolean
  className?: string
}

type PresetKey = 'today' | 'this_week' | 'this_month' | 'last_30' | 'this_quarter'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_30', label: 'Last 30 Days' },
  { key: 'this_quarter', label: 'This Quarter' },
]

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getPresetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date()
  const today = toYMD(now)

  switch (key) {
    case 'today':
      return { start: today, end: today }
    case 'this_week': {
      const day = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((day + 6) % 7))
      return { start: toYMD(monday), end: today }
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: toYMD(first), end: today }
    }
    case 'last_30': {
      const past = new Date(now)
      past.setDate(now.getDate() - 29)
      return { start: toYMD(past), end: today }
    }
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      const qStart = new Date(now.getFullYear(), qMonth, 1)
      return { start: toYMD(qStart), end: today }
    }
  }
}

function getActivePreset(startDate: string, endDate: string): PresetKey | null {
  for (const preset of PRESETS) {
    const range = getPresetRange(preset.key)
    if (range.start === startDate && range.end === endDate) return preset.key
  }
  return null
}

export default function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  presets = true,
  className = '',
}: Props) {
  const activePreset = getActivePreset(startDate, endDate)

  const handlePreset = (key: PresetKey) => {
    const range = getPresetRange(key)
    onRangeChange(range.start, range.end)
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Preset chips */}
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePreset(preset.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activePreset === preset.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200 border border-gray-700/50'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Date inputs */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => onRangeChange(e.target.value, endDate)}
            className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 backdrop-blur-sm [color-scheme:dark]"
          />
        </div>
        <span className="text-gray-600 text-xs font-medium">to</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onRangeChange(startDate, e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-700/50 text-sm text-gray-200 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 backdrop-blur-sm [color-scheme:dark]"
          />
        </div>
      </div>
    </div>
  )
}
