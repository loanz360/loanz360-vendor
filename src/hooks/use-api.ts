/**
 * Enterprise-grade API hooks for React components
 *
 * Features:
 * - Type-safe API calls
 * - Loading states
 * - Error handling
 * - Caching
 * - Optimistic updates
 * - Retry logic
 * - Request deduplication
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: {
    requestId: string
    timestamp: string
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  retries?: number
  retryDelay?: number
  cache?: boolean
  cacheTime?: number
  dedupe?: boolean
}

export interface UseApiState<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

// Simple in-memory cache
const apiCache = new Map<string, { data: unknown; timestamp: number }>()

// Track in-flight requests for deduplication
const inFlightRequests = new Map<string, Promise<unknown>>()

// =============================================================================
// USE FETCH HOOK
// =============================================================================

export function useFetch<T>(
  url: string,
  options?: UseApiOptions<T>
): UseApiState<T> & {
  refetch: () => Promise<void>
  mutate: (data: T) => void
} {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: true,
    isError: false,
    isSuccess: false,
  })

  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchData = useCallback(async () => {
    const {
      onSuccess,
      onError,
      retries = 3,
      retryDelay = 1000,
      cache = false,
      cacheTime = 60000, // 1 minute
      dedupe = true,
    } = optionsRef.current || {}

    // Check cache
    if (cache) {
      const cached = apiCache.get(url)
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setState({
          data: cached.data as T,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        })
        return
      }
    }

    // Check for in-flight request (deduplication)
    if (dedupe && inFlightRequests.has(url)) {
      try {
        const data = (await inFlightRequests.get(url)) as T
        setState({
          data,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        })
        return
      } catch (error) {
        // Fall through to make new request
      }
    }

    setState((prev) => ({ ...prev, isLoading: true, isError: false }))

    let lastError: Error | null = null

    const request = (async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result: ApiResponse<T> = await response.json()

          if (!result.success) {
            throw new Error(result.message || 'Request failed')
          }

          const data = result.data as T

          // Update cache
          if (cache) {
            apiCache.set(url, { data, timestamp: Date.now() })
          }

          setState({
            data,
            error: null,
            isLoading: false,
            isError: false,
            isSuccess: true,
          })

          onSuccess?.(data)
          return data
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')

          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)))
          }
        }
      }

      setState({
        data: null,
        error: lastError,
        isLoading: false,
        isError: true,
        isSuccess: false,
      })

      onError?.(lastError!)
      throw lastError
    })()

    // Track in-flight request
    if (dedupe) {
      inFlightRequests.set(url, request)
      request.finally(() => inFlightRequests.delete(url))
    }

    return request
  }, [url])

  // Mutate function for optimistic updates
  const mutate = useCallback((data: T) => {
    setState((prev) => ({ ...prev, data }))
    // Update cache
    if (optionsRef.current?.cache) {
      apiCache.set(url, { data, timestamp: Date.now() })
    }
  }, [url])

  // Initial fetch
  useEffect(() => {
    fetchData().catch(() => {
      // Error already handled in fetchData
    })
  }, [fetchData])

  return {
    ...state,
    refetch: fetchData,
    mutate,
  }
}

// =============================================================================
// USE MUTATION HOOK
// =============================================================================

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void
    onError?: (error: Error, variables: TVariables) => void
    onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void
  }
): {
  mutate: (variables: TVariables) => Promise<TData>
  mutateAsync: (variables: TVariables) => Promise<TData>
  data: TData | null
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  reset: () => void
} {
  const [state, setState] = useState<{
    data: TData | null
    error: Error | null
    isLoading: boolean
    isError: boolean
    isSuccess: boolean
  }>({
    data: null,
    error: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  })

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setState({
        data: null,
        error: null,
        isLoading: true,
        isError: false,
        isSuccess: false,
      })

      try {
        const result = await mutationFn(variables)

        if (!result.success) {
          throw new Error(result.message || 'Mutation failed')
        }

        const data = result.data as TData

        setState({
          data,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
        })

        options?.onSuccess?.(data, variables)
        options?.onSettled?.(data, null, variables)

        return data
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error')

        setState({
          data: null,
          error: err,
          isLoading: false,
          isError: true,
          isSuccess: false,
        })

        options?.onError?.(err, variables)
        options?.onSettled?.(null, err, variables)

        throw err
      }
    },
    [mutationFn, options]
  )

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: false,
    })
  }, [])

  return {
    mutate,
    mutateAsync: mutate,
    ...state,
    reset,
  }
}

// =============================================================================
// LEADS API HOOKS
// =============================================================================

export interface Lead {
  id: string
  name: string
  phone: string
  email?: string
  location?: string
  loan_type: string
  loan_amount: number
  status: string
  stage: string
  created_at: string
  [key: string]: unknown
}

export interface LeadsResponse {
  data: Lead[]
  summary: {
    total: number
    by_status: Record<string, number>
    by_stage: Record<string, number>
  }
  meta: {
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

export function useLeads(params?: {
  page?: number
  limit?: number
  status?: string
  stage?: string
  search?: string
}) {
  const queryString = params
    ? '?' +
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&')
    : ''

  return useFetch<LeadsResponse>(`/api/ai-crm/cro/leads${queryString}`, {
    cache: true,
    cacheTime: 30000, // 30 seconds
  })
}

export function useCreateLead() {
  return useMutation<Lead, Partial<Lead>>(async (data) => {
    const response = await fetch('/api/ai-crm/cro/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  })
}

export function useUpdateLead() {
  return useMutation<Lead, { id: string; data: Partial<Lead> }>(async ({ id, data }) => {
    const response = await fetch(`/api/ai-crm/cro/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  })
}

export function useConvertLead() {
  return useMutation<
    { deal_id: string; bde_id: string },
    { leadId: string; assignmentMode: 'auto' | 'manual'; bdeId?: string; notes?: string }
  >(async ({ leadId, ...data }) => {
    const response = await fetch(`/api/ai-crm/cro/leads/${leadId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  })
}

export function useBulkUpdateLeads() {
  return useMutation<
    { success: number; failed: number },
    { operation: string; ids: string[]; status?: string; stage?: string; reason?: string }
  >(async (data) => {
    const response = await fetch('/api/ai-crm/cro/leads/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return response.json()
  })
}

export function useExportLeads() {
  return useMutation<Blob, { format: 'csv' | 'json'; filters?: Record<string, string> }>(
    async (data) => {
      const response = await fetch('/api/ai-crm/cro/leads/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (data.format === 'csv') {
        return { success: true, data: await response.blob() } as unknown as ApiResponse<Blob>
      }

      return response.json()
    }
  )
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Debounce hook for search inputs
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Clear cache for specific URL or all
 */
export function clearApiCache(url?: string): void {
  if (url) {
    apiCache.delete(url)
  } else {
    apiCache.clear()
  }
}
