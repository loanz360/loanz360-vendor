'use client'

import { useState, useCallback } from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

interface OptimisticOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error, rollbackData: T) => void
  onRollback?: (rollbackData: T) => void
}

/**
 * Hook for optimistic UI updates.
 * Updates local state immediately, then confirms with API.
 * Rolls back on failure.
 *
 * Usage:
 *   const { execute, isUpdating } = useOptimisticUpdate<Employee[]>()
 *
 *   const handleStatusChange = (id: string, newStatus: string) => {
 *     execute({
 *       currentData: employees,
 *       optimisticData: employees.map(e => e.id === id ? { ...e, status: newStatus } : e),
 *       setData: setEmployees,
 *       apiCall: () => fetch(`/api/hr/employees/${id}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }),
 *     })
 *   }
 */
export function useOptimisticUpdate<T>() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async ({
    currentData,
    optimisticData,
    setData,
    apiCall,
    options = {},
  }: {
    currentData: T
    optimisticData: T
    setData: (data: T) => void
    apiCall: () => Promise<Response>
    options?: OptimisticOptions<T>
  }) => {
    setIsUpdating(true)
    setError(null)

    // Apply optimistic update immediately
    setData(optimisticData)

    try {
      const res = await apiCall()
      if (!res.ok) {
        throw new Error(`API call failed: ${res.status}`)
      }
      const result = await res.json()
      if (result.success === false) {
        throw new Error(result.error || 'Operation failed')
      }
      options.onSuccess?.(optimisticData)
    } catch (err) {
      // Rollback to previous state
      setData(currentData)
      const errorObj = err instanceof Error ? err : new Error(String(err))
      setError(errorObj.message)
      clientLogger.error('Optimistic update failed, rolling back', { error: errorObj.message })
      options.onError?.(errorObj, currentData)
      options.onRollback?.(currentData)
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return { execute, isUpdating, error, clearError: () => setError(null) }
}

/**
 * Hook for optimistic list operations (add, remove, update item).
 */
export function useOptimisticList<T extends { id: string }>(
  items: T[],
  setItems: (items: T[]) => void
) {
  const { execute, isUpdating, error, clearError } = useOptimisticUpdate<T[]>()

  const optimisticAdd = useCallback((newItem: T, apiCall: () => Promise<Response>) => {
    execute({
      currentData: items,
      optimisticData: [newItem, ...items],
      setData: setItems,
      apiCall,
    })
  }, [items, setItems, execute])

  const optimisticRemove = useCallback((id: string, apiCall: () => Promise<Response>) => {
    execute({
      currentData: items,
      optimisticData: items.filter(item => item.id !== id),
      setData: setItems,
      apiCall,
    })
  }, [items, setItems, execute])

  const optimisticUpdate = useCallback((id: string, updates: Partial<T>, apiCall: () => Promise<Response>) => {
    execute({
      currentData: items,
      optimisticData: items.map(item => item.id === id ? { ...item, ...updates } : item),
      setData: setItems,
      apiCall,
    })
  }, [items, setItems, execute])

  return { optimisticAdd, optimisticRemove, optimisticUpdate, isUpdating, error, clearError }
}
