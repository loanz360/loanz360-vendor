'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { usePartnerTicketRealtime, RealtimeConnectionIndicator } from '@/hooks/useSupportTicketRealtime'

// ============================================================
// TYPES
// ============================================================

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  partner_support_status: string
  created_at: string
  updated_at: string
  sla_deadline: string
  sla_breached: boolean
  message_count: number
  unread_count: number
  attachments_count: number
}

interface TicketCounts {
  open: number
  in_progress: number
  pending_partner: number
  resolved: number
  closed: number
  total: number
}

interface TicketListPageProps {
  partnerSubrole: 'ba' | 'bp' | 'cp'
}

// ============================================================
// CONSTANTS
// ============================================================

const categoryLabels: Record<string, string> = {
  payout_commission: 'Payout & Commission',
  sales_support: 'Sales Support',
  technical: 'Technical Issue',
  account_management: 'Account Management',
  training_resources: 'Training & Resources',
  compliance_legal: 'Compliance & Legal',
  customer_issues: 'Customer Issues',
  partnership_management: 'Partnership Management',
  general: 'General Inquiry'
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/50',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/50'
}

const statusColors: Record<string, string> = {
  new: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  in_progress: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
  pending_partner: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
  pending_internal: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/50',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  on_hold: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
  escalated: 'bg-red-500/20 text-red-400 border-red-500/50',
  reopened: 'bg-pink-500/20 text-pink-400 border-pink-500/50'
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50]

type SortField = 'created_at' | 'priority' | 'status'
type SortDirection = 'asc' | 'desc'

const priorityOrder: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3
}

const statusOrder: Record<string, number> = {
  new: 0, assigned: 1, in_progress: 2, pending_partner: 3,
  pending_internal: 4, on_hold: 5, escalated: 6, reopened: 7,
  resolved: 8, closed: 9
}

function getSlaCountdown(slaDeadline: string, slaBreached: boolean): { text: string; color: string } {
  if (slaBreached) return { text: 'SLA Breached', color: 'text-red-400' }

  const now = new Date()
  const deadline = new Date(slaDeadline)
  const diffMs = deadline.getTime() - now.getTime()

  if (diffMs <= 0) return { text: 'SLA Breached', color: 'text-red-400' }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours < 1) return { text: `${diffMinutes}m remaining`, color: 'text-red-400' }
  if (diffHours < 4) return { text: `${diffHours}h ${diffMinutes}m remaining`, color: 'text-orange-400' }
  if (diffHours < 24) return { text: `${diffHours}h remaining`, color: 'text-yellow-400' }

  const diffDays = Math.floor(diffHours / 24)
  return { text: `${diffDays}d ${diffHours % 24}h remaining`, color: 'text-green-400' }
}

// ============================================================
// COMPONENT
// ============================================================

