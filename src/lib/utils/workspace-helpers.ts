/**
 * Shared utility functions for MY WORKSPACE modules
 * Centralizes common patterns to eliminate duplication
 */

import { toast } from 'sonner'
import { clientLogger } from './client-logger'
import { TOAST_DURATION } from '@/lib/constants/theme'

/**
 * Safe API fetch with standardized error handling
 * Returns { success, data, error } or throws on non-recoverable errors
 */
export async function safeFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data: T | null; error: string | null; status: number }> {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    })

    const status = response.status

    // Handle rate limiting
    if (status === 429) {
      toast.error('Too many requests. Please wait a moment before trying again.', {
        duration: TOAST_DURATION.long,
      })
      return { success: false, data: null, error: 'Rate limit exceeded', status }
    }

    // Handle auth errors
    if (status === 401 || status === 403) {
      toast.error('You are not authorized to perform this action.', {
        duration: TOAST_DURATION.default,
      })
      return { success: false, data: null, error: 'Unauthorized', status }
    }

    // Parse response
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Request failed (${status})`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorJson.message || errorMessage
      } catch {
        // Not JSON, use status text
      }
      return { success: false, data: null, error: errorMessage, status }
    }

    const result = await response.json()

    if (result.success === false) {
      return { success: false, data: null, error: result.error || result.message || 'Request failed', status }
    }

    return { success: true, data: result.data ?? result, error: null, status }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error'
    clientLogger.error('API fetch failed', { url, error: message })
    return { success: false, data: null, error: message, status: 0 }
  }
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number
    allowedTypes?: string[]
    maxSizeLabel?: string
  } = {}
): { valid: boolean; error: string | null } {
  const {
    maxSize = 5 * 1024 * 1024,
    allowedTypes,
    maxSizeLabel = '5MB',
  } = options

  if (file.size > maxSize) {
    return { valid: false, error: `File size exceeds ${maxSizeLabel}. Please select a smaller file.` }
  }

  if (allowedTypes && !allowedTypes.includes(file.type)) {
    const typeLabels = allowedTypes.map(t => t.split('/')[1]?.toUpperCase()).filter(Boolean).join(', ')
    return { valid: false, error: `Invalid file type. Allowed: ${typeLabels}` }
  }

  return { valid: true, error: null }
}

/**
 * Validate multiple files before upload
 */
export function validateFiles(
  files: File[],
  options: {
    maxSize?: number
    maxCount?: number
    maxTotalSize?: number
    allowedTypes?: string[]
    maxSizeLabel?: string
  } = {}
): { valid: boolean; error: string | null } {
  const { maxCount = 10, maxTotalSize = 100 * 1024 * 1024 } = options

  if (files.length > maxCount) {
    return { valid: false, error: `Maximum ${maxCount} files allowed.` }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > maxTotalSize) {
    return { valid: false, error: `Total file size exceeds the limit.` }
  }

  for (const file of files) {
    const result = validateFile(file, options)
    if (!result.valid) return result
  }

  return { valid: true, error: null }
}

/**
 * Format time string (HH:MM) - validates format
 */
export function isValidTimeFormat(time: string): boolean {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return false
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/**
 * Get current financial year string (e.g., "2024-2025")
 */
export function getCurrentFinancialYear(): string {
  const now = new Date()
  const month = now.getMonth() // 0-indexed (0=Jan, 3=Apr)
  const year = now.getFullYear()
  // Indian FY: April to March
  if (month >= 3) { // April (3) onwards = current FY
    return `${year}-${year + 1}`
  }
  return `${year - 1}-${year}`
}

/**
 * Get financial year from a date
 */
export function getFinancialYearFromDate(date: Date): string {
  const month = date.getMonth()
  const year = date.getFullYear()
  if (month >= 3) {
    return `${year}-${year + 1}`
  }
  return `${year - 1}-${year}`
}

/**
 * Show standardized success/error toasts
 */
export const showToast = {
  success: (message: string) => toast.success(message, { duration: TOAST_DURATION.default }),
  error: (message: string) => toast.error(message, { duration: TOAST_DURATION.long }),
  warning: (message: string) => toast.warning(message, { duration: TOAST_DURATION.long }),
  info: (message: string) => toast.info(message, { duration: TOAST_DURATION.default }),
  loading: (message: string) => toast.loading(message),
}
