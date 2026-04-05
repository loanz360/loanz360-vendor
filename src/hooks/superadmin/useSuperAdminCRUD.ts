'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from '@/lib/utils/toast-helper'
import { clientLogger } from '@/lib/utils/client-logger'
import { superAdminFetch, type ApiResult } from '@/lib/utils/superadmin-helpers'

// ─── Types ────────────────────────────────────────────────────────────

interface UseCRUDOptions {
  baseUrl: string
  entityName: string
  onSuccess?: () => void
  onError?: (error: string) => void
}

interface ConfirmState {
  isOpen: boolean
  title: string
  message: string
  variant: 'danger' | 'warning' | 'info'
  confirmText: string
  onConfirm: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useSuperAdminCRUD({ baseUrl, entityName, onSuccess, onError }: UseCRUDOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: 'Confirm',
    onConfirm: async () => {},
  })

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => ({ ...prev, isOpen: false }))
  }, [])

  /**
   * Fetch data with abort controller support
   */
  const fetchData = useCallback(async <T>(
    url: string,
    options?: RequestInit
  ): Promise<ApiResult<T>> => {
    // Cancel previous request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    abortRef.current = new AbortController()

    setIsLoading(true)
    setError(null)

    try {
      const result = await superAdminFetch<T>(url, {
        ...options,
        signal: abortRef.current.signal,
      })

      if (!result.success) {
        setError(result.error || 'Failed to fetch data')
        if (result.error) {
          clientLogger.error(`Failed to fetch ${entityName}`, { error: result.error })
        }
      }

      return result
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false, error: 'Request cancelled' }
      }
      const message = err instanceof Error ? err.message : 'Network error'
      setError(message)
      clientLogger.error(`Failed to fetch ${entityName}`, { error: message })
      return { success: false, error: message }
    } finally {
      setIsLoading(false)
    }
  }, [entityName])

  /**
   * Create a new entity
   */
  const create = useCallback(async <T>(data: unknown): Promise<ApiResult<T>> => {
    setActionLoading('create')
    setError(null)

    try {
      const result = await superAdminFetch<T>(baseUrl, {
        method: 'POST',
        body: JSON.stringify(data),
      })

      if (result.success) {
        toast.success(result.message || `${entityName} created successfully`)
        onSuccess?.()
      } else {
        toast.error(result.error || `Failed to create ${entityName}`)
        onError?.(result.error || 'Creation failed')
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      toast.error(message)
      clientLogger.error(`Failed to create ${entityName}`, { error: message })
      return { success: false, error: message }
    } finally {
      setActionLoading(null)
    }
  }, [baseUrl, entityName, onSuccess, onError])

  /**
   * Update an entity by ID
   */
  const update = useCallback(async <T>(id: string, data: unknown): Promise<ApiResult<T>> => {
    setActionLoading(`update-${id}`)
    setError(null)

    try {
      const result = await superAdminFetch<T>(`${baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })

      if (result.success) {
        toast.success(result.message || `${entityName} updated successfully`)
        onSuccess?.()
      } else {
        toast.error(result.error || `Failed to update ${entityName}`)
        onError?.(result.error || 'Update failed')
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      toast.error(message)
      clientLogger.error(`Failed to update ${entityName}`, { error: message })
      return { success: false, error: message }
    } finally {
      setActionLoading(null)
    }
  }, [baseUrl, entityName, onSuccess, onError])

  /**
   * Delete an entity with confirmation dialog
   */
  const deleteWithConfirm = useCallback((
    id: string,
    itemName?: string,
    options?: { hardDelete?: boolean }
  ) => {
    const name = itemName || entityName

    setConfirmState({
      isOpen: true,
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete this ${name.toLowerCase()}? ${options?.hardDelete ? 'This action cannot be undone.' : 'This action may be reversible.'}`,
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        setActionLoading(`delete-${id}`)
        try {
          const result = await superAdminFetch(`${baseUrl}/${id}`, {
            method: 'DELETE',
          })

          if (result.success) {
            toast.success(result.message || `${name} deleted successfully`)
            onSuccess?.()
          } else {
            toast.error(result.error || `Failed to delete ${name}`)
            onError?.(result.error || 'Delete failed')
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Network error'
          toast.error(message)
          clientLogger.error(`Failed to delete ${entityName}`, { error: message })
        } finally {
          setActionLoading(null)
          closeConfirm()
        }
      },
    })
  }, [baseUrl, entityName, onSuccess, onError, closeConfirm])

  /**
   * Toggle status with confirmation
   */
  const toggleStatus = useCallback((
    id: string,
    currentStatus: string,
    newStatus: string,
    itemName?: string
  ) => {
    const name = itemName || entityName

    setConfirmState({
      isOpen: true,
      title: `${newStatus === 'ACTIVE' || newStatus === 'enabled' ? 'Enable' : 'Disable'} ${name}?`,
      message: `Are you sure you want to change the status of this ${name.toLowerCase()} from ${currentStatus} to ${newStatus}?`,
      variant: newStatus === 'ACTIVE' || newStatus === 'enabled' ? 'info' : 'warning',
      confirmText: newStatus === 'ACTIVE' || newStatus === 'enabled' ? 'Enable' : 'Disable',
      onConfirm: async () => {
        setActionLoading(`status-${id}`)
        try {
          const result = await superAdminFetch(`${baseUrl}/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus }),
          })

          if (result.success) {
            toast.success(result.message || `${name} status updated`)
            onSuccess?.()
          } else {
            toast.error(result.error || `Failed to update ${name} status`)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Network error'
          toast.error(message)
        } finally {
          setActionLoading(null)
          closeConfirm()
        }
      },
    })
  }, [baseUrl, entityName, onSuccess, closeConfirm])

  /**
   * Perform a custom action with optional confirmation
   */
  const customAction = useCallback(async <T>(
    url: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data?: unknown,
    successMessage?: string
  ): Promise<ApiResult<T>> => {
    setActionLoading('custom')
    setError(null)

    try {
      const result = await superAdminFetch<T>(url, {
        method,
        ...(data != null ? { body: JSON.stringify(data) } : {}),
      })

      if (result.success) {
        toast.success(successMessage || result.message || 'Action completed successfully')
        onSuccess?.()
      } else {
        toast.error(result.error || 'Action failed')
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      toast.error(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(null)
    }
  }, [onSuccess])

  return {
    isLoading,
    actionLoading,
    error,
    setError,
    fetchData,
    create,
    update,
    deleteWithConfirm,
    toggleStatus,
    customAction,
    confirmState,
    closeConfirm,
  }
}

export default useSuperAdminCRUD
