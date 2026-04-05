'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Sun,
  Sunset,
  CalendarDays,
  CalendarClock,
  X,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleSendPickerProps {
  onSchedule: (scheduledAt: string) => void
  onCancel: () => void
}

interface QuickOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  getDate: () => Date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextWeekday(dayOfWeek: number, hour: number, minute: number): Date {
  const now = new Date()
  const result = new Date(now)
  const diff = (dayOfWeek - now.getDay() + 7) % 7 || 7
  result.setDate(now.getDate() + diff)
  result.setHours(hour, minute, 0, 0)
  return result
}

function getTomorrow(hour: number, minute: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hour, minute, 0, 0)
  return d
}

function getNextWeek(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(9, 0, 0, 0)
  return d
}

function formatScheduleDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function padZero(n: number): string {
  return n.toString().padStart(2, '0')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScheduleSendPicker({ onSchedule, onCancel }: ScheduleSendPickerProps) {
  const [mode, setMode] = useState<'quick' | 'custom'>('quick')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState('09:00')
  const [error, setError] = useState<string | null>(null)

  const timezone = useMemo(() => getUserTimezone(), [])

  const quickOptions: QuickOption[] = useMemo(
    () => [
      {
        id: 'tomorrow-morning',
        label: 'Tomorrow morning',
        description: '9:00 AM',
        icon: <Sun className="h-4 w-4 text-amber-400" />,
        getDate: () => getTomorrow(9, 0),
      },
      {
        id: 'tomorrow-afternoon',
        label: 'Tomorrow afternoon',
        description: '2:00 PM',
        icon: <Sunset className="h-4 w-4 text-orange-400" />,
        getDate: () => getTomorrow(14, 0),
      },
      {
        id: 'monday-morning',
        label: 'Monday morning',
        description: '9:00 AM',
        icon: <CalendarDays className="h-4 w-4 text-blue-400" />,
        getDate: () => getNextWeekday(1, 9, 0),
      },
      {
        id: 'next-week',
        label: 'Next week',
        description: 'Same day, 9:00 AM',
        icon: <CalendarClock className="h-4 w-4 text-purple-400" />,
        getDate: () => getNextWeek(),
      },
    ],
    []
  )

  const handleQuickSelect = (option: QuickOption) => {
    const date = option.getDate()
    onSchedule(date.toISOString())
  }

  const handleCustomSchedule = () => {
    setError(null)

    if (!selectedDate) {
      setError('Please select a date')
      return
    }

    const [hours, minutes] = selectedTime.split(':').map(Number)
    const scheduled = new Date(selectedDate)
    scheduled.setHours(hours, minutes, 0, 0)

    const now = new Date()
    if (scheduled <= now) {
      setError('Cannot schedule in the past. Please pick a future date and time.')
      return
    }

    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30)
    if (scheduled > maxDate) {
      setError('Cannot schedule more than 30 days in the future.')
      return
    }

    onSchedule(scheduled.toISOString())
  }

  // Calendar constraints
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxCalendarDate = new Date()
  maxCalendarDate.setDate(maxCalendarDate.getDate() + 30)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      className="w-[340px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#FF6700]" />
          <span className="text-sm font-medium text-slate-100">Schedule Send</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-7 w-7 text-slate-400 hover:text-slate-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Timezone indicator */}
      <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-700/50">
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Timezone: <span className="text-slate-400 font-medium">{timezone}</span>
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => { setMode('quick'); setError(null) }}
          className={cn(
            'flex-1 px-4 py-2 text-xs font-medium transition-colors',
            mode === 'quick'
              ? 'text-[#FF6700] border-b-2 border-[#FF6700] bg-[#FF6700]/5'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Quick Options
        </button>
        <button
          onClick={() => { setMode('custom'); setError(null) }}
          className={cn(
            'flex-1 px-4 py-2 text-xs font-medium transition-colors',
            mode === 'custom'
              ? 'text-[#FF6700] border-b-2 border-[#FF6700] bg-[#FF6700]/5'
              : 'text-slate-400 hover:text-slate-200'
          )}
        >
          Custom Date & Time
        </button>
      </div>

      {/* Body */}
      <div className="p-4">
        {mode === 'quick' ? (
          <div className="space-y-2">
            {quickOptions.map((option) => {
              const schedDate = option.getDate()
              return (
                <button
                  key={option.id}
                  onClick={() => handleQuickSelect(option)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 hover:border-slate-600 transition-colors text-left group"
                >
                  <span className="flex-shrink-0 p-2 rounded-md bg-slate-700/50 group-hover:bg-slate-600/50 transition-colors">
                    {option.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100">
                      {option.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatScheduleDate(schedDate)}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-600 group-hover:text-slate-400 font-medium">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Calendar */}
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  const d = new Date(date)
                  d.setHours(0, 0, 0, 0)
                  return d < today || d > maxCalendarDate
                }}
                className="rounded-md border border-slate-700 bg-slate-800/60"
              />
            </div>

            {/* Time picker */}
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Time</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => {
                  setSelectedTime(e.target.value)
                  setError(null)
                }}
                className="bg-slate-800 border-slate-700 text-slate-200 focus-visible:ring-[#FF6700]/40"
              />
            </div>

            {/* Selected summary */}
            {selectedDate && (
              <div className="px-3 py-2 rounded-lg bg-slate-700/30 border border-slate-700/50">
                <p className="text-xs text-slate-400">Scheduled for:</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5">
                  {(() => {
                    const [h, m] = selectedTime.split(':').map(Number)
                    const preview = new Date(selectedDate)
                    preview.setHours(h, m, 0, 0)
                    return formatScheduleDate(preview)
                  })()}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="flex-1 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCustomSchedule}
                className="flex-1 bg-[#FF6700] hover:bg-[#FF6700]/90 text-white"
              >
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                Schedule
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
