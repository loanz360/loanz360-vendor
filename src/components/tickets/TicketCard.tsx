'use client'

import { formatDistanceToNow } from 'date-fns'
import { Clock, AlertCircle, MessageSquare, Paperclip, User, Shield, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export interface TicketCardData {
  id: string
  ticket_number: string
  subject: string
  status: string
  priority: string
  category?: string
  created_at: string
  updated_at?: string
  requester_name?: string
  assigned_to_name?: string
  message_count?: number
  attachment_count?: number
  is_confidential?: boolean
  is_escalated?: boolean
  sla_breached?: boolean
  ticket_source?: string
}

interface TicketCardProps {
  ticket: TicketCardData
  href: string
  selected?: boolean
  onSelect?: (id: string) => void
  showCheckbox?: boolean
  compact?: boolean
}

export function TicketCard({
  ticket,
  href,
  selected = false,
  onSelect,
  showCheckbox = false,
  compact = false
}: TicketCardProps) {
  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  }

  const statusColors: Record<string, string> = {
    open: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    new: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    pending_customer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    reopened: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  }

  const sourceColors: Record<string, string> = {
    EMPLOYEE: 'bg-indigo-500/20 text-indigo-400',
    CUSTOMER: 'bg-emerald-500/20 text-emerald-400',
    PARTNER: 'bg-violet-500/20 text-violet-400'
  }

  if (compact) {
    return (
      <Link
        href={href}
        className={`block p-3 rounded-lg border transition-all hover:border-white/20 ${
          selected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect?.(ticket.id)
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-400">{ticket.ticket_number}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[ticket.priority] || priorityColors.medium}`}>
                {ticket.priority?.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[ticket.status] || statusColors.open}`}>
                {ticket.status?.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-white text-sm font-medium truncate">{ticket.subject}</p>
          </div>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={`block p-4 rounded-lg border transition-all hover:border-white/20 ${
        selected ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start gap-4">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect?.(ticket.id)
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-sm font-mono text-gray-400">{ticket.ticket_number}</span>

            {ticket.ticket_source && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${sourceColors[ticket.ticket_source] || ''}`}>
                {ticket.ticket_source}
              </span>
            )}

            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[ticket.priority] || priorityColors.medium}`}>
              {ticket.priority?.toUpperCase()}
            </span>

            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColors[ticket.status] || statusColors.open}`}>
              {ticket.status?.replace(/_/g, ' ').toUpperCase()}
            </span>

            {ticket.sla_breached && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                SLA
              </span>
            )}

            {ticket.is_escalated && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                ESCALATED
              </span>
            )}

            {ticket.is_confidential && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3" />
              </span>
            )}
          </div>

          {/* Subject */}
          <h3 className="text-white font-medium mb-2 line-clamp-2">{ticket.subject}</h3>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {ticket.requester_name && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {ticket.requester_name}
              </span>
            )}

            {ticket.category && (
              <span className="capitalize">{ticket.category.replace(/_/g, ' ')}</span>
            )}

            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Right side indicators */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-gray-400">
            {(ticket.message_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-sm">
                <MessageSquare className="w-4 h-4" />
                {ticket.message_count}
              </span>
            )}

            {(ticket.attachment_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-sm">
                <Paperclip className="w-4 h-4" />
                {ticket.attachment_count}
              </span>
            )}
          </div>

          {ticket.assigned_to_name && (
            <span className="text-xs text-gray-500">
              Assigned: {ticket.assigned_to_name}
            </span>
          )}

          <ChevronRight className="w-5 h-5 text-gray-500" />
        </div>
      </div>
    </Link>
  )
}

// Skeleton loader for ticket cards
export function TicketCardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="p-3 rounded-lg border border-white/10 bg-white/5 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 w-20 bg-white/10 rounded" />
              <div className="h-4 w-16 bg-white/10 rounded" />
            </div>
            <div className="h-4 w-48 bg-white/10 rounded" />
          </div>
          <div className="h-4 w-16 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-lg border border-white/10 bg-white/5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-24 bg-white/10 rounded" />
            <div className="h-5 w-16 bg-white/10 rounded" />
            <div className="h-5 w-20 bg-white/10 rounded" />
          </div>
          <div className="h-5 w-3/4 bg-white/10 rounded mb-2" />
          <div className="flex items-center gap-4">
            <div className="h-4 w-24 bg-white/10 rounded" />
            <div className="h-4 w-20 bg-white/10 rounded" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="h-5 w-12 bg-white/10 rounded" />
          <div className="h-4 w-20 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  )
}