export default function TicketListPage({ partnerSubrole }: TicketListPageProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [counts, setCounts] = useState<TicketCounts>({
    open: 0, in_progress: 0, pending_partner: 0,
    resolved: 0, closed: 0, total: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState<string>('')
  const [debouncedSearch, setDebouncedSearch] = useState<string>('')

  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  const mountedRef = useRef(true)

  const { isConnected } = usePartnerTicketRealtime(undefined, {
    onInsert: () => fetchTickets(),
    onUpdate: () => fetchTickets(),
    onDelete: () => fetchTickets()
  })

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { fetchTickets() }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch])
  useEffect(() => { setCurrentPage(1) }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch, sortField, sortDirection, itemsPerPage])

  // Ctrl+N shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        router.push(`/partners/${partnerSubrole}/support-tickets/create`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [partnerSubrole])

  useEffect(() => { return () => { mountedRef.current = false } }, [])

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)

      const response = await fetch(`/api/partner-support/tickets?${params.toString()}`)
      const data = await response.json()
      if (!mountedRef.current) return

      if (response.ok) {
        setTickets(data.tickets || [])
        setCounts(data.counts || { open: 0, in_progress: 0, pending_partner: 0, resolved: 0, closed: 0, total: 0 })
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch tickets')
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError('An error occurred while fetching tickets')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch])

  const sortedTickets = [...tickets].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
      case 'priority': cmp = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99); break
      case 'status': cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99); break
    }
    return sortDirection === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.max(1, Math.ceil(sortedTickets.length / itemsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * itemsPerPage
  const paginatedTickets = sortedTickets.slice(startIndex, startIndex + itemsPerPage)

  const formatStatus = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection(field === 'created_at' ? 'desc' : 'asc') }
  }

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
    else {
      pages.push(1)
      if (safePage > 3) pages.push('...')
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold font-poppins text-white">Support Tickets</h1>
              <RealtimeConnectionIndicator isConnected={isConnected} />
            </div>
            <p className="text-gray-400 mt-1">Manage and track your support requests</p>
          </div>
          <button
            onClick={() => router.push(`/partners/${partnerSubrole}/support-tickets/create`)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
            title="Ctrl+N"
          >
            + Create New Ticket
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Open', value: counts.open, borderColor: 'border-l-purple-500' },
            { label: 'In Progress', value: counts.in_progress, borderColor: 'border-l-cyan-500' },
            { label: 'Pending', value: counts.pending_partner, borderColor: 'border-l-amber-500' },
            { label: 'Resolved', value: counts.resolved, borderColor: 'border-l-green-500' },
            { label: 'Closed', value: counts.closed, borderColor: 'border-l-gray-500' },
            { label: 'Total', value: counts.total, borderColor: 'border-l-orange-500' },
          ].map(card => (
            <div key={card.label} className={`bg-white/5 border border-white/10 rounded-lg p-4 border-l-4 ${card.borderColor}`}>
              <div className="text-sm text-gray-400">{card.label}</div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ticket # or subject..."
                className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_partner">Pending Partner</option>
                <option value="pending_internal">Pending Internal</option>
                <option value="on_hold">On Hold</option>
                <option value="escalated">Escalated</option>
                <option value="reopened">Reopened</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                <option value="all">All Categories</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800">
            <span className="text-sm text-gray-400">Sort by:</span>
            {([
              { field: 'created_at' as SortField, label: 'Date' },
              { field: 'priority' as SortField, label: 'Priority' },
              { field: 'status' as SortField, label: 'Status' },
            ]).map(({ field, label }) => (
              <button key={field} onClick={() => handleSort(field)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortField === field
                    ? 'bg-orange-600/20 text-orange-400 border border-orange-500/50'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
                }`}>
                {label}
                {sortField === field && (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {sortDirection === 'asc'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    }
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg p-4 mb-6">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            <p className="text-gray-400 mt-4">Loading tickets...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && tickets.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-xl font-semibold mb-2 font-poppins text-white">No Tickets Found</h3>
            <p className="text-gray-400 mb-6">
              {searchInput || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'Create your first support ticket to get started'}
            </p>
          </div>
        )}

        {/* Tickets List */}
        {!loading && tickets.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedTickets.length)} of {sortedTickets.length} ticket{sortedTickets.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Per page:</label>
                <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                  {ITEMS_PER_PAGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {paginatedTickets.map((ticket) => {
                const sla = getSlaCountdown(ticket.sla_deadline, ticket.sla_breached)
                return (
                  <div key={ticket.id} onClick={() => router.push(`/partners/${partnerSubrole}/support-tickets/${ticket.id}`)}
                    className="bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-white">{ticket.ticket_number}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${priorityColors[ticket.priority] || ''}`}>
                            {ticket.priority.toUpperCase()}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[ticket.status] || ''}`}>
                            {formatStatus(ticket.status)}
                          </span>
                          {ticket.sla_breached && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/50">SLA BREACHED</span>
                          )}
                          {ticket.unread_count > 0 && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-600 text-white">{ticket.unread_count} New</span>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold mb-2 font-poppins text-white truncate">{ticket.subject}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                          <span>{categoryLabels[ticket.category] || ticket.category}</span>
                          <span>{ticket.message_count || 0} messages</span>
                          <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}</span>
                          {ticket.sla_deadline && !['resolved', 'closed'].includes(ticket.status) && (
                            <span className={sla.color}>{sla.text}</span>
                          )}
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-gray-400 ml-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  Previous
                </button>
                {getPageNumbers().map((p, idx) =>
                  p === '...' ? <span key={`e-${idx}`} className="px-2 py-2 text-gray-500 text-sm">...</span> : (
                    <button key={p} onClick={() => setCurrentPage(p)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${safePage === p ? 'bg-orange-600 text-white border border-orange-500' : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-white'}`}>
                      {p}
                    </button>
                  )
                )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 border border-gray-700 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
