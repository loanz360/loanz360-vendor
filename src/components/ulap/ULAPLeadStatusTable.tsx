'use client'

import { toast } from 'sonner'

/**
 * ULAP Lead Status Table Component
 * Unified component for displaying leads from the unified CRM
 * Used by BA Portal, BP Portal, Employee Portal
 *
 * FIXED: H2 (pagination UI), H3 (search debounce), H4 (loan_amount fallback),
 * H8 (WhatsApp country code), M15/M16 (PII masking), M21 (empty state differentiation),
 * L1 (accessibility), L6 (unused imports), L7 (invalid dates), L12 (table scope)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Filter,
  Share2,
  Play,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/cn'

// Types
interface ULAPLead {
  id: string
  lead_number: string
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  loan_type?: string
  loan_category_code?: string
  loan_subcategory_code?: string
  loan_amount?: number
  required_loan_amount?: number
  form_status: string
  lead_status: string
  application_phase: number
  form_completion_percentage: number
  short_link?: string
  short_code?: string
  source_type?: string
  created_at: string
  updated_at: string
}

interface LeadStats {
  total: number
  phase_1_submitted: number
  phase_2_in_progress: number
  phase_2_submitted: number
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ULAPLeadStatusTableProps {
  partnerType: 'BA' | 'BP' | 'EMPLOYEE'
  refreshTrigger?: number
  onLeadSelect?: (lead: ULAPLead) => void
}

// Form status options for ULAP
const FORM_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'PHASE_1_SUBMITTED', label: 'Phase 1 Submitted' },
  { value: 'PHASE_2_IN_PROGRESS', label: 'Phase 2 In Progress' },
  { value: 'PHASE_2_SUBMITTED', label: 'Phase 2 Submitted' },
]

// Debounce delay for search
const SEARCH_DEBOUNCE_MS = 400

export function ULAPLeadStatusTable({
  partnerType,
  refreshTrigger = 0,
  onLeadSelect,
}: ULAPLeadStatusTableProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<ULAPLead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Base path for partner/employee portal
  const basePath = partnerType === 'EMPLOYEE'
    ? '/employees'
    : partnerType === 'BA'
      ? '/partners/ba'
      : '/partners/bp'

  // H3 FIX: Debounced search — only fires API after user stops typing
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setCurrentPage(1) // Reset to page 1 on search change
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchTerm])

  // Fetch leads from unified CRM API
  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', String(currentPage))
      params.append('limit', '20')

      if (filterStatus !== 'ALL') {
        params.append('status', filterStatus)
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch)
      }

      const response = await fetch(`/api/ulap/my-leads?${params.toString()}`)
      const data = await response.json()

      if (data.success && data.data) {
        setLeads(data.data.leads || [])
        setStats(data.data.stats || null)
        setPagination(data.data.pagination || null)
      } else {
        toast.error(data.error || 'Failed to fetch leads')
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error)
      toast.error('Failed to load leads. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, debouncedSearch, currentPage])

  // Initial fetch and on refresh trigger / filter / page change
  useEffect(() => {
    fetchLeads()
  }, [refreshTrigger, fetchLeads])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Handle resume lead (continue to Phase 2)
  const handleResumeLead = (lead: ULAPLead) => {
    if (lead.short_code) {
      router.push(`/apply/${lead.short_code}`)
    } else {
      router.push(`${basePath}/leads/continue/${lead.id}`)
    }
  }

  // Handle share link via WhatsApp (H8 FIX: proper country code)
  const handleShareWhatsApp = (lead: ULAPLead) => {
    if (!lead.short_link) {
      toast.error('No link available for this lead')
      return
    }

    const message = encodeURIComponent(
      `Hi${lead.customer_name ? ' ' + lead.customer_name : ''}! Here's your loan application link to complete your application: ${lead.short_link}`
    )

    // Ensure Indian country code (91) is prepended
    const mobile = lead.customer_mobile.replace(/[^0-9]/g, '')
    const waNumber = mobile.length === 10 ? `91${mobile}` : mobile.replace(/^\+/, '')
    window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank')
  }

  // Handle copy link
  const handleCopyLink = async (lead: ULAPLead) => {
    if (!lead.short_link) return

    try {
      await navigator.clipboard.writeText(lead.short_link)
      setCopiedLink(lead.id)
      toast.success('Link copied to clipboard')
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = setTimeout(() => setCopiedLink(null), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  // Get badge variant for form status
  const getFormStatusBadge = (status: string) => {
    const variants: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
      PHASE_1_SUBMITTED: 'warning',
      PHASE_2_IN_PROGRESS: 'info',
      PHASE_2_SUBMITTED: 'success',
      SUBMITTED: 'success',
    }
    return variants[status] || 'info'
  }

  // Get status display text
  const getStatusDisplayText = (status: string) => {
    const displayText: Record<string, string> = {
      PHASE_1_SUBMITTED: 'Phase 1 Done',
      PHASE_2_IN_PROGRESS: 'Phase 2 Pending',
      PHASE_2_SUBMITTED: 'Completed',
      SUBMITTED: 'Completed',
    }
    return displayText[status] || status.replace(/_/g, ' ')
  }

  // L7 FIX: Format date with error handling
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return 'Invalid date'
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return 'Invalid date'
    }
  }

  // M15/M16 FIX: Mask PII
  const maskMobile = (mobile: string) => {
    const digits = mobile.replace(/[^0-9]/g, '')
    if (digits.length >= 10) {
      const last10 = digits.slice(-10)
      return `${last10.slice(0, 2)}****${last10.slice(6)}`
    }
    return '****'
  }

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@')
    if (!domain) return '****'
    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***'
    return `${maskedLocal}@${domain}`
  }

  // Check if lead can be resumed
  const canResume = (lead: ULAPLead) => {
    return (
      lead.form_status === 'PHASE_1_SUBMITTED' ||
      lead.form_status === 'PHASE_2_IN_PROGRESS'
    )
  }

  // H4 FIX: Get effective loan amount
  const getEffectiveLoanAmount = (lead: ULAPLead) => {
    return lead.loan_amount || lead.required_loan_amount || null
  }

  // Determine if filters are active
  const hasActiveFilters = filterStatus !== 'ALL' || debouncedSearch.length > 0

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center gap-2 text-neutral-400 text-sm">
              <FileText className="w-4 h-4" aria-hidden="true" />
              Total Leads
            </div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Clock className="w-4 h-4" aria-hidden="true" />
              Phase 1 Done
            </div>
            <div className="text-2xl font-bold text-yellow-400 mt-1">
              {stats.phase_1_submitted}
            </div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              In Progress
            </div>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {stats.phase_2_in_progress}
            </div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              Completed
            </div>
            <div className="text-2xl font-bold text-green-400 mt-1">
              {stats.phase_2_submitted}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        {/* Search with debounce */}
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" aria-hidden="true" />
            <label htmlFor="lead-search" className="sr-only">Search leads by number, name, or mobile</label>
            <input
              id="lead-search"
              type="text"
              placeholder="Search by lead number, name, or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-neutral-600 bg-neutral-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none placeholder:text-neutral-500"
            />
          </div>
        </div>

        {/* Status Filter */}
        <label htmlFor="lead-status-filter" className="sr-only">Filter by status</label>
        <select
          id="lead-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-neutral-600 bg-neutral-800 text-white rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
        >
          {FORM_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Refresh Button */}
        <button
          onClick={fetchLeads}
          disabled={loading}
          aria-label="Refresh leads"
          className="px-4 py-2 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 transition flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-neutral-700 rounded-lg">
        <table className="w-full" role="table">
          <thead className="bg-neutral-800 border-b border-neutral-700">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Lead ID
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Loan Details
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Progress
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-neutral-900 divide-y divide-neutral-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading leads...
                  </div>
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-10 h-10 text-neutral-600" aria-hidden="true" />
                    {/* M21 FIX: Differentiate between no results and no leads */}
                    {hasActiveFilters ? (
                      <>
                        <p>No leads match your search or filters.</p>
                        <button
                          onClick={() => {
                            setSearchTerm('')
                            setFilterStatus('ALL')
                          }}
                          className="text-sm text-orange-400 hover:text-orange-300 mt-1"
                        >
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        <p>No leads found.</p>
                        <p className="text-sm text-neutral-500">
                          Start by submitting a new lead from the &quot;Submit a Lead&quot; page.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-neutral-800 transition" tabIndex={0}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-white">
                      {lead.lead_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">
                        {lead.customer_name || 'Not Provided'}
                      </div>
                      {/* M15 FIX: Mask mobile number */}
                      <div className="text-sm text-neutral-400">{maskMobile(lead.customer_mobile)}</div>
                      {/* M16 FIX: Mask email */}
                      {lead.customer_email && (
                        <div className="text-xs text-neutral-500">{maskEmail(lead.customer_email)}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {lead.loan_type || 'Not Specified'}
                      </div>
                      <div className="text-sm text-neutral-400">
                        {formatCurrency(getEffectiveLoanAmount(lead))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getFormStatusBadge(lead.form_status)}>
                      {getStatusDisplayText(lead.form_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-neutral-700 rounded-full h-2 overflow-hidden w-20" role="progressbar" aria-valuenow={lead.form_completion_percentage} aria-valuemin={0} aria-valuemax={100}>
                        <div
                          className="bg-orange-500 h-full transition-all"
                          style={{ width: `${lead.form_completion_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-400 w-10 text-right">
                        {lead.form_completion_percentage}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400">
                    {formatDate(lead.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Resume Button - only for incomplete leads */}
                      {canResume(lead) && (
                        <button
                          onClick={() => handleResumeLead(lead)}
                          className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition flex items-center gap-1"
                          aria-label={`Resume application for ${lead.customer_name || lead.lead_number}`}
                          title="Continue Application"
                        >
                          <Play className="w-4 h-4" aria-hidden="true" />
                          <span className="text-xs hidden sm:inline">Resume</span>
                        </button>
                      )}

                      {/* Share via WhatsApp */}
                      <button
                        onClick={() => handleShareWhatsApp(lead)}
                        disabled={!lead.short_link}
                        className="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Share via WhatsApp with ${lead.customer_name || 'customer'}`}
                        title="Share via WhatsApp"
                      >
                        <Share2 className="w-4 h-4" aria-hidden="true" />
                      </button>

                      {/* Copy Link */}
                      <button
                        onClick={() => handleCopyLink(lead)}
                        disabled={!lead.short_link}
                        className="p-2 text-neutral-400 hover:bg-neutral-700 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Copy link for ${lead.customer_name || lead.lead_number}`}
                        title="Copy Link"
                      >
                        {copiedLink === lead.id ? (
                          <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
                        ) : (
                          <Copy className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>

                      {/* View in new tab */}
                      {lead.short_link && (
                        <a
                          href={lead.short_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-neutral-400 hover:bg-neutral-700 rounded-lg transition"
                          aria-label={`Open application link for ${lead.customer_name || lead.lead_number}`}
                          title="Open Link"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* H2 FIX: Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-400">
            Showing {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, pagination.total)} of {pagination.total} leads
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || loading}
              aria-label="Previous page"
              className="px-3 py-1.5 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              Prev
            </button>
            <span className="text-sm text-neutral-400 px-2">
              Page {currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
              disabled={currentPage >= pagination.totalPages || loading}
              aria-label="Next page"
              className="px-3 py-1.5 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Results Summary (single page) */}
      {!loading && leads.length > 0 && pagination && pagination.totalPages <= 1 && (
        <div className="text-sm text-neutral-400 text-center">
          Showing {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default ULAPLeadStatusTable
