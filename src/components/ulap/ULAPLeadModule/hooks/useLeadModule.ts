/**
 * useLeadModule Hook
 * Main hook for ULAP Lead Module logic
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  ULAPModuleContext,
  ULAPLeadSubmission,
  ULAPSubmitResponse,
  ULAPLeadStatusItem,
  ULAPLeadFilters,
  ULAPLeadsResponse,
  ULAPUserContext,
} from '../types'
import { getModuleConfig } from '../config'

interface UseLeadModuleOptions {
  context: ULAPModuleContext
  userContext: ULAPUserContext | null
}

interface UseLeadModuleReturn {
  // Config
  config: ReturnType<typeof getModuleConfig>

  // Lead submission
  submitLead: (data: Partial<ULAPLeadSubmission>) => Promise<ULAPSubmitResponse>
  isSubmitting: boolean
  submitError: string | null
  lastSubmittedLead: { id: string; number: string } | null

  // Lead status
  leads: ULAPLeadStatusItem[]
  leadsTotal: number
  leadsTotalPages: number
  isLoadingLeads: boolean
  leadsError: string | null
  fetchLeads: (page?: number, filters?: ULAPLeadFilters) => Promise<void>
  currentPage: number
  filters: ULAPLeadFilters

  // Stats
  stats: {
    total: number
    pending: number
    inProgress: number
    completed: number
    rejected: number
  }
}

export function useLeadModule({
  context,
  userContext,
}: UseLeadModuleOptions): UseLeadModuleReturn {
  const config = getModuleConfig(context)

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [lastSubmittedLead, setLastSubmittedLead] = useState<{ id: string; number: string } | null>(null)

  // Leads state
  const [leads, setLeads] = useState<ULAPLeadStatusItem[]>([])
  const [leadsTotal, setLeadsTotal] = useState(0)
  const [leadsTotalPages, setLeadsTotalPages] = useState(0)
  const [isLoadingLeads, setIsLoadingLeads] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<ULAPLeadFilters>({})

  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    rejected: 0,
  })

  /**
   * Submit a lead
   */
  const submitLead = useCallback(
    async (data: Partial<ULAPLeadSubmission>): Promise<ULAPSubmitResponse> => {
      if (!userContext) {
        return { success: false, error: 'User not authenticated' }
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        // Prepare submission data with source attribution
        const submissionData: ULAPLeadSubmission = {
          customer_name: data.customer_name || '',
          customer_mobile: data.customer_mobile || '',
          customer_email: data.customer_email,
          customer_city: data.customer_city,
          customer_state: data.customer_state,
          customer_pincode: data.customer_pincode,
          loan_type: data.loan_type || '',
          loan_category_id: data.loan_category_id,
          loan_subcategory_id: data.loan_subcategory_id,
          required_loan_amount: data.required_loan_amount,
          collected_data: data.collected_data,

          // Auto-filled source attribution
          source_type: config.sourceType,
          source_user_id: userContext.userId,
          source_user_name: userContext.userName,
          source_partner_id: userContext.partnerId,
          source_partner_name: userContext.partnerName,
          trace_token: data.trace_token,
        }

        const response = await fetch('/api/ulap/module/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionData),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to submit lead')
        }

        setLastSubmittedLead({
          id: result.lead_id,
          number: result.lead_number,
        })

        return result as ULAPSubmitResponse
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit lead'
        setSubmitError(errorMessage)
        return { success: false, error: errorMessage }
      } finally {
        setIsSubmitting(false)
      }
    },
    [userContext, config.sourceType]
  )

  /**
   * Fetch leads for status tab
   */
  const fetchLeads = useCallback(
    async (page: number = 1, newFilters?: ULAPLeadFilters) => {
      if (!userContext) return

      setIsLoadingLeads(true)
      setLeadsError(null)

      if (newFilters) {
        setFilters(newFilters)
      }

      const activeFilters = newFilters || filters

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: '20',
          source_type: config.sourceType,
          source_user_id: userContext.userId,
          ...(activeFilters.status && { status: activeFilters.status }),
          ...(activeFilters.loan_type && { loan_type: activeFilters.loan_type }),
          ...(activeFilters.date_from && { date_from: activeFilters.date_from }),
          ...(activeFilters.date_to && { date_to: activeFilters.date_to }),
          ...(activeFilters.search && { search: activeFilters.search }),
        })

        const response = await fetch(`/api/ulap/module/leads?${params}`)
        const data: ULAPLeadsResponse = await response.json()

        if (!response.ok) {
          throw new Error('Failed to fetch leads')
        }

        setLeads(data.leads)
        setLeadsTotal(data.total)
        setLeadsTotalPages(data.total_pages)
        setCurrentPage(page)

        // Calculate stats from response
        calculateStats(data.leads)
      } catch (err) {
        console.error('Error fetching leads:', err)
        setLeadsError(err instanceof Error ? err.message : 'Failed to fetch leads')
      } finally {
        setIsLoadingLeads(false)
      }
    },
    [userContext, config.sourceType, filters]
  )

  /**
   * Calculate stats from leads
   */
  const calculateStats = useCallback((leadsList: ULAPLeadStatusItem[]) => {
    const newStats = {
      total: leadsList.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      rejected: 0,
    }

    leadsList.forEach((lead) => {
      const status = lead.lead_status?.toUpperCase() || ''

      if (status.includes('NEW') || status.includes('PENDING')) {
        newStats.pending++
      } else if (status.includes('REJECTED') || status.includes('DROPPED')) {
        newStats.rejected++
      } else if (status.includes('DISBURSED') || status.includes('COMPLETED')) {
        newStats.completed++
      } else {
        newStats.inProgress++
      }
    })

    setStats(newStats)
  }, [])

  // Fetch initial leads when user context is available
  useEffect(() => {
    if (userContext && config.showLeadStatus) {
      fetchLeads(1)
    }
  }, [userContext, config.showLeadStatus])

  return {
    config,
    submitLead,
    isSubmitting,
    submitError,
    lastSubmittedLead,
    leads,
    leadsTotal,
    leadsTotalPages,
    isLoadingLeads,
    leadsError,
    fetchLeads,
    currentPage,
    filters,
    stats,
  }
}

export default useLeadModule
