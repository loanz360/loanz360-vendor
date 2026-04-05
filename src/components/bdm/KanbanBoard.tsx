'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  FileText,
  ChevronDown,
  Search,
  Filter as FilterIcon,
} from 'lucide-react'

interface LeadCard {
  id: string
  customerName: string
  customerPhone: string
  loanType: string
  loanAmount: number
  formattedAmount: string
  priority: string
  priorityLabel: string
  priorityColor: string
  bdeName: string
  bdeAvatar: string | null
  bankName: string
  daysInStage: number
  isStale: boolean
  isUrgent: boolean
  notesCount: number
  documentsCount: number
}

interface StageColumn {
  status: string
  label: string
  color: string
  order: number
  leads: LeadCard[]
  count: number
  totalValue: number
  formattedTotalValue: string
  criticalCount: number
  staleCount: number
}

interface KanbanBoardProps {
  dateRange?: string
  selectedBDEs?: string[]
}

export function KanbanBoard({ dateRange = 'last_30_days', selectedBDEs = [] }: KanbanBoardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [selectedPriority, setSelectedPriority] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Fetch kanban data
  const { data, isLoading, error } = useQuery({
    queryKey: ['bdm-kanban', dateRange, selectedBDEs, searchQuery, sortBy, selectedPriority],
    queryFn: async () => {
      const params = new URLSearchParams({ dateRange, sortBy })
      if (selectedBDEs.length > 0) params.append('bdeIds', selectedBDEs.join(','))
      if (searchQuery) params.append('search', searchQuery)
      if (selectedPriority.length > 0) params.append('priority', selectedPriority.join(','))

      const res = await fetch(`/api/bdm/team-pipeline/stages/kanban?${params}`)
      if (!res.ok) throw new Error('Failed to fetch kanban data')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const columns: StageColumn[] = data?.data?.columns || []
  const totalLeads = data?.data?.totalLeads || 0
  const totalValue = data?.data?.totalValue || 0

  const getPriorityDot = (color: string) => (
    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
  )

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load kanban data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-800/50 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Pipeline Kanban</h2>
            <p className="text-sm text-gray-400">
              {totalLeads} leads • {data?.data?.formattedTotalValue || '₹0'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 w-64"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="priority">Sort by Priority</option>
              <option value="amount">Sort by Amount</option>
              <option value="days_in_stage">Sort by Days in Stage</option>
              <option value="customer_name">Sort by Customer Name</option>
            </select>

            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <FilterIcon className="w-4 h-4" />
              Filters
              {selectedPriority.length > 0 && (
                <span className="bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {selectedPriority.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-300">Priority:</span>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(priority => (
                <button
                  key={priority}
                  onClick={() => {
                    setSelectedPriority(prev =>
                      prev.includes(priority)
                        ? prev.filter(p => p !== priority)
                        : [...prev, priority]
                    )
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    selectedPriority.includes(priority)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {priority}
                </button>
              ))}
              {selectedPriority.length > 0 && (
                <button
                  onClick={() => setSelectedPriority([])}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium ml-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="inline-flex h-full gap-4 p-4 min-w-full">
          {isLoading ? (
            // Loading state
            [...Array(8)].map((_, i) => (
              <div key={i} className="w-80 flex-shrink-0">
                <div className="bg-gray-800 rounded-lg h-full animate-pulse" />
              </div>
            ))
          ) : (
            // Kanban columns
            columns.map(column => (
              <div
                key={column.status}
                className="w-80 flex-shrink-0 flex flex-col bg-gray-800/50 rounded-lg border border-gray-700"
              >
                {/* Column Header */}
                <div
                  className="p-4 border-b-4 rounded-t-lg"
                  style={{ borderBottomColor: column.color }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{column.label}</h3>
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${column.color}20`,
                        color: column.color,
                      }}
                    >
                      {column.count}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {column.formattedTotalValue}
                  </div>
                  {(column.criticalCount > 0 || column.staleCount > 0) && (
                    <div className="flex gap-2 mt-2">
                      {column.criticalCount > 0 && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                          {column.criticalCount} critical
                        </span>
                      )}
                      {column.staleCount > 0 && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                          {column.staleCount} stale
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Lead Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {column.leads.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-8">
                      No leads in this stage
                    </div>
                  ) : (
                    column.leads.map(lead => (
                      <div
                        key={lead.id}
                        className={`bg-gray-900 rounded-lg border border-gray-700 p-3 cursor-pointer hover:border-gray-600 hover:shadow-lg transition-all ${
                          lead.isStale ? 'border-l-4 border-l-orange-500' : ''
                        } ${lead.isUrgent ? 'border-l-4 border-l-red-500' : ''}`}
                      >
                        {/* Priority & Customer */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {getPriorityDot(lead.priorityColor)}
                            <span className="font-medium text-white truncate">
                              {lead.customerName}
                            </span>
                          </div>
                          {lead.isStale && (
                            <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          )}
                        </div>

                        {/* Loan Details */}
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <DollarSign className="w-3 h-3" />
                            <span className="font-medium text-white">
                              {lead.formattedAmount}
                            </span>
                            <span>• {lead.loanType.replace(/_/g, ' ')}</span>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <User className="w-3 h-3" />
                            <span className="truncate">{lead.bdeName}</span>
                          </div>

                          {lead.bankName && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 truncate">
                              🏦 {lead.bankName}
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {lead.documentsCount}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {lead.daysInStage}d
                            </div>
                          </div>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${lead.priorityColor}20`,
                              color: lead.priorityColor,
                            }}
                          >
                            {lead.priorityLabel}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
