import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// CRO query keys factory
export const croQueryKeys = {
  all: ['cro'] as const,
  dashboard: () => [...croQueryKeys.all, 'dashboard'] as const,
  agenda: () => [...croQueryKeys.all, 'agenda'] as const,
  contacts: (filters?: Record<string, unknown>) => [...croQueryKeys.all, 'contacts', filters] as const,
  leads: (filters?: Record<string, unknown>) => [...croQueryKeys.all, 'leads', filters] as const,
  deals: (filters?: Record<string, unknown>) => [...croQueryKeys.all, 'deals', filters] as const,
  followups: (filters?: Record<string, unknown>) => [...croQueryKeys.all, 'followups', filters] as const,
  leadDetail: (id: string) => [...croQueryKeys.all, 'leads', id] as const,
  dealDetail: (id: string) => [...croQueryKeys.all, 'deals', id] as const,
  performance: () => [...croQueryKeys.all, 'performance'] as const,
  analytics: () => [...croQueryKeys.all, 'analytics'] as const,
}

// Shared fetch helper
async function croFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Request failed')
  return json.data
}

// Dashboard hook
export function useCRODashboard() {
  return useQuery({
    queryKey: croQueryKeys.dashboard(),
    queryFn: () => croFetch('/api/cro/dashboard'),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every 60s
  })
}

// Agenda hook
export function useCROAgenda() {
  return useQuery({
    queryKey: croQueryKeys.agenda(),
    queryFn: () => croFetch('/api/cro/agenda'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

// Contacts list hook
export function useCROContacts(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
  }
  return useQuery({
    queryKey: croQueryKeys.contacts(filters),
    queryFn: () => croFetch(`/api/ai-crm/cro/contacts?${params}`),
    staleTime: 30 * 1000,
  })
}

// Leads list hook
export function useCROLeads(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
  }
  return useQuery({
    queryKey: croQueryKeys.leads(filters),
    queryFn: () => croFetch(`/api/ai-crm/cro/leads?${params}`),
    staleTime: 30 * 1000,
  })
}

// Deals list hook
export function useCRODeals(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
  }
  return useQuery({
    queryKey: croQueryKeys.deals(filters),
    queryFn: () => croFetch(`/api/ai-crm/cro/deals?${params}`),
    staleTime: 30 * 1000,
  })
}

// Follow-ups list hook
export function useCROFollowups(filters?: Record<string, unknown>) {
  const params = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
  }
  return useQuery({
    queryKey: croQueryKeys.followups(filters),
    queryFn: () => croFetch(`/api/ai-crm/cro/follow-ups?${params}`),
    staleTime: 30 * 1000,
  })
}

// Lead detail hook
export function useCROLeadDetail(id: string) {
  return useQuery({
    queryKey: croQueryKeys.leadDetail(id),
    queryFn: () => croFetch(`/api/ai-crm/cro/leads/${id}`),
    enabled: !!id,
  })
}

// Deal detail hook
export function useCRODealDetail(id: string) {
  return useQuery({
    queryKey: croQueryKeys.dealDetail(id),
    queryFn: () => croFetch(`/api/ai-crm/cro/deals/${id}`),
    enabled: !!id,
  })
}

// Analytics hook
export function useCROAnalytics() {
  return useQuery({
    queryKey: croQueryKeys.analytics(),
    queryFn: () => croFetch('/api/ai-crm/cro/analytics'),
    staleTime: 60 * 1000,
  })
}

// CRO Reports hook (pipeline tab — period-based)
export function useCROReports(period: string = 'month', options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'reports', period] as const,
    queryFn: () => croFetch(`/api/cro/reports?period=${period}`),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO Call Analytics hook (calls tab — period-based)
export function useCROCallAnalytics(period: string = 'month', options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'call-analytics', period] as const,
    queryFn: () => croFetch(`/api/cro/call-analytics?period=${period}`),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO Funnel Analytics hook (pipeline tab — conversion funnel)
export function useCROFunnel(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'funnel'] as const,
    queryFn: () => croFetch('/api/ai-crm/cro/analytics/funnel'),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO Performance (current month — performance tab)
export function useCROPerformanceCurrentMonth(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'performance', 'current-month'] as const,
    queryFn: () => croFetch('/api/cro/performance/current-month'),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO Leaderboard (performance tab)
export function useCROLeaderboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'performance', 'leaderboard'] as const,
    queryFn: () => croFetch('/api/cro/performance/leaderboard'),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO Graph Data (performance tab — 30-day trend)
export function useCROGraphData(days: number = 30, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'performance', 'graph-data', days] as const,
    queryFn: () => croFetch(`/api/cro/performance/graph-data?days=${days}`),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// CRO AI Insights (ai-coach tab)
export function useCROAIInsights(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...croQueryKeys.all, 'performance', 'ai-insights'] as const,
    queryFn: () => croFetch('/api/cro/performance/ai-insights'),
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
  })
}

// ---------- Mutation hooks ----------

// Update lead status
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const res = await fetch(`/api/ai-crm/cro/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: croQueryKeys.leads() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.leadDetail(variables.leadId) })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dashboard() })
    },
  })
}

// Update deal status
export function useUpdateDealStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, status }: { dealId: string; status: string }) => {
      const res = await fetch(`/api/ai-crm/cro/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update deal status')
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: croQueryKeys.deals() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dealDetail(variables.dealId) })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dashboard() })
    },
  })
}

// Convert lead to deal
export function useConvertLeadToDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, dealData }: { leadId: string; dealData: Record<string, unknown> }) => {
      const res = await fetch('/api/ai-crm/cro/leads/convert-to-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, ...dealData }),
      })
      if (!res.ok) throw new Error('Failed to convert lead to deal')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: croQueryKeys.leads() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.deals() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dashboard() })
    },
  })
}

// Move contact to positive
export function useMoveContactToPositive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch('/api/ai-crm/cro/contacts/move-to-positive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      })
      if (!res.ok) throw new Error('Failed to move contact to positive')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: croQueryKeys.contacts() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dashboard() })
    },
  })
}

// Create follow-up
export function useCreateFollowup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (followupData: Record<string, unknown>) => {
      const res = await fetch('/api/ai-crm/cro/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(followupData),
      })
      if (!res.ok) throw new Error('Failed to create follow-up')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: croQueryKeys.followups() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.agenda() })
      queryClient.invalidateQueries({ queryKey: croQueryKeys.dashboard() })
    },
  })
}
