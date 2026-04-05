'use client'

/**
 * E15: Optimistic Updates for Status Toggles
 * Immediately reflects UI changes while API call is in flight
 * Rolls back automatically on failure
 */

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

interface UseOptimisticToggleOptions {
  /** API endpoint to call */
  endpoint: string
  /** HTTP method (default: PATCH) */
  method?: 'PATCH' | 'PUT' | 'POST'
  /** Field name in the request body (default: 'is_active') */
  field?: string
  /** Success message template - use {value} for the new value */
  successMessage?: string
  /** Error message */
  errorMessage?: string
  /** Callback after successful toggle */
  onSuccess?: (id: string, newValue: boolean) => void
}

/**
 * Hook for optimistic status toggles with automatic rollback
 *
 * @example
 * const { toggleStatus, pendingIds } = useOptimisticToggle({
 *   endpoint: '/api/superadmin/employee-management',
 *   successMessage: 'Employee {value} successfully',
 *   onSuccess: (id) => refetch()
 * })
 *
 * <Switch
 *   checked={employee.is_active}
 *   onChange={() => toggleStatus(employee.id, employee.is_active)}
 *   disabled={pendingIds.has(employee.id)}
 * />
 */
export function useOptimisticToggle(options: UseOptimisticToggleOptions) {
  const {
    endpoint,
    method = 'PATCH',
    field = 'is_active',
    successMessage = 'Status updated successfully',
    errorMessage = 'Failed to update status',
    onSuccess,
  } = options

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const toggleStatus = useCallback(
    async (id: string, currentValue: boolean) => {
      const newValue = !currentValue

      // Optimistically add to pending set (UI should show new state)
      setPendingIds((prev) => new Set(prev).add(id))

      try {
        const response = await fetch(`${endpoint}/${id}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ [field]: newValue }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || errorMessage)
        }

        const msg = successMessage.replace(
          '{value}',
          newValue ? 'activated' : 'deactivated'
        )
        toast.success(msg)
        onSuccess?.(id, newValue)
      } catch (error) {
        // Rollback - remove from pending so UI shows original value
        toast.error(error instanceof Error ? error.message : errorMessage)
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [endpoint, method, field, successMessage, errorMessage, onSuccess]
  )

  return { toggleStatus, pendingIds }
}
