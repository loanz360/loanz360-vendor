'use client'

/**
 * Team Calendar Component
 * Week/Month view calendar for team scheduling
 * Features:
 * - Week and month view modes
 * - Event display with colors
 * - Click to view/edit events
 * - Drag and drop (future)
 * - Conflict detection
 */

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent } from '@/lib/calendar/types'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  Filter,
  Users,
  Clock,
  MapPin,
  Video,
  AlertCircle
} from 'lucide-react'

// ==================== TYPES ====================

type ViewMode = 'week' | 'month'

interface CalendarEventWithConflicts extends CalendarEvent {
  hasConflict?: boolean
  conflictWith?: string[]
}

// ==================== COMPONENT ====================

export default function TeamCalendar({
  onEventClick,
  onNewEvent
}: {
  onEventClick?: (event: CalendarEvent) => void
  onNewEvent?: (date: Date) => void
}) {
  const supabase = createClient()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEventWithConflicts[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  // ==================== DATA LOADING ====================

  useEffect(() => {
    loadUsers()
    loadEvents()
  }, [currentDate, viewMode, selectedUserId])

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'cro')
        .order('full_name')

      if (error) throw error
      setUsers(data.map(u => ({ id: u.id, name: u.full_name || 'Unknown', email: u.email || '' })))
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadEvents = async () => {
    setLoading(true)
    try {
      const startDate = getViewStartDate()
      const endDate = getViewEndDate()

      // Get calendar providers
      const { data: providers } = await supabase
        .from('calendar_providers')
        .select('id, user_id')
        .eq('is_active', true)

      if (!providers || providers.length === 0) {
        setEvents([])
        return
      }

      // Filter by selected user if applicable
      const filteredProviders = selectedUserId
        ? providers.filter(p => p.user_id === selectedUserId)
        : providers

      // Load events from all providers
      const allEvents: CalendarEventWithConflicts[] = []
      for (const provider of filteredProviders) {
        const providerEvents = await googleCalendarService.getEvents(
          provider.id,
          startDate.toISOString(),
          endDate.toISOString()
        )
        allEvents.push(...providerEvents.map(e => ({ ...e, hasConflict: false, conflictWith: [] })))
      }

      // Detect conflicts
      const eventsWithConflicts = detectConflicts(allEvents)
      setEvents(eventsWithConflicts)
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const detectConflicts = (events: CalendarEventWithConflicts[]): CalendarEventWithConflicts[] => {
    const result = events.map(event => ({ ...event, hasConflict: false, conflictWith: [] }))

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const event1 = result[i]
        const event2 = result[j]

        if (eventsOverlap(event1, event2)) {
          event1.hasConflict = true
          event1.conflictWith = event1.conflictWith || []
          event1.conflictWith.push(event2.id)

          event2.hasConflict = true
          event2.conflictWith = event2.conflictWith || []
          event2.conflictWith.push(event1.id)
        }
      }
    }

    return result
  }

  const eventsOverlap = (e1: CalendarEvent, e2: CalendarEvent): boolean => {
    const start1 = new Date(e1.start_time)
    const end1 = new Date(e1.end_time)
    const start2 = new Date(e2.start_time)
    const end2 = new Date(e2.end_time)

    return start1 < end2 && start2 < end1
  }

  // ==================== DATE NAVIGATION ====================

  const getViewStartDate = (): Date => {
    if (viewMode === 'week') {
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() - currentDate.getDay()) // Start of week (Sunday)
      start.setHours(0, 0, 0, 0)
      return start
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return start
    }
  }

  const getViewEndDate = (): Date => {
    if (viewMode === 'week') {
      const end = new Date(currentDate)
      end.setDate(currentDate.getDate() + (6 - currentDate.getDay())) // End of week (Saturday)
      end.setHours(23, 59, 59, 999)
      return end
    } else {
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      end.setHours(23, 59, 59, 999)
      return end
    }
  }

  const navigatePrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const navigateToday = () => {
    setCurrentDate(new Date())
  }

  // ==================== RENDERING ====================

  const getWeekDays = (): Date[] => {
    const days: Date[] = []
    const start = getViewStartDate()
    for (let i = 0; i < 7; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getMonthDays = (): Date[] => {
    const days: Date[] = []
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    // Add days from previous month to fill the first week
    const firstDayOfWeek = firstDay.getDay()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(firstDay)
      day.setDate(day.getDate() - i - 1)
      days.push(day)
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const day = new Date(lastDay)
      day.setDate(lastDay.getDate() + i)
      days.push(day)
    }

    return days
  }

  const getEventsForDay = (date: Date): CalendarEventWithConflicts[] => {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    return events.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      return eventStart <= dayEnd && eventEnd >= dayStart
    })
  }

  const getEventsForHour = (date: Date, hour: number): CalendarEventWithConflicts[] => {
    const hourStart = new Date(date)
    hourStart.setHours(hour, 0, 0, 0)
    const hourEnd = new Date(date)
    hourEnd.setHours(hour, 59, 59, 999)

    return events.filter(event => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      return eventStart <= hourEnd && eventEnd >= hourStart
    })
  }

  const formatDateHeader = (): string => {
    if (viewMode === 'week') {
      const start = getViewStartDate()
      const end = getViewEndDate()
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  const isToday = (date: Date): boolean => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth()
  }

  // ==================== WEEK VIEW ====================

  const renderWeekView = () => {
    const weekDays = getWeekDays()
    const hours = Array.from({ length: 24 }, (_, i) => i)

    return (
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="p-4 text-sm font-medium text-gray-600">Time</div>
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={`p-4 text-center ${isToday(day) ? 'bg-blue-50' : ''}`}
              >
                <div className="text-sm font-medium text-gray-900">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`text-2xl font-bold ${
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Time slots */}
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
              <div className="p-2 text-sm text-gray-600 bg-gray-50">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {weekDays.map(day => {
                const dayEvents = getEventsForHour(day, hour)
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="p-1 border-l border-gray-100 hover:bg-gray-50 cursor-pointer min-h-[60px]"
                    onClick={() => {
                      const clickedDate = new Date(day)
                      clickedDate.setHours(hour, 0, 0, 0)
                      onNewEvent?.(clickedDate)
                    }}
                  >
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        onClick={e => {
                          e.stopPropagation()
                          onEventClick?.(event)
                        }}
                        className={`
                          mb-1 p-2 rounded text-xs cursor-pointer
                          ${event.hasConflict ? 'bg-red-100 border border-red-300' : 'bg-blue-100 border border-blue-300'}
                          hover:shadow-md transition-shadow
                        `}
                      >
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-gray-600 truncate">
                          {new Date(event.start_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                        {event.has_google_meet && (
                          <Video className="w-3 h-3 inline text-green-600" />
                        )}
                        {event.hasConflict && (
                          <AlertCircle className="w-3 h-3 inline text-red-600 ml-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ==================== MONTH VIEW ====================

  const renderMonthView = () => {
    const monthDays = getMonthDays()

    return (
      <div className="flex-1 overflow-auto">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-4 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {monthDays.map(day => {
            const dayEvents = getEventsForDay(day)
            return (
              <div
                key={day.toISOString()}
                className={`
                  min-h-[120px] border-b border-r border-gray-200 p-2
                  ${!isCurrentMonth(day) ? 'bg-gray-50' : 'bg-white'}
                  ${isToday(day) ? 'bg-blue-50' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
                onClick={() => onNewEvent?.(day)}
              >
                <div
                  className={`
                    text-sm font-medium mb-2
                    ${isToday(day) ? 'text-blue-600' : isCurrentMonth(day) ? 'text-gray-900' : 'text-gray-400'}
                  `}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      onClick={e => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                      className={`
                        text-xs p-1 rounded truncate cursor-pointer
                        ${event.hasConflict ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}
                        hover:shadow-md transition-shadow
                      `}
                    >
                      <Clock className="w-3 h-3 inline mr-1" />
                      {event.title}
                      {event.hasConflict && <AlertCircle className="w-3 h-3 inline ml-1 text-red-600" />}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-600 pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ==================== MAIN RENDER ====================

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={navigateToday}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={navigatePrevious}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={navigateNext}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h2 className="text-lg font-semibold text-gray-900">{formatDateHeader()}</h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* User filter */}
          {users.length > 0 && (
            <select
              value={selectedUserId || ''}
              onChange={e => setSelectedUserId(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          )}

          {/* View mode toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`
                px-3 py-1 text-sm font-medium rounded
                ${viewMode === 'week' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`
                px-3 py-1 text-sm font-medium rounded
                ${viewMode === 'month' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              Month
            </button>
          </div>

          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNewEvent?.(new Date())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            New Event
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {!loading && (
        <>
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
        </>
      )}
    </div>
  )
}
