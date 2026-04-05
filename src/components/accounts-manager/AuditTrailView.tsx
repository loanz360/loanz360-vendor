'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react'
import {
  History, Search, Filter, Download, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, AlertTriangle, ArrowRightLeft,
  User, Calendar, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react'

interface AuditEntry {
  id: string
  timestamp: string
  user_name: string
  user_id: string
  user_role: string
  action_type: string
  entity_type: 'CP' | 'BA' | 'BP'
  entity_id: string
  app_id: string
  previous_value: string
  new_value: string
  notes: string
  ip_address: string | null
}

interface AuditData {
  entries: AuditEntry[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

interface Props {
  className?: string
}

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  verification: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: <CheckCircle2 className="w-4 h-4" /> },
  rejection: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: <XCircle className="w-4 h-4" /> },
  escalation: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', icon: <AlertTriangle className="w-4 h-4" /> },
  status_change: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: <ArrowRightLeft className="w-4 h-4" /> },
}

const ACTION_LABELS: Record<string, string> = {
  verification: 'Verification',
  rejection: 'Rejection',
  escalation: 'Escalation',
  status_change: 'Status Change',
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function formatDateHeader(ts: string): string {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function AuditTrailView({ className = '' }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const limit = 50
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (p: number, searchVal?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', String(limit))
      if (actionFilter) params.set('action_type', actionFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const q = searchVal !== undefined ? searchVal : search
      if (q) params.set('search', q)

      const res = await fetch(`/api/employees/accounts-manager/audit-trail?${params}`)
      const json = await res.json()

      if (!json.success) {
        setError(json.error || 'Failed to load audit trail')
        return
      }

      const data: AuditData = json.data
      setEntries(data.entries)
      setTotal(data.total)
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch {
      setError('Failed to load audit trail')
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [actionFilter, dateFrom, dateTo, search])

  // Initial load
  React.useEffect(() => {
    fetchData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, dateFrom, dateTo])

  const handleSearch = useCallback((val: string) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchData(1, val)
    }, 400)
  }, [fetchData])

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: { date: string; entries: AuditEntry[] }[] = []
    let currentDate = ''

    for (const entry of entries) {
      const dateStr = new Date(entry.timestamp).toDateString()
      if (dateStr !== currentDate) {
        currentDate = dateStr
        groups.push({ date: entry.timestamp, entries: [entry] })
      } else {
        groups[groups.length - 1].entries.push(entry)
      }
    }

    return groups
  }, [entries])

  // Export to CSV
  const exportCSV = useCallback(() => {
    const headers = ['Timestamp', 'User', 'Role', 'Action Type', 'Entity Type', 'App ID', 'Previous Status', 'New Status', 'Notes']
    const rows = entries.map(e => [
      new Date(e.timestamp).toISOString(),
      e.user_name,
      e.user_role,
      e.action_type,
      e.entity_type,
      e.app_id,
      e.previous_value,
      e.new_value,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [entries])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10">
            <History className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-poppins">Audit Trail</h1>
            <p className="text-sm text-gray-400">{total} total entries</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:border-orange-500/40 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={exportCSV}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search by app ID, notes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white placeholder-gray-500 focus:border-orange-500/40 focus:outline-none transition-colors"
        />
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="frosted-card p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Action Type</label>
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white focus:border-orange-500/40 focus:outline-none"
              >
                <option value="">All Actions</option>
                <option value="verification">Verification</option>
                <option value="rejection">Rejection</option>
                <option value="escalation">Escalation</option>
                <option value="status_change">Status Change</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white focus:border-orange-500/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white focus:border-orange-500/40 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => { setActionFilter(''); setDateFrom(''); setDateTo(''); setSearch('') }}
              className="text-xs text-gray-400 hover:text-orange-400 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}

      {/* Loading / Error / Empty */}
      {initialLoad && loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {error && (
        <div className="frosted-card p-6 rounded-lg text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => fetchData(page)} className="mt-3 text-sm text-orange-400 hover:underline">
            Retry
          </button>
        </div>
      )}

      {!initialLoad && !error && entries.length === 0 && (
        <div className="frosted-card p-12 rounded-lg text-center">
          <History className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No audit entries found</p>
          <p className="text-gray-500 text-xs mt-1">Try adjusting your filters or search query</p>
        </div>
      )}

      {/* Timeline */}
      {!initialLoad && !error && entries.length > 0 && (
        <div className="space-y-6 relative">
          {loading && !initialLoad && (
            <div className="absolute inset-0 bg-black/30 rounded-lg z-10 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          )}

          {groupedEntries.map((group) => (
            <div key={group.date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {formatDateHeader(group.date)}
                </span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Entries */}
              <div className="space-y-2 ml-2 border-l-2 border-gray-800 pl-4">
                {group.entries.map((entry) => {
                  const actionStyle = ACTION_COLORS[entry.action_type] || ACTION_COLORS.status_change
                  return (
                    <div
                      key={entry.id}
                      className={`frosted-card p-4 rounded-lg border ${actionStyle.border} hover:border-opacity-60 transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        {/* User avatar */}
                        <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-gray-300">{getInitials(entry.user_name)}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Header row */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{entry.user_name}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${actionStyle.bg} ${actionStyle.text}`}>
                                {actionStyle.icon}
                                {ACTION_LABELS[entry.action_type] || entry.action_type}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-400 font-mono">
                                {entry.entity_type}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">{formatTimestamp(entry.timestamp)}</span>
                          </div>

                          {/* Action description */}
                          <p className="text-sm text-gray-300 mt-1">
                            Changed status from{' '}
                            <span className="text-gray-400 font-medium">{formatStatus(entry.previous_value || 'None')}</span>
                            {' '}to{' '}
                            <span className={`font-medium ${actionStyle.text}`}>{formatStatus(entry.new_value)}</span>
                          </p>

                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {entry.user_role.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              App: {entry.app_id}
                            </span>
                          </div>

                          {/* Notes */}
                          {entry.notes && (
                            <div className="mt-2 px-3 py-2 rounded bg-gray-900/50 border border-gray-800">
                              <p className="text-xs text-gray-400 italic">&ldquo;{entry.notes}&rdquo;</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData(page - 1)}
                disabled={page <= 1 || loading}
                className="p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-orange-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 px-2">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => fetchData(page + 1)}
                disabled={!hasMore || loading}
                className="p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-orange-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
