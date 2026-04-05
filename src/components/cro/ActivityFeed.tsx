'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Phone,
  MessageCircle,
  Mail,
  StickyNote,
  ArrowRightLeft,
  FileText,
  CalendarClock,
  TrendingUp,
  Cpu,
  Sparkles,
  Filter,
  Inbox,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string
  type:
    | 'call'
    | 'whatsapp'
    | 'email'
    | 'note'
    | 'status_change'
    | 'document'
    | 'follow_up'
    | 'deal_update'
    | 'system'
  title: string
  description?: string
  timestamp: string
  entityType?: 'contact' | 'lead' | 'deal'
  entityId?: string
  entityName?: string
  metadata?: Record<string, unknown>
  isAI?: boolean
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  isLoading?: boolean
  maxItems?: number
  showFilters?: boolean
  onActivityClick?: (activity: ActivityItem) => void
  emptyMessage?: string
}

// ── Activity type configuration ──────────────────────────────────────────────────

const ACTIVITY_TYPE_CONFIG: Record<
  ActivityItem['type'],
  {
    icon: React.ElementType
    color: string       // icon text color
    bg: string          // icon circle bg
    border: string      // icon circle border
    glowColor: string   // subtle ring glow
  }
> = {
  call: {
    icon: Phone,
    color: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    glowColor: 'rgba(59,130,246,0.15)',
  },
  whatsapp: {
    icon: MessageCircle,
    color: 'text-green-400',
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    glowColor: 'rgba(34,197,94,0.15)',
  },
  email: {
    icon: Mail,
    color: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    glowColor: 'rgba(168,85,247,0.15)',
  },
  note: {
    icon: StickyNote,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-500/30',
    glowColor: 'rgba(234,179,8,0.15)',
  },
  status_change: {
    icon: ArrowRightLeft,
    color: 'text-orange-400',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/30',
    glowColor: 'rgba(249,115,22,0.15)',
  },
  document: {
    icon: FileText,
    color: 'text-gray-400',
    bg: 'bg-gray-500/15',
    border: 'border-gray-500/30',
    glowColor: 'rgba(156,163,175,0.15)',
  },
  follow_up: {
    icon: CalendarClock,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-500/30',
    glowColor: 'rgba(6,182,212,0.15)',
  },
  deal_update: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    glowColor: 'rgba(16,185,129,0.15)',
  },
  system: {
    icon: Cpu,
    color: 'text-slate-400',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
    glowColor: 'rgba(148,163,184,0.15)',
  },
}

// ── Filter configuration ─────────────────────────────────────────────────────────

type FilterKey = 'all' | 'calls' | 'messages' | 'notes' | 'status' | 'documents'

const FILTER_CHIPS: { key: FilterKey; label: string; types: ActivityItem['type'][] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'calls', label: 'Calls', types: ['call'] },
  { key: 'messages', label: 'Messages', types: ['whatsapp', 'email'] },
  { key: 'notes', label: 'Notes', types: ['note'] },
  { key: 'status', label: 'Status Changes', types: ['status_change', 'deal_update'] },
  { key: 'documents', label: 'Documents', types: ['document'] },
]

// ── Time helpers ─────────────────────────────────────────────────────────────────

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatFullTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Earlier'

function getDateGroup(timestamp: string): DateGroup {
  const now = new Date()
  const date = new Date(timestamp)

  // Reset to start of day for comparison
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000)

  if (date >= todayStart) return 'Today'
  if (date >= yesterdayStart) return 'Yesterday'
  if (date >= weekStart) return 'This Week'
  return 'Earlier'
}

// ── Entity link helper ───────────────────────────────────────────────────────────

function getEntityHref(entityType: string, entityId: string): string {
  switch (entityType) {
    case 'lead':
      return `/employees/cro/ai-crm/leads/${entityId}`
    case 'contact':
      return `/employees/cro/ai-crm/contacts/${entityId}`
    case 'deal':
      return `/employees/cro/ai-crm/deals/${entityId}`
    default:
      return '#'
  }
}

// ── Skeleton loader ──────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="relative flex gap-4 pl-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full bg-gray-800 animate-pulse flex-shrink-0" />
        <div className="w-px flex-1 bg-white/5" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 pt-0.5">
        <div className="h-4 w-2/5 bg-gray-800 rounded animate-pulse mb-2" />
        <div className="h-3 w-3/5 bg-gray-800 rounded animate-pulse mb-1.5" />
        <div className="h-3 w-1/4 bg-gray-800 rounded animate-pulse" />
      </div>
    </div>
  )
}

// ── Single activity item ─────────────────────────────────────────────────────────

