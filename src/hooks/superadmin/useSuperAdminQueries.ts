/**
 * SuperAdmin React Query Hooks
 * E1: Centralized data fetching with automatic caching, refetching, and error handling
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SUPERADMIN_API } from '@/config/api-endpoints'

// ============================================================================
// QUERY KEYS - Centralized cache key management
// ============================================================================

export const superAdminKeys = {
  all: ['superadmin'] as const,
  dashboard: () => [...superAdminKeys.all, 'dashboard'] as const,
  leads: {
    all: () => [...superAdminKeys.all, 'leads'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.leads.all(), 'list', filters] as const,
    detail: (id: string) => [...superAdminKeys.leads.all(), 'detail', id] as const,
    analytics: () => [...superAdminKeys.leads.all(), 'analytics'] as const,
  },
  employees: {
    all: () => [...superAdminKeys.all, 'employees'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.employees.all(), 'list', filters] as const,
    detail: (id: string) => [...superAdminKeys.employees.all(), 'detail', id] as const,
  },
  partners: {
    all: () => [...superAdminKeys.all, 'partners'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.partners.all(), 'list', filters] as const,
    detail: (id: string) => [...superAdminKeys.partners.all(), 'detail', id] as const,
    analytics: () => [...superAdminKeys.partners.all(), 'analytics'] as const,
  },
  customers: {
    all: () => [...superAdminKeys.all, 'customers'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.customers.all(), 'list', filters] as const,
    detail: (id: string) => [...superAdminKeys.customers.all(), 'detail', id] as const,
  },
  admins: {
    all: () => [...superAdminKeys.all, 'admins'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.admins.all(), 'list', filters] as const,
    modules: () => [...superAdminKeys.admins.all(), 'modules'] as const,
  },
  payouts: {
    all: () => [...superAdminKeys.all, 'payouts'] as const,
    batches: (filters: Record<string, string>) => [...superAdminKeys.payouts.all(), 'batches', filters] as const,
    stats: () => [...superAdminKeys.payouts.all(), 'stats'] as const,
    analytics: () => [...superAdminKeys.payouts.all(), 'analytics'] as const,
  },
  realtimeFeed: {
    all: () => [...superAdminKeys.all, 'realtime-feed'] as const,
    list: (filters: Record<string, string>) => [...superAdminKeys.realtimeFeed.all(), 'list', filters] as const,
  },
}

// ============================================================================
// GENERIC FETCH HELPER
// ============================================================================

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    throw new Error(error.error || `API error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// DASHBOARD HOOKS
// ============================================================================

export function useDashboardData() {
  return useQuery({
    queryKey: superAdminKeys.dashboard(),
    queryFn: () => fetchAPI<any>(SUPERADMIN_API.DASHBOARD),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    retry: 2,
  })
}

// ============================================================================
// LEADS HOOKS
// ============================================================================

export function useLeadsList(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.leads.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.LEADS.UNIFIED_CRM}?${params}`),
    staleTime: 15 * 1000,
    retry: 1,
  })
}

export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: superAdminKeys.leads.detail(id),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.LEADS.UNIFIED_CRM}/${id}`),
    enabled: !!id,
  })
}

export function useLeadsAnalytics() {
  return useQuery({
    queryKey: superAdminKeys.leads.analytics(),
    queryFn: () => fetchAPI<any>(SUPERADMIN_API.LEADS.ANALYTICS),
    staleTime: 60 * 1000,
  })
}

// ============================================================================
// EMPLOYEE HOOKS
// ============================================================================

export function useEmployeesList(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.employees.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.EMPLOYEE_MANAGEMENT}?${params}`),
    staleTime: 30 * 1000,
  })
}

// ============================================================================
// PARTNER HOOKS
// ============================================================================

export function usePartnersList(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.partners.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.PARTNER_MANAGEMENT.BASE}?${params}`),
    staleTime: 30 * 1000,
  })
}

export function usePartnerDetail(id: string) {
  return useQuery({
    queryKey: superAdminKeys.partners.detail(id),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.PARTNER_MANAGEMENT.BASE}/${id}`),
    enabled: !!id,
  })
}

// ============================================================================
// CUSTOMER HOOKS
// ============================================================================

export function useCustomersList(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.customers.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.CUSTOMER_MANAGEMENT.BASE}?${params}`),
    staleTime: 30 * 1000,
  })
}

// ============================================================================
// ADMIN MANAGEMENT HOOKS
// ============================================================================

export function useAdminsList(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.admins.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.ADMIN_MANAGEMENT.BASE}?${params}`),
    staleTime: 30 * 1000,
  })
}

export function useSystemModules() {
  return useQuery({
    queryKey: superAdminKeys.admins.modules(),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.ADMIN_MANAGEMENT.MODULES}?is_active=true`),
    staleTime: 5 * 60 * 1000, // 5 minutes - modules rarely change
  })
}

// ============================================================================
// PAYOUT HOOKS
// ============================================================================

export function usePayoutBatches(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.payouts.batches(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.PAYOUTS.BATCHES}?${params}`),
    staleTime: 15 * 1000,
  })
}

export function usePayoutStats() {
  return useQuery({
    queryKey: superAdminKeys.payouts.stats(),
    queryFn: () => fetchAPI<any>(SUPERADMIN_API.PAYOUTS.STATS),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Poll every 30 seconds like the sidebar
  })
}

// ============================================================================
// REALTIME FEED HOOKS
// ============================================================================

export function useRealtimeFeed(filters: Record<string, string> = {}) {
  const params = new URLSearchParams(filters)
  return useQuery({
    queryKey: superAdminKeys.realtimeFeed.list(filters),
    queryFn: () => fetchAPI<any>(`${SUPERADMIN_API.REALTIME_FEED}?${params}`),
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  })
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateAdmin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      fetchAPI<any>(SUPERADMIN_API.ADMIN_MANAGEMENT.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.admins.all() })
    },
  })
}

export function useCreatePartner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) =>
      fetchAPI<any>(SUPERADMIN_API.PARTNER_MANAGEMENT.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.partners.all() })
    },
  })
}

export function useToggleAdminStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ adminId, status, userId }: { adminId: string; status: string; userId: string }) =>
      fetchAPI<any>(`${SUPERADMIN_API.ADMIN_MANAGEMENT.BASE}/${adminId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, updated_by_user_id: userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.admins.all() })
    },
  })
}

export function useApprovePayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) =>
      fetchAPI<any>(`${SUPERADMIN_API.PAYOUTS.BATCHES}/${batchId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.payouts.all() })
    },
  })
}

export function useAcknowledgeActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, action, notes }: { activityId: string; action: string; notes?: string }) =>
      fetchAPI<any>(SUPERADMIN_API.REALTIME_FEED, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId, action, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: superAdminKeys.realtimeFeed.all() })
    },
  })
}
