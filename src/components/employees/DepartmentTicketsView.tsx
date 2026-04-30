'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import {
  Search,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  RotateCcw,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  ArrowUpRight,
  Filter,
  BarChart3,
  CheckSquare,
  Square,
  ChevronDown,
  RefreshCw,
  Download,
  TrendingUp,
  Timer,
  Shield,
  Zap
} from 'lucide-react'

interface Ticket {
  id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string
  created_at: string
  updated_at: string
  first_response_at?: string
  resolved_at?: string
  resolution_time_hours?: number
  response_time_hours?: number
  sla_breached?: boolean
  employee: {
    full_name: string
    email: string
  }
  messages: Array<{count: number}>
  payout_app_id?: string
  payout_application_type?: string
}

interface TicketCounts {
  open: number
  inProgress: number
  resolved: number
  closed: number
  onHold: number
  reopened: number
  total: number
}

interface DepartmentTicketsViewProps {
  department: 'finance' | 'accounts' | 'payout_specialist' | 'technical_support' | 'compliance'
  departmentName: string
  detailBasePath?: string
  useRealtimeHook?: (onNewTicket?: (ticket: unknown) => void, onTicketUpdate?: (ticket: unknown) => void) => { isConnected: boolean }
}

export default function DepartmentTicketsView({
  department,
  departmentName,
  detailBasePath,
  useRealtimeHook
}: DepartmentTicketsViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [counts, setCounts] = useState<TicketCounts>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    onHold: 0,
    reopened: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showAnalytics, setShowAnalytics] = useState(false)

  // Bulk operations
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Server-side search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  // Analytics data
  const [analytics, setAnalytics] = useState<{
    avgResponseTime: number
    avgResolutionTime: number
    slaCompliance: number
    ticketTrend: string
  } | null>(null)

  // Stable callbacks for realtime hook (BUG-09 fix)
  const handleNewTicket = useCallback((newTicket: unknown) => {
    setTickets(prev => [newTicket, ...prev])
    setCounts(prev => ({
      ...prev,
      open: prev.open + 1,
      total: prev.total + 1
    }))
  }, [])

  const handleTicketUpdate = useCallback((updatedTicket: unknown) => {
    setTickets(prev =>
      prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t)
    )
  }, [])

  // BUG-08 fix: Always call the hook unconditionally (Rules of Hooks)
  const realtimeConnection = useRealtimeHook
    ? useRealtimeHook(handleNewTicket, handleTicketUpdate)
    : { isConnected: false }

  const isConnected = realtimeConnection?.isConnected || false

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
    setTickets([])
    fetchTickets(1)
  }, [statusFilter, priorityFilter, categoryFilter, debouncedSearch])

  const fetchTickets = async (pageNum: number = page) => {
    try {
      const isInitialLoad = pageNum === 1
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const params = new URLSearchParams()
      params.append('page', pageNum.toString())
      params.append('limit', '20')
      params.append('assigned_to', department)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (priorityFilter !== 'all') params.append('priority', priorityFilter)
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (debouncedSearch) params.append('search', debouncedSearch)

      const response = await fetch(`/api/support/tickets?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        const ticketData = data.tickets || []
        if (isInitialLoad) {
          setTickets(ticketData)
        } else {
          setTickets(prev => [...prev, ...ticketData])
        }
        setCounts(data.counts || counts)
        setHasMore(data.pagination?.hasMore || false)
        setTotalCount(data.pagination?.totalCount || 0)

        // Calculate analytics from first page data
        if (isInitialLoad && ticketData.length > 0) {
          calculateAnalytics(ticketData, data.counts)
        }
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const calculateAnalytics = (ticketData: Ticket[], ticketCounts: TicketCounts) => {
    const withResponse = ticketData.filter(t => t.response_time_hours)
    const withResolution = ticketData.filter(t => t.resolution_time_hours)
    const slaBreached = ticketData.filter(t => t.sla_breached).length
    const total = ticketData.length

    setAnalytics({
      avgResponseTime: withResponse.length > 0
        ? withResponse.reduce((sum, t) => sum + (t.response_time_hours || 0), 0) / withResponse.length
        : 0,
      avgResolutionTime: withResolution.length > 0
        ? withResolution.reduce((sum, t) => sum + (t.resolution_time_hours || 0), 0) / withResolution.length
        : 0,
      slaCompliance: total > 0 ? ((total - slaBreached) / total) * 100 : 100,
      ticketTrend: ticketCounts.open > ticketCounts.resolved ? 'rising' : 'falling'
    })
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchTickets(nextPage)
    }
  }

  // Determine the correct detail URL based on the current path
  const getTicketDetailUrl = (ticketId: string) => {
    if (detailBasePath) return `${detailBasePath}/${ticketId}`
    // Extract the portal path from current pathname (e.g., /employees/accounts-executive)
    const pathParts = pathname.split('/')
    const portalBase = pathParts.slice(0, 3).join('/')
    return `${portalBase}/tickets/${ticketId}`
  }

  // Bulk selection
  const toggleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set())
    } else {
      setSelectedTickets(new Set(tickets.map(t => t.id)))
    }
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(selectedTickets)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTickets(next)
  }

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedTickets.size === 0) return
    setBulkLoading(true)
    try {
      const promises = Array.from(selectedTickets).map(ticketId =>
        fetch(`/api/support/tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bulkAction })
        })
      )
      await Promise.all(promises)
      setSelectedTickets(new Set())
      setBulkAction('')
      fetchTickets(1)
    } catch (err) {
      console.error('Bulk action failed:', err)
    } finally {
      setBulkLoading(false)
    }
  }

  // Export tickets to CSV
  const handleExportCSV = () => {
    const headers = ['Ticket #', 'Subject', 'Category', 'Priority', 'Status', 'From', 'Created', 'Updated']
    const rows = tickets.map(t => [
      t.ticket_number,
      `"${t.subject.replace(/"/g, '""')}"`,
      t.category,
      t.priority,
      t.status,
      t.employee?.full_name || 'Unknown',
      new Date(t.created_at).toLocaleDateString(),
      new Date(t.updated_at).toLocaleDateString()
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${department}-tickets-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4" />
      case 'in_progress': return <MessageSquare className="w-4 h-4" />
      case 'resolved': return <CheckCircle className="w-4 h-4" />
      case 'closed': return <XCircle className="w-4 h-4" />
      case 'on_hold': return <Pause className="w-4 h-4" />
      case 'reopened': return <RotateCcw className="w-4 h-4" />
      default: return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-yellow-400 bg-yellow-400/10'
      case 'in_progress': return 'text-blue-400 bg-blue-400/10'
      case 'resolved': return 'text-green-400 bg-green-400/10'
      case 'closed': return 'text-gray-400 bg-gray-400/10'
      case 'on_hold': return 'text-orange-400 bg-orange-400/10'
      case 'reopened': return 'text-purple-400 bg-purple-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-poppins">{departmentName} Support Tickets</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400">Tickets assigned to {departmentName}</p>
            {useRealtimeHook && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                isConnected
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}>
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors text-sm ${
              showAnalytics
                ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchTickets(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Analytics Dashboard (ENH-05) */}
      {showAnalytics && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold">Avg Response Time</span>
            </div>
            <h3 className="text-2xl font-bold text-white">
              {analytics.avgResponseTime > 0 ? `${analytics.avgResponseTime.toFixed(1)}h` : 'N/A'}
            </h3>
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm font-semibold">Avg Resolution Time</span>
            </div>
            <h3 className="text-2xl font-bold text-white">
              {analytics.avgResolutionTime > 0 ? `${analytics.avgResolutionTime.toFixed(1)}h` : 'N/A'}
            </h3>
          </div>
          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-orange-400" />
              <span className="text-orange-400 text-sm font-semibold">SLA Compliance</span>
            </div>
            <h3 className="text-2xl font-bold text-white">{analytics.slaCompliance.toFixed(0)}%</h3>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 text-sm font-semibold">Ticket Trend</span>
            </div>
            <h3 className="text-2xl font-bold text-white capitalize">{analytics.ticketTrend}</h3>
            <p className="text-gray-400 text-xs mt-1">
              {analytics.ticketTrend === 'rising' ? 'More open than resolved' : 'Resolving faster'}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}>
          <div className="text-gray-400 text-sm">Open</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{counts.open}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}>
          <div className="text-gray-400 text-sm">In Progress</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{counts.inProgress}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'on_hold' ? 'all' : 'on_hold')}>
          <div className="text-gray-400 text-sm">On Hold</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{counts.onHold}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'reopened' ? 'all' : 'reopened')}>
          <div className="text-gray-400 text-sm">Reopened</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{counts.reopened}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}>
          <div className="text-gray-400 text-sm">Resolved</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{counts.resolved}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed')}>
          <div className="text-gray-400 text-sm">Closed</div>
          <div className="text-2xl font-bold text-gray-400 mt-1">{counts.closed}</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4 cursor-pointer hover:bg-white/10 transition-colors"
          onClick={() => setStatusFilter('all')}>
          <div className="text-gray-400 text-sm">Total</div>
          <div className="text-2xl font-bold text-white mt-1">{counts.total}</div>
        </div>
      </div>

      {/* Search, Filters, and Bulk Actions */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets by subject, number, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/50 text-white pl-10 pr-4 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="on_hold">On Hold</option>
            <option value="reopened">Reopened</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="payout">Payout</option>
            <option value="commission">Commission</option>
            <option value="incentive">Incentive</option>
            <option value="salary">Salary</option>
            <option value="technical">Technical</option>
            <option value="compliance">Compliance</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Bulk Actions Bar */}
        {selectedTickets.size > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
            <span className="text-orange-400 font-medium text-sm">
              {selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''} selected
            </span>
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none text-sm"
            >
              <option value="">Select action...</option>
              <option value="in_progress">Move to In Progress</option>
              <option value="on_hold">Put On Hold</option>
              <option value="resolved">Mark Resolved</option>
              <option value="closed">Close</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction || bulkLoading}
              className="px-4 py-1.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Apply
            </button>
            <button
              onClick={() => setSelectedTickets(new Set())}
              className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {/* Select All Header */}
        {!loading && tickets.length > 0 && (
          <div className="flex items-center gap-3 px-2">
            <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white transition-colors">
              {selectedTickets.size === tickets.length ? (
                <CheckSquare className="w-5 h-5 text-orange-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
            <span className="text-gray-400 text-sm">
              {selectedTickets.size === tickets.length ? 'Deselect all' : 'Select all'}
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent mx-auto"></div>
            <p className="text-gray-400 mt-4">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-poppins">No Tickets Found</h3>
            <p className="text-gray-400">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all'
                ? 'No tickets match your filters. Try adjusting your search criteria.'
                : `No tickets assigned to ${departmentName}`}
            </p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => router.push(getTicketDetailUrl(ticket.id))}
              className={`bg-white/5 backdrop-blur-lg border rounded-lg p-5 hover:bg-white/10 cursor-pointer transition-all ${
                selectedTickets.has(ticket.id) ? 'border-orange-500/50 bg-orange-500/5' : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={(e) => toggleSelect(ticket.id, e)}
                  className="mt-1 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  {selectedTickets.has(ticket.id) ? (
                    <CheckSquare className="w-5 h-5 text-orange-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className="text-orange-400 font-mono text-sm">{ticket.ticket_number}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                    {ticket.sla_breached && (
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs border border-red-500/30 font-medium">
                        SLA BREACHED
                      </span>
                    )}
                    {ticket.payout_app_id && (
                      <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 text-xs font-mono border border-orange-500/30">
                        {ticket.payout_app_id}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-1 font-poppins">{ticket.subject}</h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{ticket.description}</p>
                  <div className="flex items-center gap-6 mt-3 text-sm flex-wrap">
                    <span className="text-gray-400">
                      Category: <span className="text-white capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
                    </span>
                    <span className="text-gray-400">
                      From: <span className="text-white">{ticket.employee?.full_name || 'Unknown'}</span>
                    </span>
                    <span className="text-gray-400">
                      <MessageSquare className="w-4 h-4 inline mr-1" />
                      {ticket.messages?.[0]?.count || 0} messages
                    </span>
                    <span className="text-gray-400">
                      Updated: {new Date(ticket.updated_at).toLocaleDateString('en-IN')}
                    </span>
                    {ticket.resolution_time_hours && (
                      <span className="text-green-400">
                        <Timer className="w-4 h-4 inline mr-1" />
                        Resolved in {ticket.resolution_time_hours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>

                <ArrowUpRight className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
              </div>
            </div>
          ))
        )}

        {/* Load More */}
        {!loading && tickets.length > 0 && hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-lg border border-white/10 hover:border-orange-500 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More
                  <span className="text-gray-400 text-sm">({tickets.length} of {totalCount})</span>
                </>
              )}
            </button>
          </div>
        )}

        {!loading && !hasMore && tickets.length > 0 && (
          <div className="text-center mt-6 text-gray-400 text-sm">
            <p>End of results - {totalCount} total tickets</p>
          </div>
        )}
      </div>
    </div>
  )
}
