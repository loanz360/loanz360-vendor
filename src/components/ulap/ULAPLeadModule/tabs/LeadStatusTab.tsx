/**
 * Lead Status Tab Component
 * World-class fintech UI for tracking lead status with filters and pagination
 */

'use client'

import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type {
  ULAPModuleContext,
  ULAPModuleConfig,
  ULAPUserContext,
  ULAPLeadStatusItem,
  ULAPLeadFilters,
} from '../types'

// =====================================================
// TYPES
// =====================================================

interface LeadStatusTabProps {
  context: ULAPModuleContext
  config: ULAPModuleConfig
  userContext: ULAPUserContext | null
  leads: ULAPLeadStatusItem[]
  leadsTotal: number
  isLoadingLeads: boolean
  leadsError: string | null
  fetchLeads: (page?: number, filters?: ULAPLeadFilters) => Promise<void>
  currentPage: number
  filters: ULAPLeadFilters
}

// =====================================================
// ICONS
// =====================================================

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

const FunnelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
  </svg>
)

const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
)

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
)

const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
)

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
)

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const LoadingSpinner = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
  </svg>
)

// =====================================================
// STATUS CONFIG
// =====================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  NEW: { label: 'New', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  NEW_UNASSIGNED: { label: 'Unassigned', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
  ASSIGNED: { label: 'Assigned', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  CONTACTED: { label: 'Contacted', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  DOC_COLLECTION: { label: 'Docs Collection', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  DOC_VERIFIED: { label: 'Docs Verified', color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
  BANK_LOGIN: { label: 'Bank Login', color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  BANK_PROCESSING: { label: 'Processing', color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  SANCTIONED: { label: 'Sanctioned', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  DISBURSED: { label: 'Disbursed', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  COMPLETED: { label: 'Completed', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  REJECTED: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/20' },
  DROPPED: { label: 'Dropped', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
}

const LOAN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'HOME_LOAN', label: 'Home Loan' },
  { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
  { value: 'BUSINESS_LOAN', label: 'Business Loan' },
  { value: 'VEHICLE_LOAN', label: 'Vehicle Loan' },
  { value: 'EDUCATION_LOAN', label: 'Education Loan' },
  { value: 'GOLD_LOAN', label: 'Gold Loan' },
  { value: 'LAP', label: 'Loan Against Property' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'NEW', label: 'New' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'DOC_COLLECTION', label: 'Docs Collection' },
  { value: 'BANK_PROCESSING', label: 'Processing' },
  { value: 'DISBURSED', label: 'Disbursed' },
  { value: 'REJECTED', label: 'Rejected' },
]

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getStatusConfig(status: string) {
  const normalized = status?.toUpperCase().replace(/\s+/g, '_')
  return STATUS_CONFIG[normalized] || { label: status, color: 'text-gray-400', bgColor: 'bg-gray-500/20' }
}

// =====================================================
// LEAD CARD COMPONENT
// =====================================================

interface LeadCardProps {
  lead: ULAPLeadStatusItem
  index: number
  onView: (lead: ULAPLeadStatusItem) => void
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, index, onView }) => {
  const statusConfig = getStatusConfig(lead.lead_status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'p-5 rounded-2xl',
        'bg-white/[0.03] border border-white/[0.08]',
        'hover:border-white/[0.15] hover:bg-white/[0.04]',
        'transition-all duration-200 cursor-pointer'
      )}
      onClick={() => onView(lead)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Lead Number & Status */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-orange-400 font-mono text-sm">
              {lead.lead_number}
            </span>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </span>
          </div>

          {/* Customer Name */}
          <h4 className="text-white font-semibold text-lg truncate">
            {lead.customer_name}
          </h4>

          {/* Mobile */}
          <div className="flex items-center gap-2 mt-1 text-white/50 text-sm">
            <PhoneIcon className="w-4 h-4" />
            <span>{lead.customer_mobile}</span>
          </div>
        </div>

        {/* View Button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-colors"
        >
          <EyeIcon className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Details Row */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.05]">
        <div className="flex items-center gap-4">
          {/* Loan Type */}
          <div className="flex items-center gap-1.5">
            <DocumentIcon className="w-4 h-4 text-white/40" />
            <span className="text-white/60 text-sm">{lead.loan_type}</span>
          </div>

          {/* Amount */}
          {lead.loan_amount && (
            <div className="text-orange-400 font-medium text-sm">
              {formatCurrency(lead.loan_amount)}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-white/40 text-xs">
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>{formatDate(lead.created_at)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      {lead.progress_percentage !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/40 text-xs">Progress</span>
            <span className="text-white/60 text-xs">{lead.progress_percentage}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${lead.progress_percentage}%` }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export const LeadStatusTab: React.FC<LeadStatusTabProps> = ({
  context: _context,
  config,
  userContext: _userContext,
  leads,
  leadsTotal,
  isLoadingLeads,
  leadsError,
  fetchLeads,
  currentPage,
  filters: initialFilters,
}) => {
  // State
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialFilters.search || '')
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || '')
  const [loanTypeFilter, setLoanTypeFilter] = useState(initialFilters.loan_type || '')
  const [selectedLead, setSelectedLead] = useState<ULAPLeadStatusItem | null>(null)

  // Calculate pagination
  const totalPages = Math.ceil(leadsTotal / 20)

  // Handle search
  const handleSearch = useCallback(() => {
    fetchLeads(1, {
      search: searchQuery,
      status: statusFilter,
      loan_type: loanTypeFilter,
    })
  }, [searchQuery, statusFilter, loanTypeFilter, fetchLeads])

  // Handle filter change
  const handleFilterChange = useCallback((type: 'status' | 'loan_type', value: string) => {
    if (type === 'status') {
      setStatusFilter(value)
    } else {
      setLoanTypeFilter(value)
    }

    fetchLeads(1, {
      search: searchQuery,
      status: type === 'status' ? value : statusFilter,
      loan_type: type === 'loan_type' ? value : loanTypeFilter,
    })
  }, [searchQuery, statusFilter, loanTypeFilter, fetchLeads])

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    fetchLeads(page, {
      search: searchQuery,
      status: statusFilter,
      loan_type: loanTypeFilter,
    })
  }, [searchQuery, statusFilter, loanTypeFilter, fetchLeads])

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('')
    setLoanTypeFilter('')
    fetchLeads(1, {})
  }, [fetchLeads])

  // Check if filters are active
  const hasActiveFilters = searchQuery || statusFilter || loanTypeFilter

  return (
    <div className="space-y-6">
      {/* Search & Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        {/* Search Input */}
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, mobile, or lead number..."
            className={cn(
              'w-full pl-12 pr-4 py-3 rounded-xl',
              'bg-white/[0.05] border border-white/[0.1]',
              'text-white placeholder-white/30',
              'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
              'transition-all duration-200'
            )}
          />
        </div>

        {/* Filter Toggle & Refresh */}
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl',
              'border transition-all duration-200',
              showFilters || hasActiveFilters
                ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                : 'bg-white/[0.05] border-white/[0.1] text-white/60 hover:text-white'
            )}
          >
            <FunnelIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-orange-400" />
            )}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => fetchLeads(currentPage)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoadingLeads}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl',
              'bg-white/[0.05] border border-white/[0.1]',
              'text-white/60 hover:text-white transition-all duration-200',
              isLoadingLeads && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshIcon className={cn('w-5 h-5', isLoadingLeads && 'animate-spin')} />
          </motion.button>
        </div>
      </motion.div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex flex-wrap items-center gap-4">
                {/* Status Filter */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-white/50 text-xs mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-lg',
                      'bg-white/[0.05] border border-white/[0.1]',
                      'text-white text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-orange-500/50'
                    )}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-zinc-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Loan Type Filter */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-white/50 text-xs mb-2">Loan Type</label>
                  <select
                    value={loanTypeFilter}
                    onChange={(e) => handleFilterChange('loan_type', e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-lg',
                      'bg-white/[0.05] border border-white/[0.1]',
                      'text-white text-sm',
                      'focus:outline-none focus:ring-2 focus:ring-orange-500/50'
                    )}
                  >
                    {LOAN_TYPES.map((option) => (
                      <option key={option.value} value={option.value} className="bg-zinc-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <motion.button
                    type="button"
                    onClick={clearFilters}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <XMarkIcon className="w-4 h-4" />
                    <span className="text-sm">Clear</span>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-white/50 text-sm">
          {isLoadingLeads ? (
            'Loading...'
          ) : (
            <>
              Showing <span className="text-white font-medium">{leads.length}</span> of{' '}
              <span className="text-white font-medium">{leadsTotal}</span> leads
            </>
          )}
        </p>
      </div>

      {/* Error State */}
      {leadsError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <p className="text-red-400 text-sm">{leadsError}</p>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoadingLeads && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner className="w-10 h-10 text-orange-500" />
            <p className="text-white/50 text-sm">Loading leads...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingLeads && leads.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-white/[0.05] flex items-center justify-center mb-4">
            <InboxIcon className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {hasActiveFilters ? 'No matching leads found' : config.labels.emptyStateMessage || 'No leads yet'}
          </h3>
          <p className="text-white/50 text-sm max-w-md mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your filters or search query'
              : 'Start by submitting your first lead in the Submit tab'}
          </p>
          {hasActiveFilters && (
            <motion.button
              type="button"
              onClick={clearFilters}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 px-6 py-2.5 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium"
            >
              Clear Filters
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Leads Grid */}
      {!isLoadingLeads && leads.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {leads.map((lead, index) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              index={index}
              onView={setSelectedLead}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 pt-6"
        >
          <motion.button
            type="button"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoadingLeads}
            whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
            whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
            className={cn(
              'p-2 rounded-lg transition-all',
              currentPage === 1
                ? 'opacity-50 cursor-not-allowed text-white/30'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-white'
            )}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </motion.button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <motion.button
                  key={pageNum}
                  type="button"
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoadingLeads}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'w-10 h-10 rounded-lg text-sm font-medium transition-all',
                    currentPage === pageNum
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/[0.05] text-white/60 hover:text-white hover:bg-white/[0.1]'
                  )}
                >
                  {pageNum}
                </motion.button>
              )
            })}
          </div>

          <motion.button
            type="button"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoadingLeads}
            whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
            whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
            className={cn(
              'p-2 rounded-lg transition-all',
              currentPage === totalPages
                ? 'opacity-50 cursor-not-allowed text-white/30'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-white'
            )}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </motion.button>
        </motion.div>
      )}

      {/* Lead Detail Modal */}
      <AnimatePresence>
        {selectedLead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedLead(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/[0.1] p-6 shadow-xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-orange-400 font-mono text-sm">{selectedLead.lead_number}</p>
                  <h3 className="text-xl font-bold text-white mt-1">{selectedLead.customer_name}</h3>
                </div>
                <motion.button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-lg hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Mobile</p>
                    <p className="text-white">{selectedLead.customer_mobile}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Status</p>
                    <span
                      className={cn(
                        'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getStatusConfig(selectedLead.lead_status).bgColor,
                        getStatusConfig(selectedLead.lead_status).color
                      )}
                    >
                      {getStatusConfig(selectedLead.lead_status).label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Loan Type</p>
                    <p className="text-white">{selectedLead.loan_type}</p>
                  </div>
                  {selectedLead.loan_amount && (
                    <div>
                      <p className="text-white/50 text-xs mb-1">Amount</p>
                      <p className="text-orange-400 font-medium">
                        {formatCurrency(selectedLead.loan_amount)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/50 text-xs mb-1">Created</p>
                    <p className="text-white text-sm">
                      {formatDate(selectedLead.created_at)} at {formatTime(selectedLead.created_at)}
                    </p>
                  </div>
                  {selectedLead.assigned_bde_name && (
                    <div>
                      <p className="text-white/50 text-xs mb-1">Assigned To</p>
                      <p className="text-white">{selectedLead.assigned_bde_name}</p>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {selectedLead.progress_percentage !== undefined && (
                  <div className="pt-4 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/50 text-sm">Progress</span>
                      <span className="text-white font-medium">{selectedLead.progress_percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedLead.progress_percentage}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-white/[0.05]">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-white font-medium transition-colors"
                >
                  View Full Details
                </motion.button>
                <motion.a
                  href={`tel:${selectedLead.customer_mobile}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-medium"
                >
                  <PhoneIcon className="w-5 h-5" />
                  <span>Call</span>
                </motion.a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LeadStatusTab
