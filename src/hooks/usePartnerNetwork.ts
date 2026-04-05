'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

// ─── Types ───

export interface RecruitmentInvitation {
  id: string
  mobile_number: string
  recipient_name: string | null
  email: string | null
  partner_type_target: string
  status: string
  display_status: string
  full_registration_url: string
  short_code: string | null
  click_count: number
  created_at: string
  expires_at: string | null
  is_expired: boolean
  days_remaining: number | null
  reminder_count: number
}

export interface RecruitmentStats {
  invitations: {
    total_sent: number
    registered: number
    pending: number
    expired: number
    clicked: number
    conversion_rate: number
  }
  by_partner_type: Record<string, { sent: number; registered: number; pending: number }>
  this_month: { sent: number; registered: number }
  partners: { total: number; active: number }
  funnel: {
    invited: number
    clicked: number
    registered: number
    click_rate: number
    conversion_rate: number
    click_to_register_rate: number
  }
}

export interface GenerateLinkInput {
  partner_type: string
  mobile_number: string
  recipient_name?: string | null
  recipient_email?: string | null
}

export interface GenerateLinkResult {
  invitation_id: string
  mobile_number: string
  partner_type: string
  registration_link: string
  whatsapp_url: string
  whatsapp_message: string
  expires_at: string
}

export interface Partner {
  id: string
  partner_id: string
  partner_type: string
  full_name: string
  mobile_number: string
  work_email: string | null
  city: string | null
  state: string | null
  is_active: boolean
  joining_date: string | null
  total_leads: number
  leads_in_progress: number
  leads_sanctioned: number
  leads_dropped: number
  estimated_payout: number
  actual_payout: number
  lifetime_earnings: number
  total_logins: number
  last_login_at: string | null
  created_at: string
  conversion_rate: number
  days_since_last_login: number | null
  partner_type_label: string
  churn_risk: 'GREEN' | 'YELLOW' | 'RED' | 'BLACK'
}

export interface PartnerSummary {
  total: number
  active: number
  inactive: number
  total_leads: number
  total_sanctioned: number
  overall_conversion_rate: number
}

export interface PartnerLead {
  id: string
  lead_number: string
  customer_first_name: string
  customer_city: string | null
  loan_type: string
  loan_amount: number
  lead_status: string
  form_status: string
  form_completion: number
  cam_status: string | null
  priority: string | null
  assigned_bde: string | null
  partner_name: string
  partner_id_display: string
  partner_type: string
  submitted_at: string
  last_updated: string
  is_read_only: boolean
}

export interface PipelineData {
  [status: string]: { count: number; value: number }
}

export interface PartnerLeadsPipelineDetail {
  pipeline: PipelineData
  by_partner_type: Record<string, { count: number; value: number }>
  by_loan_type: Record<string, { count: number; value: number }>
  monthly_trend: Array<{ month: string; count: number; value: number }>
  totals: {
    total_leads: number
    total_value: number
    this_month_leads: number
    avg_lead_value: number
  }
}

// ─── API Helpers ───

async function fetchApi<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `API error: ${res.status}`)
  }
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Request failed')
  return data
}

async function postApi<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error || `API error: ${res.status}`)
  }
  return data
}

// ─── Query Keys ───

export const partnerNetworkKeys = {
  all: ['partner-network'] as const,
  recruitmentStats: () => [...partnerNetworkKeys.all, 'recruitment-stats'] as const,
  recruitmentHistory: (filters: Record<string, string | number>) =>
    [...partnerNetworkKeys.all, 'recruitment-history', filters] as const,
  partners: (filters: Record<string, string | number>) =>
    [...partnerNetworkKeys.all, 'partners', filters] as const,
  partnerLeads: (filters: Record<string, string | number>) =>
    [...partnerNetworkKeys.all, 'partner-leads', filters] as const,
  partnerLeadsPipeline: () => [...partnerNetworkKeys.all, 'partner-leads-pipeline'] as const,
}

// ─── Recruitment Stats ───

export function useRecruitmentStats() {
  return useQuery({
    queryKey: partnerNetworkKeys.recruitmentStats(),
    queryFn: async () => {
      const data = await fetchApi<{ data: RecruitmentStats }>('/api/employees/dse/partner-recruitment/stats')
      return data.data
    },
    staleTime: 60_000,       // 1 minute
    refetchInterval: 120_000, // 2 minutes
  })
}

// ─── Recruitment History ───

