'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  User,
  DollarSign,
  Calendar,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter as FilterIcon,
  Download,
  Eye,
  Edit,
  UserPlus,
  X,
} from 'lucide-react'

interface TableLead {
  id: string
  customerName: string
  customerPhone: string
  loanType: string
  loanTypeLabel: string
  loanAmount: number
  formattedAmount: string
  currentStage: string
  currentStageLabel: string
  stageColor: string
  priority: string
  priorityLabel: string
  priorityColor: string
  bdeName: string
  bdeAvatar: string | null
  bankName: string | null
  daysInStage: number
  isStale: boolean
  isUrgent: boolean
  lastActivity: string
  lastActivityFormatted: string
  createdAt: string
  createdAtFormatted: string
}

interface TableViewProps {
  dateRange?: string
  selectedBDEs?: string[]
  onLeadClick?: (leadId: string) => void
}

export function TableView({ dateRange = 'last_30_days', selectedBDEs = [], onLeadClick }: TableViewProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Fetch table data
  const { data, isLoading, error } = useQuery({
    queryKey: ['bdm-table', dateRange, selectedBDEs, page, pageSize, sortBy, sortOrder, searchQuery, selectedStages, selectedPriorities],
    queryFn: async () => {
      const params = new URLSearchParams({
        dateRange,
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      })
      if (selectedBDEs.length > 0) params.append('bdeIds', selectedBDEs.join(','))
      if (searchQuery) params.append('search', searchQuery)
      if (selectedStages.length > 0) params.append('stages', selectedStages.join(','))
      if (selectedPriorities.length > 0) params.append('priorities', selectedPriorities.join(','))

      const res = await fetch(`/api/bdm/team-pipeline/stages/table?${params}`)
      if (!res.ok) throw new Error('Failed to fetch table data')
      return res.json()
    },
    refetchInterval: 30000,
  })

  const leads: TableLead[] = data?.data?.leads || []
  const totalCount = data?.data?.totalCount || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const stages = [
    { value: 'INITIAL_CONTACT', label: 'Initial Contact' },
    { value: 'DOCUMENT_COLLECTION', label: 'Document Collection' },
    { value: 'VERIFICATION', label: 'Verification' },
    { value: 'BANK_SUBMISSION', label: 'Bank Submission' },
    { value: 'BANK_PROCESSING', label: 'Bank Processing' },
    { value: 'APPROVAL_PENDING', label: 'Approval Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DISBURSED', label: 'Disbursed' },
  ]

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ChevronDown className="w-4 h-4 text-gray-500" />
    return sortOrder === 'asc'
      ? <ChevronUp className="w-4 h-4 text-orange-400" />
      : <ChevronDown className="w-4 h-4 text-orange-400" />
  }

  const handleExport = async () => {
    const params = new URLSearchParams({
      dateRange,
      sortBy,
      sortOrder,
      export: 'csv',
    })
    if (selectedBDEs.length > 0) params.append('bdeIds', selectedBDEs.join(','))
    if (searchQuery) params.append('search', searchQuery)
    if (selectedStages.length > 0) params.append('stages', selectedStages.join(','))
    if (selectedPriorities.length > 0) params.append('priorities', selectedPriorities.join(','))

    const res = await fetch(`/api/bdm/team-pipeline/stages/table?${params}`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Failed to load table data. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Pipeline Table View</h2>
            <p className="text-sm text-gray-400">
              {totalCount} leads {selectedStages.length > 0 && `• ${selectedStages.length} stages filtered`}
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

            {/* Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <FilterIcon className="w-4 h-4" />
              Filters
              {(selectedStages.length > 0 || selectedPriorities.length > 0) && (
                <span className="bg-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {selectedStages.length + selectedPriorities.length}
                </span>
              )}
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={isLoading || totalCount === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 space-y-3">
            {/* Stage Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Stages:</span>
                {selectedStages.length > 0 && (
                  <button
                    onClick={() => setSelectedStages([])}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {stages.map(stage => (
                  <button
                    key={stage.value}
                    onClick={() => {
                      setSelectedStages(prev =>
                        prev.includes(stage.value)
                          ? prev.filter(s => s !== stage.value)
                          : [...prev, stage.value]
                      )
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedStages.includes(stage.value)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Filter */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">Priority:</span>
                {selectedPriorities.length > 0 && (
                  <button
                    onClick={() => setSelectedPriorities([])}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(priority => (
                  <button
                    key={priority}
                    onClick={() => {
                      setSelectedPriorities(prev =>
                        prev.includes(priority)
                          ? prev.filter(p => p !== priority)
                          : [...prev, priority]
                      )
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedPriorities.includes(priority)
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <AlertCircle className="w-16 h-16 mb-4 text-gray-500" />
            <p className="text-lg font-medium">No leads found</p>
            <p className="text-sm">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('customer_name')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Customer
                    {getSortIcon('customer_name')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('loan_amount')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Loan Details
                    {getSortIcon('loan_amount')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('current_stage')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Stage
                    {getSortIcon('current_stage')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('priority')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Priority
                    {getSortIcon('priority')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('bde_name')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    BDE
                    {getSortIcon('bde_name')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('days_in_stage')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Days in Stage
                    {getSortIcon('days_in_stage')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('last_activity')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase hover:text-orange-400 transition-colors"
                  >
                    Last Activity
                    {getSortIcon('last_activity')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  className={`hover:bg-gray-700/50 transition-colors ${
                    lead.isStale ? 'bg-orange-500/10' : lead.isUrgent ? 'bg-red-500/10' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-medium text-sm">
                        {lead.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{lead.customerName}</p>
                        <p className="text-xs text-gray-500">{lead.customerPhone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="w-3 h-3 text-gray-400" />
                        <span className="font-semibold text-white">{lead.formattedAmount}</span>
                      </div>
                      <p className="text-xs text-gray-400">{lead.loanTypeLabel}</p>
                      {lead.bankName && (
                        <p className="text-xs text-gray-500">🏦 {lead.bankName}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.stageColor}20`,
                        color: lead.stageColor,
                      }}
                    >
                      {lead.currentStageLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${lead.priorityColor}20`,
                        color: lead.priorityColor,
                      }}
                    >
                      {lead.priorityLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-medium">
                        {lead.bdeName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm text-gray-300">{lead.bdeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className={`text-sm font-medium ${
                        lead.daysInStage > 7 ? 'text-orange-400' : 'text-white'
                      }`}>
                        {lead.daysInStage}d
                      </span>
                      {lead.isStale && <Clock className="w-4 h-4 text-orange-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-400">{lead.lastActivityFormatted}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onLeadClick?.(lead.id)}
                        className="p-1 text-orange-400 hover:bg-orange-500/20 rounded transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-gray-400 hover:bg-gray-700 rounded transition-colors"
                        title="Reassign"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && leads.length > 0 && (
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="border border-gray-700 rounded px-2 py-1 text-sm bg-gray-800 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-400">
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
