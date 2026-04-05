'use client'

import React, { useState } from 'react'
import {
  User,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  Edit2,
  DollarSign,
  Calendar,
  Upload,
  Download,
  Send,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  Info,
  ChevronDown,
} from 'lucide-react'

interface TimelineEvent {
  id: string
  type: string
  typeLabel: string
  icon: string
  color: string
  title: string
  description: string
  userName: string
  userAvatar: string | null
  userRole?: string
  timestamp: string
  timestampFormatted: string
  metadata?: Record<string, any>
  relativeTime?: string
}

interface TimelineProps {
  events: TimelineEvent[]
  isLoading?: boolean
  showLoadMore?: boolean
  onLoadMore?: () => void
  variant?: 'full' | 'compact'
  maxEvents?: number
}

export function Timeline({
  events,
  isLoading = false,
  showLoadMore = false,
  onLoadMore,
  variant = 'full',
  maxEvents,
}: TimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())

  const displayEvents = maxEvents ? events.slice(0, maxEvents) : events

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return next
    })
  }

  const getEventIcon = (icon: string, color: string) => {
    const iconMap: Record<string, any> = {
      user: User,
      edit: Edit2,
      phone: Phone,
      mail: Mail,
      file: FileText,
      message: MessageSquare,
      check: CheckCircle,
      alert: AlertCircle,
      clock: Clock,
      dollar: DollarSign,
      calendar: Calendar,
      upload: Upload,
      download: Download,
      send: Send,
      userplus: UserPlus,
      trending: TrendingUp,
      warning: AlertTriangle,
      info: Info,
    }

    const IconComponent = iconMap[icon.toLowerCase()] || Clock

    return (
      <div
        className={`${variant === 'full' ? 'w-12 h-12' : 'w-8 h-8'} rounded-full flex items-center justify-center flex-shrink-0 z-10`}
        style={{ backgroundColor: `${color}20`, color }}
      >
        <IconComponent className={variant === 'full' ? 'w-5 h-5' : 'w-4 h-4'} />
      </div>
    )
  }

  const getTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      created: '#10B981',
      updated: '#3B82F6',
      status_change: '#8B5CF6',
      communication: '#F59E0B',
      document: '#06B6D4',
      note: '#EC4899',
      assignment: '#14B8A6',
      payment: '#10B981',
      alert: '#EF4444',
      info: '#6B7280',
    }
    return colorMap[type] || '#6B7280'
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <div className={`${variant === 'full' ? 'w-12 h-12' : 'w-8 h-8'} rounded-full bg-gray-200 animate-pulse`} />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="font-medium">No timeline events</p>
        <p className="text-sm">Events will appear here as actions are taken</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline Line */}
      {variant === 'full' && displayEvents.length > 1 && (
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Events */}
      <div className={variant === 'full' ? 'space-y-6' : 'space-y-3'}>
        {displayEvents.map((event, index) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Icon */}
            {getEventIcon(event.icon, event.color)}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {variant === 'full' ? (
                <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                      <p className="text-sm text-gray-600">{event.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {event.relativeTime && (
                        <span className="text-xs text-gray-500">{event.relativeTime}</span>
                      )}
                      <span className="text-xs text-gray-500">{event.timestampFormatted}</span>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3 h-3" />
                    <span className="font-medium">{event.userName}</span>
                    {event.userRole && (
                      <>
                        <span>•</span>
                        <span>{event.userRole}</span>
                      </>
                    )}
                  </div>

                  {/* Metadata */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <button
                        onClick={() => toggleExpand(event.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {expandedEvents.has(event.id) ? 'Hide' : 'Show'} Details
                        <ChevronDown className={`w-3 h-3 transition-transform ${
                          expandedEvents.has(event.id) ? 'rotate-180' : ''
                        }`} />
                      </button>

                      {expandedEvents.has(event.id) && (
                        <div className="mt-2 bg-white rounded border border-gray-200 p-3">
                          <dl className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <div key={key}>
                                <dt className="text-gray-600 font-medium capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </dt>
                                <dd className="text-gray-900">{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // Compact variant
                <div className="border-l-2 pl-3 pb-3" style={{ borderColor: event.color }}>
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="text-sm font-medium text-gray-900">{event.title}</h5>
                    <span className="text-xs text-gray-500">{event.timestampFormatted}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{event.description}</p>
                  <p className="text-xs text-gray-500">{event.userName}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {showLoadMore && onLoadMore && (
        <div className="text-center mt-6">
          <button
            onClick={onLoadMore}
            className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Load More Events
          </button>
        </div>
      )}

      {/* Total Events Indicator */}
      {maxEvents && events.length > maxEvents && (
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            Showing {maxEvents} of {events.length} events
          </p>
        </div>
      )}
    </div>
  )
}

// Compact timeline for dashboard widgets
export function TimelineCompact({ events, maxEvents = 5 }: { events: TimelineEvent[]; maxEvents?: number }) {
  return (
    <Timeline
      events={events}
      variant="compact"
      maxEvents={maxEvents}
    />
  )
}

// Timeline with grouping by date
export function TimelineGrouped({ events }: { events: TimelineEvent[] }) {
  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(event)
    return groups
  }, {} as Record<string, TimelineEvent[]>)

  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date}>
          <div className="sticky top-0 bg-white py-2 mb-4 border-b border-gray-200 z-20">
            <h3 className="text-sm font-semibold text-gray-900">{date}</h3>
            <p className="text-xs text-gray-500">{dateEvents.length} events</p>
          </div>
          <Timeline events={dateEvents} variant="full" />
        </div>
      ))}
    </div>
  )
}

// Timeline with filtering
export function TimelineFiltered({ events }: { events: TimelineEvent[] }) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const eventTypes = Array.from(new Set(events.map(e => e.type)))

  const filteredEvents = selectedTypes.length > 0
    ? events.filter(e => selectedTypes.includes(e.type))
    : events

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">Filter by type:</span>
        <button
          onClick={() => setSelectedTypes([])}
          className={`px-3 py-1 rounded text-xs font-medium ${
            selectedTypes.length === 0
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({events.length})
        </button>
        {eventTypes.map(type => {
          const count = events.filter(e => e.type === type).length
          return (
            <button
              key={type}
              onClick={() => {
                setSelectedTypes(prev =>
                  prev.includes(type)
                    ? prev.filter(t => t !== type)
                    : [...prev, type]
                )
              }}
              className={`px-3 py-1 rounded text-xs font-medium ${
                selectedTypes.includes(type)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({count})
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      <Timeline events={filteredEvents} variant="full" />
    </div>
  )
}
