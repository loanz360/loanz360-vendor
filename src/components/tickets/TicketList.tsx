'use client'

import { useState, useMemo } from 'react'
import { TicketCard, TicketCardData, TicketCardSkeleton } from './TicketCard'
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'

interface TicketListProps {
  tickets: TicketCardData[]
  loading?: boolean
  error?: string | null
  getTicketHref: (ticket: TicketCardData) => string
  // Selection
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  // Filtering
  showSearch?: boolean
  showFilters?: boolean
  // Sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  // Pagination
  page?: number
  pageSize?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  // Display
  compact?: boolean
  emptyMessage?: string
  className?: string
}

interface FilterState {
  status: string[]
  priority: string[]
  source: string[]
}

export function TicketList({
  tickets,
  loading = false,
  error = null,
  getTicketHref,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  showSearch = true,
  showFilters = true,
  sortBy = 'created_at',
  sortOrder = 'desc',
  onSortChange,
  page = 1,
  pageSize = 20,
  totalCount,
  onPageChange,
  compact = false,
  emptyMessage = 'No tickets found',
  className = ''
}: TicketListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    status: [],
    priority: [],
    source: []
  })

  // Client-side filtering (for when server-side isn't available)
  const filteredTickets = useMemo(() => {
    let result = tickets

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.ticket_number.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
        t.requester_name?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (filters.status.length > 0) {
      result = result.filter(t => filters.status.includes(t.status))
    }

    // Priority filter
    if (filters.priority.length > 0) {
      result = result.filter(t => filters.priority.includes(t.priority))
    }

    // Source filter
    if (filters.source.length > 0) {
      result = result.filter(t => t.ticket_source && filters.source.includes(t.ticket_source))
    }

    return result
  }, [tickets, searchQuery, filters])

  // Handle selection
  const handleSelectAll = () => {
    if (selectedIds.length === filteredTickets.length) {
      onSelectionChange?.([])
    } else {
      onSelectionChange?.(filteredTickets.map(t => t.id))
    }
  }

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange?.(selectedIds.filter(i => i !== id))
    } else {
      onSelectionChange?.([...selectedIds, id])
    }
  }

  // Toggle filter
  const toggleFilter = (type: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }))
  }

  const clearFilters = () => {
    setFilters({ status: [], priority: [], source: [] })
    setSearchQuery('')
  }

  const hasActiveFilters = filters.status.length > 0 || filters.priority.length > 0 || filters.source.length > 0 || searchQuery.trim()

  // Pagination
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : Math.ceil(filteredTickets.length / pageSize)
  const displayTickets = totalCount ? filteredTickets : filteredTickets.slice((page - 1) * pageSize, page * pageSize)

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        {showSearch && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-white/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Filter toggle */}
        {showFilters && (
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              hasActiveFilters
                ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 rounded-full">
                {filters.status.length + filters.priority.length + filters.source.length}
              </span>
            )}
          </button>
        )}

        {/* Sort */}
        {onSortChange && (
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value, sortOrder)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none"
            >
              <option value="created_at">Created</option>
              <option value="updated_at">Updated</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Selection info */}
        {selectable && selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <span>{selectedIds.length} selected</span>
            <button
              onClick={() => onSelectionChange?.([])}
              className="hover:underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Filter panel */}
      {showFilterPanel && showFilters && (
        <div className="mb-4 p-4 bg-white/5 border border-white/10 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">Filters</h4>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-orange-400 hover:underline">
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status filters */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Status</label>
              <div className="flex flex-wrap gap-2">
                {['open', 'in_progress', 'pending', 'resolved', 'closed'].map(status => (
                  <button
                    key={status}
                    onClick={() => toggleFilter('status', status)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      filters.status.includes(status)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority filters */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Priority</label>
              <div className="flex flex-wrap gap-2">
                {['urgent', 'high', 'medium', 'low'].map(priority => (
                  <button
                    key={priority}
                    onClick={() => toggleFilter('priority', priority)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      filters.priority.includes(priority)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* Source filters */}
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Source</label>
              <div className="flex flex-wrap gap-2">
                {['EMPLOYEE', 'CUSTOMER', 'PARTNER'].map(source => (
                  <button
                    key={source}
                    onClick={() => toggleFilter('source', source)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      filters.source.includes(source)
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Select all */}
      {selectable && filteredTickets.length > 0 && (
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-3"
        >
          {selectedIds.length === filteredTickets.length ? (
            <CheckSquare className="w-4 h-4 text-orange-400" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select all ({filteredTickets.length})
        </button>
      )}

      {/* Ticket list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <TicketCardSkeleton key={i} compact={compact} />
          ))}
        </div>
      ) : displayTickets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              href={getTicketHref(ticket)}
              selected={selectedIds.includes(ticket.id)}
              onSelect={selectable ? handleSelectOne : undefined}
              showCheckbox={selectable}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
          <span className="text-sm text-gray-400">
            Showing {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount || filteredTickets.length)} of {totalCount || filteredTickets.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange?.(pageNum)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      pageNum === page
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