export function useRecruitmentHistory(filters: {
  page: number
  limit?: number
  search?: string
  status?: string
  partner_type?: string
}) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit || 15) })
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.partner_type) params.set('partner_type', filters.partner_type)

  return useQuery({
    queryKey: partnerNetworkKeys.recruitmentHistory(filters),
    queryFn: async () => {
      const data = await fetchApi<{
        data: RecruitmentInvitation[]
        meta: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/employees/dse/partner-recruitment/list?${params}`)
      return { invitations: data.data, meta: data.meta }
    },
    staleTime: 30_000,
  })
}

// ─── Generate Recruitment Link ───

export function useGenerateRecruitmentLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: GenerateLinkInput) => {
      const data = await postApi<{ data: GenerateLinkResult }>('/api/employees/dse/partner-recruitment/generate-link', input)
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerNetworkKeys.recruitmentStats() })
      queryClient.invalidateQueries({ queryKey: [...partnerNetworkKeys.all, 'recruitment-history'] })
    },
  })
}

// ─── Resend Invitation ───

export function useResendInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const data = await postApi<{ data: { whatsapp_url: string; reminder_count: number } }>(
        '/api/employees/dse/partner-recruitment/resend',
        { invitation_id: invitationId }
      )
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...partnerNetworkKeys.all, 'recruitment-history'] })
    },
  })
}

// ─── My Partners ───

export function useMyPartners(filters: {
  page: number
  limit?: number
  search?: string
  partner_type?: string
  status?: string
  sort_by?: string
  sort_order?: string
}) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit || 20) })
  if (filters.search) params.set('search', filters.search)
  if (filters.partner_type) params.set('partner_type', filters.partner_type)
  if (filters.status) params.set('status', filters.status)
  if (filters.sort_by) params.set('sort_by', filters.sort_by)
  if (filters.sort_order) params.set('sort_order', filters.sort_order)

  return useQuery({
    queryKey: partnerNetworkKeys.partners(filters),
    queryFn: async () => {
      const data = await fetchApi<{
        data: Partner[]
        summary: PartnerSummary
        meta: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/employees/dse/my-partners?${params}`)
      return { partners: data.data, summary: data.summary, meta: data.meta }
    },
    staleTime: 30_000,
  })
}

// ─── Partner Leads ───

export function usePartnerLeads(filters: {
  page: number
  limit?: number
  search?: string
  stage?: string
  loan_type?: string
  partner_id?: string
}) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit || 20) })
  if (filters.search) params.set('search', filters.search)
  if (filters.stage) params.set('stage', filters.stage)
  if (filters.loan_type) params.set('loan_type', filters.loan_type)
  if (filters.partner_id) params.set('partner_id', filters.partner_id)

  return useQuery({
    queryKey: partnerNetworkKeys.partnerLeads(filters),
    queryFn: async () => {
      const data = await fetchApi<{
        data: PartnerLead[]
        pipeline: PipelineData
        loan_types: string[]
        meta: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/employees/dse/partner-leads?${params}`)
      return { leads: data.data, pipeline: data.pipeline, loanTypes: data.loan_types, meta: data.meta }
    },
    staleTime: 30_000,
  })
}

// ─── Partner Leads Pipeline Detail ───

export function usePartnerLeadsPipeline() {
  return useQuery({
    queryKey: partnerNetworkKeys.partnerLeadsPipeline(),
    queryFn: async () => {
      const data = await fetchApi<{ data: PartnerLeadsPipelineDetail }>('/api/employees/dse/partner-leads/pipeline')
      return data.data
    },
    staleTime: 60_000,
  })
}

// ─── Export Helpers ───

export function usePartnerExport() {
  const exportPartners = useCallback(async (format: 'csv' | 'excel' = 'csv') => {
    const res = await fetch('/api/employees/dse/my-partners?limit=1000')
    const data = await res.json()
    if (!data.success || !data.data) throw new Error('Failed to fetch partners for export')

    const partners = data.data as Partner[]
    const headers = ['Partner ID', 'Name', 'Type', 'Mobile', 'City', 'State', 'Active', 'Total Leads', 'Sanctioned', 'Conversion Rate', 'Lifetime Earnings', 'Last Login', 'Joined']

    const rows = partners.map((p: Partner) => [
      p.partner_id,
      p.full_name || '',
      p.partner_type_label,
      p.mobile_number,
      p.city || '',
      p.state || '',
      p.is_active ? 'Yes' : 'No',
      String(p.total_leads || 0),
      String(p.leads_sanctioned || 0),
      `${p.conversion_rate}%`,
      String(p.lifetime_earnings || 0),
      p.last_login_at ? new Date(p.last_login_at).toLocaleDateString('en-IN') : 'Never',
      p.joining_date ? new Date(p.joining_date).toLocaleDateString('en-IN') : new Date(p.created_at).toLocaleDateString('en-IN'),
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partners-export-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xls'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const exportPartnerLeads = useCallback(async () => {
    const res = await fetch('/api/employees/dse/partner-leads?limit=1000')
    const data = await res.json()
    if (!data.success || !data.data) throw new Error('Failed to fetch leads for export')

    const leads = data.data as PartnerLead[]
    const headers = ['Lead Number', 'Customer', 'City', 'Loan Type', 'Amount', 'Status', 'Partner', 'Partner Type', 'BDE Assigned', 'Submitted', 'Last Updated']

    const rows = leads.map((l: PartnerLead) => [
      l.lead_number,
      l.customer_first_name,
      l.customer_city || '',
      l.loan_type || '',
      String(l.loan_amount || 0),
      (l.lead_status || '').replace(/_/g, ' '),
      l.partner_name,
      (l.partner_type || '').replace(/_/g, ' '),
      l.assigned_bde || 'Unassigned',
      l.submitted_at ? new Date(l.submitted_at).toLocaleDateString('en-IN') : '',
      l.last_updated ? new Date(l.last_updated).toLocaleDateString('en-IN') : '',
    ])

    const bom = '\uFEFF'
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `partner-leads-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  return { exportPartners, exportPartnerLeads }
}

// ─── Bulk Recruitment ───

export interface BulkRecruitEntry {
  mobile_number: string
  recipient_name?: string | null
  recipient_email?: string | null
  partner_type: string
}

export interface BulkRecruitResult {
  mobile_number: string
  recipient_name: string | null
  partner_type: string
  status: 'success' | 'skipped' | 'error'
  message: string
  registration_link?: string
  whatsapp_url?: string
}

export function useBulkRecruitment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entries: BulkRecruitEntry[]) => {
      const data = await postApi<{
        data: {
          results: BulkRecruitResult[]
          summary: { total: number; success: number; skipped: number; errors: number }
        }
      }>('/api/employees/dse/partner-recruitment/bulk', { entries })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: partnerNetworkKeys.recruitmentStats() })
      queryClient.invalidateQueries({ queryKey: [...partnerNetworkKeys.all, 'recruitment-history'] })
    },
  })
}