function ActivityTimelineItem({
  activity,
  isLast,
  onClick,
}: {
  activity: ActivityItem
  isLast: boolean
  onClick?: (activity: ActivityItem) => void
}) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type]
  const Icon = config.icon

  return (
    <div
      className={`
        relative flex gap-4 pl-4 group
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={() => onClick?.(activity)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(activity)
              }
            }
          : undefined
      }
    >
      {/* Timeline connector line + icon circle */}
      <div className="flex flex-col items-center flex-shrink-0">
        {/* Icon circle */}
        <div
          className={`
            relative w-9 h-9 rounded-full border flex items-center justify-center
            transition-all duration-200
            group-hover:scale-110 group-hover:shadow-lg
            ${config.bg} ${config.border}
          `}
          style={{
            boxShadow: `0 0 0 0px ${config.glowColor}`,
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px 2px ${config.glowColor}`
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0px ${config.glowColor}`
          }}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />

          {/* AI indicator badge */}
          {activity.isAI && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
            </div>
          )}
        </div>

        {/* Connecting line */}
        {!isLast && (
          <div className="w-px flex-1 min-h-[24px] bg-gradient-to-b from-white/10 to-white/5" />
        )}
      </div>

      {/* Content card */}
      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-6'} pt-0.5`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-0.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h4 className="text-sm font-medium text-gray-200 truncate group-hover:text-gray-100 transition-colors">
              {activity.title}
            </h4>
            {activity.isAI && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                AI
              </span>
            )}
          </div>

          {/* Relative timestamp with full tooltip */}
          <div className="relative flex-shrink-0 group/time">
            <span className="text-[11px] text-gray-600 tabular-nums whitespace-nowrap">
              {getRelativeTime(activity.timestamp)}
            </span>
            {/* Full timestamp tooltip */}
            <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover/time:block">
              <div className="bg-gray-900 border border-white/15 rounded-lg px-3 py-1.5 shadow-2xl shadow-black/60 whitespace-nowrap">
                <span className="text-[11px] text-gray-300">
                  {formatFullTimestamp(activity.timestamp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {activity.description && (
          <p className="text-xs text-gray-500 leading-relaxed mb-1.5 line-clamp-2">
            {activity.description}
          </p>
        )}

        {/* Entity link */}
        {activity.entityType && activity.entityId && activity.entityName && (
          <Link
            href={getEntityHref(activity.entityType, activity.entityId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FF6700] hover:text-orange-400 transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6700]/40 flex-shrink-0" />
            {activity.entityName}
            <span className="text-[10px] text-gray-600 capitalize">
              ({activity.entityType})
            </span>
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Date group header ────────────────────────────────────────────────────────────

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 pl-4">
      <div className="flex items-center justify-center w-9">
        <div className="w-2 h-2 rounded-full bg-white/10 border border-white/20" />
      </div>
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────────

export default function ActivityFeed({
  activities,
  isLoading = false,
  maxItems,
  showFilters = false,
  onActivityClick,
  emptyMessage = 'No activities to show yet. Activities will appear here as you work.',
}: ActivityFeedProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  // Apply filter
  const filteredActivities = useMemo(() => {
    const chip = FILTER_CHIPS.find((c) => c.key === activeFilter)
    if (!chip || chip.key === 'all') return activities
    return activities.filter((a) => chip.types.includes(a.type))
  }, [activities, activeFilter])

  // Apply maxItems limit
  const displayActivities = useMemo(() => {
    const sorted = [...filteredActivities].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    return maxItems ? sorted.slice(0, maxItems) : sorted
  }, [filteredActivities, maxItems])

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups: { label: DateGroup; items: ActivityItem[] }[] = []
    const groupOrder: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Earlier']
    const groupMap = new Map<DateGroup, ActivityItem[]>()

    for (const activity of displayActivities) {
      const group = getDateGroup(activity.timestamp)
      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }
      groupMap.get(group)!.push(activity)
    }

    for (const label of groupOrder) {
      const items = groupMap.get(label)
      if (items && items.length > 0) {
        groups.push({ label, items })
      }
    }

    return groups
  }, [displayActivities])

  const handleFilterClick = useCallback((key: FilterKey) => {
    setActiveFilter(key)
  }, [])

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-0">
        {showFilters && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-20 rounded-full bg-gray-800 animate-pulse flex-shrink-0"
              />
            ))}
          </div>
        )}
        {Array.from({ length: 5 }).map((_, i) => (
          <ActivitySkeleton key={i} />
        ))}
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (displayActivities.length === 0) {
    return (
      <div>
        {showFilters && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
            <Filter className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mr-1" />
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => handleFilterClick(chip.key)}
                className={`
                  flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-200 border whitespace-nowrap
                  ${
                    activeFilter === chip.key
                      ? 'bg-[#FF6700]/15 text-[#FF6700] border-[#FF6700]/30'
                      : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-400 hover:border-white/10'
                  }
                `}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-300 mb-1">No activities</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  // ── Main timeline ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Filter chips */}
      {showFilters && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mr-1" />
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.key
            // Count items matching this filter
            const count =
              chip.key === 'all'
                ? activities.length
                : activities.filter((a) => chip.types.includes(a.type)).length

            return (
              <button
                key={chip.key}
                onClick={() => handleFilterClick(chip.key)}
                className={`
                  flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-200 border whitespace-nowrap
                  ${
                    isActive
                      ? 'bg-[#FF6700]/15 text-[#FF6700] border-[#FF6700]/30 shadow-sm shadow-[#FF6700]/10'
                      : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:bg-white/[0.06] hover:text-gray-400 hover:border-white/10'
                  }
                `}
              >
                {chip.label}
                {count > 0 && (
                  <span
                    className={`
                      text-[10px] tabular-nums px-1.5 py-0.5 rounded-full
                      ${
                        isActive
                          ? 'bg-[#FF6700]/20 text-[#FF6700]'
                          : 'bg-white/5 text-gray-600'
                      }
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {groupedActivities.map((group, groupIdx) => (
          <div key={group.label}>
            {/* Date group header */}
            <DateGroupHeader label={group.label} />

            {/* Activities in this group */}
            {group.items.map((activity, itemIdx) => {
              // isLast = last item in the very last group
              const isLastGroup = groupIdx === groupedActivities.length - 1
              const isLastItem = itemIdx === group.items.length - 1
              const isLast = isLastGroup && isLastItem

              return (
                <ActivityTimelineItem
                  key={activity.id}
                  activity={activity}
                  isLast={isLast}
                  onClick={onActivityClick}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
