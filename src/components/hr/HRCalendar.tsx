'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  title: string
  type: 'holiday' | 'leave' | 'birthday' | 'review' | 'meeting' | 'deadline'
  employeeName?: string
  description?: string
}

const eventColors: Record<string, { bg: string; text: string; dot: string }> = {
  holiday: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  leave: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  birthday: { bg: 'bg-pink-500/10', text: 'text-pink-400', dot: 'bg-pink-500' },
  review: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  meeting: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-500' },
  deadline: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-500' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface HRCalendarProps {
  events: CalendarEvent[]
  onDateClick?: (date: string) => void
  onEventClick?: (event: CalendarEvent) => void
}

export default function HRCalendar({ events, onDateClick, onEventClick }: HRCalendarProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events
    return events.filter(e => e.type === filterType)
  }, [events, filterType])

  // Build events map by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of filteredEvents) {
      if (!map[event.date]) map[event.date] = []
      map[event.date].push(event)
    }
    return map
  }, [filteredEvents])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate()

    const days: { date: number; month: 'prev' | 'current' | 'next'; dateStr: string }[] = []

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const m = currentMonth === 0 ? 11 : currentMonth - 1
      const y = currentMonth === 0 ? currentYear - 1 : currentYear
      days.push({ date: d, month: 'prev', dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: d, month: 'current', dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1
      const y = currentMonth === 11 ? currentYear + 1 : currentYear
      days.push({ date: d, month: 'next', dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }

    return days
  }, [currentMonth, currentYear])

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const handlePrevMonth = useCallback(() => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1) }
    else setCurrentMonth(prev => prev - 1)
  }, [currentMonth])

  const handleNextMonth = useCallback(() => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1) }
    else setCurrentMonth(prev => prev + 1)
  }, [currentMonth])

  const handleDateClick = useCallback((dateStr: string) => {
    setSelectedDate(dateStr === selectedDate ? null : dateStr)
    onDateClick?.(dateStr)
  }, [selectedDate, onDateClick])

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : []

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#FF6700]" />
          <h3 className="text-sm font-medium text-white">
            {MONTHS[currentMonth]} {currentYear}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 outline-none"
          >
            <option value="all">All Events</option>
            <option value="holiday">Holidays</option>
            <option value="leave">Leaves</option>
            <option value="birthday">Birthdays</option>
            <option value="review">Reviews</option>
            <option value="meeting">Meetings</option>
            <option value="deadline">Deadlines</option>
          </select>
          {/* Navigation */}
          <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
          <button onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()) }} className="px-2 py-0.5 text-[10px] text-[#FF6700] hover:bg-[#FF6700]/10 rounded">
            Today
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded" aria-label="Next month">
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {DAYS.map(day => (
          <div key={day} className="py-2 text-center text-[10px] font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dayEvents = eventsByDate[day.dateStr] || []
          const isToday = day.dateStr === todayStr
          const isSelected = day.dateStr === selectedDate
          const isSunday = idx % 7 === 0

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(day.dateStr)}
              className={`relative p-1.5 min-h-[60px] border-b border-r border-white/5 text-left transition-colors
                ${day.month !== 'current' ? 'opacity-30' : ''}
                ${isSelected ? 'bg-[#FF6700]/10' : 'hover:bg-white/5'}
                ${isSunday ? 'text-red-400/60' : ''}
              `}
            >
              <span className={`text-xs ${isToday ? 'w-5 h-5 rounded-full bg-[#FF6700] text-white flex items-center justify-center' : 'text-gray-400'}`}>
                {day.date}
              </span>
              {/* Event dots */}
              {dayEvents.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${eventColors[event.type]?.dot || 'bg-gray-500'}`} title={event.title} />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="border-t border-white/10 p-4">
          <h4 className="text-xs font-medium text-gray-400 mb-2">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h4>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-gray-500">No events on this date</p>
          ) : (
            <div className="space-y-1.5">
              {selectedEvents.map(event => {
                const colors = eventColors[event.type]
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left ${colors?.bg || 'bg-white/5'} hover:brightness-110 transition`}
                  >
                    <div className={`w-1.5 h-full min-h-[20px] rounded-full ${colors?.dot || 'bg-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-xs font-medium ${colors?.text || 'text-gray-300'}`}>{event.title}</span>
                      {event.employeeName && <p className="text-[10px] text-gray-500">{event.employeeName}</p>}
                    </div>
                    <span className="text-[9px] text-gray-600 capitalize">{event.type}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-white/10">
        {Object.entries(eventColors).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <span className="text-[9px] text-gray-500 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { CalendarEvent, HRCalendarProps }