// ─── Follow-Up Reminders ───

export interface FollowUpReminders {
  overdue_3d: RecruitmentInvitation[]
  overdue_7d: RecruitmentInvitation[]
  clicked_no_register: RecruitmentInvitation[]
  expiring_soon: RecruitmentInvitation[]
  totals: {
    needs_attention: number
    overdue_3d: number
    overdue_7d: number
    clicked_no_register: number
    expiring_soon: number
  }
}

export function useFollowUpReminders() {
  return useQuery({
    queryKey: [...partnerNetworkKeys.all, 'follow-up-reminders'] as const,
    queryFn: async () => {
      const data = await fetchApi<{ data: FollowUpReminders }>('/api/employees/dse/partner-recruitment/follow-up-reminders')
      return data.data
    },
    staleTime: 120_000, // 2 minutes
  })
}

// ─── Partner Scoring ───

export interface ScoredPartner {
  partner_id: string
  display_id: string
  full_name: string
  partner_type: string
  is_active: boolean
  score: number
  grade: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'
  grade_label: string
  grade_color: string
  grade_bg_color: string
  breakdown: {
    leadVolume: number
    conversionRate: number
    disbursementValue: number
    documentQuality: number
    activityFrequency: number
    compliance: number
  }
  insights: string[]
  churn_risk: string
  churn_label: string
  churn_reason: string
  churn_action: string
}

export function usePartnerScoring(partnerId?: string) {
  const params = new URLSearchParams()
  if (partnerId) params.set('partner_id', partnerId)

  return useQuery({
    queryKey: [...partnerNetworkKeys.all, 'scoring', partnerId || 'all'] as const,
    queryFn: async () => {
      const data = await fetchApi<{
        data: ScoredPartner[]
        summary: {
          total_partners: number
          average_score: number
          grade_distribution: Record<string, number>
        }
      }>(`/api/employees/dse/partner-scoring?${params}`)
      return { partners: data.data, summary: data.summary }
    },
    staleTime: 300_000, // 5 minutes
  })
}

// ─── Communication Log ───

export interface CommunicationLog {
  id: string
  partner_id: string
  channel: string
  direction: string
  subject: string | null
  summary: string | null
  outcome: string | null
  duration_seconds: number | null
  next_action: string | null
  next_action_date: string | null
  created_at: string
}

export function useCommunicationLog(partnerId: string) {
  return useQuery({
    queryKey: [...partnerNetworkKeys.all, 'comm-log', partnerId] as const,
    queryFn: async () => {
      const data = await fetchApi<{
        data: CommunicationLog[]
        meta: { page: number; limit: number; total: number; totalPages: number }
      }>(`/api/employees/dse/partner-communication?partner_id=${partnerId}`)
      return data.data
    },
    staleTime: 30_000,
    enabled: !!partnerId,
  })
}

export function useLogCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      partner_id: string
      channel: string
      direction?: string
      subject?: string
      summary?: string
      outcome?: string
      duration_seconds?: number
      next_action?: string
      next_action_date?: string
    }) => {
      const data = await postApi<{ data: CommunicationLog }>('/api/employees/dse/partner-communication', input)
      return data.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...partnerNetworkKeys.all, 'comm-log', variables.partner_id] })
    },
  })
}
