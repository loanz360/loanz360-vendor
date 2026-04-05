'use client'

import React, { useState } from 'react'
import { Calendar, Briefcase, TrendingUp, DollarSign, FileText, Award, UserMinus, UserPlus, Clock, ChevronDown, Filter } from 'lucide-react'

interface TimelineEvent {
  id: string
  date: string
  type: 'joining' | 'promotion' | 'salary_change' | 'review' | 'leave' | 'award' | 'warning' | 'resignation' | 'department_change' | 'role_change'
  title: string
  description: string
  metadata?: Record<string, string | number>
}

const eventConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  joining: { icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  promotion: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  salary_change: { icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/20' },
  review: { icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  leave: { icon: Calendar, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  award: { icon: Award, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  warning: { icon: Clock, color: 'text-red-400', bg: 'bg-red-500/20' },
  resignation: { icon: UserMinus, color: 'text-red-400', bg: 'bg-red-500/20' },
  department_change: { icon: Briefcase, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  role_change: { icon: Briefcase, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
}

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'joining', label: 'Joining' },
  { value: 'promotion', label: 'Promotions' },
  { value: 'salary_change', label: 'Salary Changes' },
  { value: 'review', label: 'Reviews' },
  { value: 'leave', label: 'Leaves' },
  { value: 'award', label: 'Awards' },
  { value: 'warning', label: 'Warnings' },
  { value: 'resignation', label: 'Resignation' },
  { value: 'department_change', label: 'Dept Changes' },
  { value: 'role_change', label: 'Role Changes' },
]

interface EmployeeTimelineProps {
  events: TimelineEvent[]
  employeeName?: string
}

export default function EmployeeTimeline({ events, employeeName }: EmployeeTimelineProps) {
  const [filterType, setFilterType] = useState('all')
  const [showAll, setShowAll] = useState(false)

  const filteredEvents = React.useMemo(() => {
    const sorted = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (filterType === 'all') return sorted
    return sorted.filter(e => e.type === filterType)
  }, [events, filterType])

  const displayEvents = showAll ? filteredEvents : filteredEvents.slice(0, 10)

  // Group events by year
  const groupedByYear = React.useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {}
    for (const event of displayEvents) {
      const year = new Date(event.date).getFullYear().toString()
      if (!groups[year]) groups[year] = []
      groups[year].push(event)
    }
    return groups
  }, [displayEvents])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          {employeeName ? `${employeeName}'s Timeline` : 'Employee Timeline'}
        </h3>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded text-xs text-gray-300 px-2 py-1 outline-none"
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Timeline */}
      {Object.entries(groupedByYear).map(([year, yearEvents]) => (
        <div key={year}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-[#FF6700]">{year}</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="space-y-1 ml-1">
            {yearEvents.map((event, idx) => {
              const config = eventConfig[event.type] || eventConfig.joining
              const Icon = config.icon
              return (
                <div key={event.id} className="flex gap-3 group">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${config.bg} border border-white/10 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    {idx < yearEvents.length - 1 && <div className="w-px flex-1 bg-white/10 min-h-[16px]" />}
                  </div>
                  {/* Content */}
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{event.title}</span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {Object.entries(event.metadata).map(([key, val]) => (
                          <span key={key} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-400">
                            {key}: <span className="text-gray-300">{val}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Show more */}
      {filteredEvents.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1 text-xs text-[#FF6700] hover:underline mx-auto"
        >
          Show all {filteredEvents.length} events <ChevronDown className="w-3 h-3" />
        </button>
      )}

      {filteredEvents.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">No events found</div>
      )}
    </div>
  )
}

export type { TimelineEvent }
