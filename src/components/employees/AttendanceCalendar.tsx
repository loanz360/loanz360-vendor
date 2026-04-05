'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'
import { STATUS_COLORS } from '@/lib/constants/theme'

interface AttendanceRecord {
  date: string
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'weekend' | 'half_day'
  check_in?: string
  check_out?: string
  is_late?: boolean
  leave_type?: string
  holiday_name?: string
}

interface AttendanceCalendarProps {
  userId: string
}

export default function AttendanceCalendar({ userId }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarData, setCalendarData] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null)
  const [showModal, setShowModal] = useState(false)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  useEffect(() => {
    loadCalendarData()
  }, [currentDate])

  // Close modal on Escape key
  const handleEscapeKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showModal) {
      setShowModal(false)
    }
  }, [showModal])

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [handleEscapeKey])

  const loadCalendarData = async () => {
    setIsLoading(true)
    setCalendarError(null)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      const res = await fetch(
        `/api/employees/attendance/calendar?year=${year}&month=${month}&user_id=${userId}`
      )

      if (!res.ok) {
        setCalendarError(`Failed to load calendar data (${res.status})`)
        return
      }

      const data = await res.json()

      if (data.success) {
        setCalendarData(data.data)
      } else {
        setCalendarError(data.error || 'Failed to load calendar data')
      }
    } catch (error) {
      clientLogger.error('Failed to load calendar data', { error })
      setCalendarError('Unable to load attendance calendar. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const days: (AttendanceRecord | null)[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const record = calendarData.find(r => r.date === dateStr)

      if (record) {
        days.push(record)
      } else {
        // Check if it's a weekend
        const dayOfWeek = new Date(year, month, day).getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        days.push({
          date: dateStr,
          status: isWeekend ? 'weekend' : 'absent'
        })
      }
    }

    return days
  }

  const getStatusColor = (status: string, isLate?: boolean) => {
    if (isLate) return STATUS_COLORS.late
    const normalized = status.toLowerCase().replace(/[\s-]/g, '_') as keyof typeof STATUS_COLORS
    return STATUS_COLORS[normalized] || 'bg-gray-800/30 text-gray-500 border-gray-700'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return '✓'
      case 'absent':
        return '✗'
      case 'leave':
        return 'L'
      case 'holiday':
        return 'H'
      case 'weekend':
        return 'W'
      case 'half_day':
        return 'H/D'
      default:
        return ''
    }
  }

  const handleDayClick = (day: AttendanceRecord | null) => {
    if (day) {
      setSelectedDay(day)
      setShowModal(true)
    }
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'N/A'
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const days = getDaysInMonth()

  return (
    <div className="frosted-card p-8 rounded-lg">
      {/* Error Display */}
      {calendarError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{calendarError}</p>
          <button
            onClick={loadCalendarData}
            className="text-orange-400 hover:text-orange-300 text-sm font-medium ml-4 flex-shrink-0"
            aria-label="Retry loading calendar data"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-orange-500" />
          <h2 className="text-2xl font-bold font-poppins">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={previousMonth}
            className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextMonth}
            className="bg-gray-800 text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs">
        {([
          { key: 'present', label: 'Present' },
          { key: 'late', label: 'Late' },
          { key: 'leave', label: 'Leave' },
          { key: 'holiday', label: 'Holiday' },
          { key: 'absent', label: 'Absent' },
          { key: 'weekend', label: 'Weekend' },
        ] as const).map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border ${STATUS_COLORS[key]}`}></div>
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day names header */}
        {dayNames.map(name => (
          <div key={name} className="text-center font-semibold text-gray-400 py-2">
            {name}
          </div>
        ))}

        {/* Calendar days */}
        {isLoading ? (
          <div className="col-span-7 text-center py-12 text-gray-400">
            Loading calendar...
          </div>
        ) : (
          days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square"></div>
            }

            const dayNum = new Date(day.date).getDate()
            const isToday = day.date === new Date().toISOString().split('T')[0]

            return (
              <button
                key={day.date}
                onClick={() => handleDayClick(day)}
                className={`aspect-square border-2 rounded-lg p-2 transition-all hover:scale-105 ${
                  getStatusColor(day.status, day.is_late)
                } ${isToday ? 'ring-2 ring-white' : ''}`}
                aria-label={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} - ${day.status.replace(/_/g, ' ')}${day.is_late ? ' (late)' : ''}${isToday ? ' (today)' : ''}`}
              >
                <div className="flex flex-col h-full">
                  <span className="text-lg font-bold">{dayNum}</span>
                  <span className="text-xs mt-auto">{getStatusIcon(day.status)}</span>
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Detail Modal */}
      {showModal && selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Attendance day details"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                getStatusColor(selectedDay.status, selectedDay.is_late)
              }`}>
                <span className="text-2xl font-bold">{getStatusIcon(selectedDay.status)}</span>
              </div>

              <h2 className="text-2xl font-bold text-center mb-2 font-poppins">
                {new Date(selectedDay.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h2>

              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status</span>
                  <span className={`font-semibold capitalize ${
                    selectedDay.status === 'present' ? 'text-green-400' :
                    selectedDay.status === 'leave' ? 'text-blue-400' :
                    selectedDay.status === 'holiday' ? 'text-purple-400' :
                    selectedDay.status === 'absent' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {selectedDay.status.replace(/_/g, ' ')}
                    {selectedDay.is_late && ' (Late)'}
                  </span>
                </div>

                {selectedDay.status === 'present' && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Check In</span>
                      <span className="text-white font-semibold">
                        {formatTime(selectedDay.check_in)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Check Out</span>
                      <span className="text-white font-semibold">
                        {formatTime(selectedDay.check_out)}
                      </span>
                    </div>
                  </>
                )}

                {selectedDay.status === 'leave' && selectedDay.leave_type && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Leave Type</span>
                    <span className="text-blue-400 font-semibold">{selectedDay.leave_type}</span>
                  </div>
                )}

                {selectedDay.status === 'holiday' && selectedDay.holiday_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Holiday</span>
                    <span className="text-purple-400 font-semibold">{selectedDay.holiday_name}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full mt-6 bg-gray-800 text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                aria-label="Close day details"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
