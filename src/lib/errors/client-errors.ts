/**
 * Client-Side Error Handling Library
 * Handles API errors, network errors, and displays user-friendly messages
 */

import { toast } from 'sonner'
import { ErrorCode, ApiError, getUserFriendlyMessage } from './api-errors'

export interface FetchConfig extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * Enhanced fetch with timeout, retries, and error handling
 */
export async function fetchWithErrorHandling<T = any>(
  url: string,
  config: FetchConfig = {}
): Promise<{
  success: boolean
  data?: T
  error?: string
  details?: unknown}> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    ...fetchConfig
  } = config

  let lastError: Error | null = null
  let delay = retryDelay

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...fetchConfig,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Parse response
      const data = await response.json()

      // Handle non-2xx responses
      if (!response.ok) {
        const apiError = data as ApiError

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          return {
            success: false,
            error: apiError.message || 'Request failed',
            details: apiError.details,
          }
        }

        // Retry on 5xx errors
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
          continue
        }

        return {
          success: false,
          error: apiError.message || 'Server error',
          details: apiError.details,
        }
      }

      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
          continue
        }

        return {
          success: false,
          error: 'Request timed out. Please try again.',
        }
      }

      // Handle network errors
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2
          continue
        }

        return {
          success: false,
          error: 'Network error. Please check your connection.',
        }
      }

      // Other errors - retry
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        continue
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'An unexpected error occurred',
  }
}

/**
 * Show error toast with user-friendly message
 */
export function showErrorToast(
  error: string | ApiError,
  options?: {
    duration?: number
    position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right'
  }
) {
  const message =
    typeof error === 'string'
      ? error
      : error.details && typeof error.details === 'string'
        ? `${error.message}: ${error.details}`
        : error.message

  toast.error(message, {
    duration: options?.duration || 4000,
    position: options?.position || 'top-right',
    style: {
      maxWidth: '500px',
    },
  })
}

/**
 * Show success toast
 */
export function showSuccessToast(
  message: string,
  options?: {
    duration?: number
    position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right'
  }
) {
  toast.success(message, {
    duration: options?.duration || 3000,
    position: options?.position || 'top-right',
  })
}

/**
 * Show info toast
 */
export function showInfoToast(
  message: string,
  options?: {
    duration?: number
    position?: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right'
  }
) {
  toast(message, {
    duration: options?.duration || 3000,
    position: options?.position || 'top-right',
    icon: 'ℹ️',
  })
}

/**
 * Show loading toast
 */
export function showLoadingToast(message: string = 'Processing...') {
  return toast.loading(message)
}

/**
 * Dismiss loading toast
 */
export function dismissToast(toastId: string) {
  toast.dismiss(toastId)
}

/**
 * Handle API error and show appropriate toast
 */
export function handleApiError(error: unknown, fallbackMessage: string = 'An error occurred') {
  console.error('[API Error]', error)

  if (error?.error) {
    showErrorToast(error.error)
  } else if (error?.message) {
    showErrorToast(error.message)
  } else if (typeof error === 'string') {
    showErrorToast(error)
  } else {
    showErrorToast(fallbackMessage)
  }
}

/**
 * Validate response format
 */
export function isValidApiResponse(response: Record<string, unknown>): boolean {
  return (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    typeof response.success === 'boolean'
  )
}

/**
 * Error boundary helper - log error to console with context
 */
export function logError(
  error: Error,
  errorInfo?: { componentStack?: string },
  context?: Record<string, unknown>
) {
  console.group('🚨 Error Caught')
  console.error('Error:', error)
  if (errorInfo?.componentStack) {
    console.error('Component Stack:', errorInfo.componentStack)
  }
  if (context) {
    console.error('Context:', context)
  }
  console.groupEnd()

  // In production, send to error tracking service (Sentry, LogRocket, etc.)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service
    // Sentry.captureException(error, { contexts: { ...context, componentStack: errorInfo?.componentStack } })
  }
}

/**
 * Safe async wrapper with error handling
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    console.error('[Safe Async Error]', error)
    if (onError) {
      onError(error)
    } else {
      handleApiError(error)
    }
    return null
  }
}

/**
 * Debounced error handler (prevents multiple toasts for same error)
 */
const errorCache = new Map<string, number>()
const ERROR_CACHE_TTL = 5000 // 5 seconds

export function showErrorToastDebounced(error: string | ApiError) {
  const errorKey = typeof error === 'string' ? error : error.message
  const now = Date.now()
  const lastShown = errorCache.get(errorKey)

  if (lastShown && now - lastShown < ERROR_CACHE_TTL) {
    return // Skip if same error was shown recently
  }

  errorCache.set(errorKey, now)
  showErrorToast(error)

  // Cleanup old entries
  setTimeout(() => {
    errorCache.delete(errorKey)
  }, ERROR_CACHE_TTL)
}

/**
 * Network status detector
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Setup online/offline listeners
 */
export function setupNetworkListeners(
  onOnline?: () => void,
  onOffline?: () => void
) {
  if (typeof window === 'undefined') return

  const handleOnline = () => {
    showSuccessToast('Connection restored')
    onOnline?.()
  }

  const handleOffline = () => {
    showErrorToast('No internet connection')
    onOffline?.()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
