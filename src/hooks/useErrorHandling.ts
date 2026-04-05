'use client'

import { useCallback, useRef } from 'react'
import { useErrorReporting } from '@/lib/error-handling/global-error-handler'

interface ApiErrorContext {
  endpoint: string
  method: string
  status?: number
  response?: unknown
  requestData?: unknown
}

interface AsyncErrorHandler<T> {
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>
  loading: boolean
  error: Error | null
}

export function useErrorHandling() {
  const { reportApiError, reportError } = useErrorReporting()

  // Enhanced API error handler with automatic retry logic
  const handleApiError = useCallback((error: Error | unknown, context: ApiErrorContext) => {
    // Determine if error should be retried
    const isRetryable = context.status && [408, 429, 500, 502, 503, 504].includes(context.status)

    reportApiError(error, {
      ...context,
      response: {
        ...(context.response || {}),
        isRetryable,
        timestamp: new Date().toISOString()
      }
    })

    return isRetryable
  }, [reportApiError])

  // Wrapper for async operations with error handling
  const withErrorHandling = useCallback(<T>(
    asyncFn: () => Promise<T>,
    context: {
      operation: string
      onError?: (error: Error) => void
      retryCount?: number
      retryDelay?: number
    }
  ): Promise<T | null> => {
    const { operation, onError, retryCount = 0, retryDelay = 1000 } = context

    const executeWithRetry = async (attempt: number): Promise<T | null> => {
      try {
        return await asyncFn()
      } catch (error) {
        const isLastAttempt = attempt >= retryCount

        // Report the error
        reportError(`Operation failed: ${operation}`, {
          attempt: attempt + 1,
          maxAttempts: retryCount + 1,
          isLastAttempt,
          operation,
          error: error instanceof Error ? error.message : String(error)
        })

        // Call custom error handler if provided
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }

        // Retry if not the last attempt and error is retryable
        if (!isLastAttempt && shouldRetry(error)) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)))
          return executeWithRetry(attempt + 1)
        }

        // If it's a network error or server error, don't throw - return null
        if (isNetworkOrServerError(error)) {
          return null
        }

        // Re-throw for other types of errors
        throw error
      }
    }

    return executeWithRetry(0)
  }, [reportError])

  // Hook for handling async operations with loading states
  const useAsyncErrorHandler = <T>(): AsyncErrorHandler<T> => {
    const loadingRef = useRef(false)
    const errorRef = useRef<Error | null>(null)

    const execute = useCallback(async (asyncFn: () => Promise<T>): Promise<T | null> => {
      loadingRef.current = true
      errorRef.current = null

      try {
        const result = await asyncFn()
        loadingRef.current = false
        return result
      } catch (error) {
        loadingRef.current = false
        errorRef.current = error instanceof Error ? error : new Error(String(error))

        reportError('Async operation failed', {
          error: errorRef.current.message,
          stack: errorRef.current.stack
        })

        return null
      }
    }, [])

    return {
      execute,
      loading: loadingRef.current,
      error: errorRef.current
    }
  }

  // Utility functions for error classification
  const shouldRetry = (error: Error | unknown): boolean => {
    const err = error instanceof Error ? error : null
    // Network errors
    if (err?.name === 'NetworkError' || err?.message?.includes('fetch')) {
      return true
    }

    // Supabase specific errors that might be retryable
    if (err?.message?.includes('network') || err?.message?.includes('timeout')) {
      return true
    }

    // Rate limiting
    if ((error as {status?: number}).status === 429) {
      return true
    }

    // Server errors (5xx)
    const status = (error as {status?: number}).status
    if (status && status >= 500) {
      return true
    }

    return false
  }

  const isNetworkOrServerError = (error: Error | unknown): boolean => {
    const err = error instanceof Error ? error : null
    const status = (error as {status?: number}).status
    return (
      err?.name === 'NetworkError' ||
      err?.message?.includes('fetch') ||
      err?.message?.includes('network') ||
      (status !== undefined && status >= 500) ||
      status === 429
    )
  }

  // Form error handler
  const handleFormError = useCallback((error: Error | unknown, formName: string, formData?: unknown) => {
    reportError(`Form submission failed: ${formName}`, {
      formName,
      formData: formData ? JSON.stringify(formData) : undefined,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }, [reportError])

  // Auth error handler
  const handleAuthError = useCallback((error: Error | unknown, action: string, userId?: string) => {
    reportApiError(error, {
      endpoint: 'auth',
      method: action,
      status: undefined,
      response: { userId }
    })
  }, [reportApiError])

  return {
    handleApiError,
    withErrorHandling,
    useAsyncErrorHandler,
    handleFormError,
    handleAuthError,
    reportError,
    shouldRetry,
    isNetworkOrServerError
  }
}

// Custom hook for specific error scenarios
export function useApiErrorHandler() {
  const { handleApiError } = useErrorHandling()

  const handleFetchError = useCallback(async (
    fetchFn: () => Promise<Response>,
    context: Omit<ApiErrorContext, 'status' | 'response'>
  ) => {
    try {
      const response = await fetchFn()

      if (!response.ok) {
        const errorData = await response.text()
        const isRetryable = handleApiError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          {
            ...context,
            status: response.status,
            response: errorData
          }
        )

        if (!isRetryable) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        return null
      }

      return response
    } catch (error) {
      const isRetryable = handleApiError(error, context)

      if (!isRetryable) {
        throw error
      }

      return null
    }
  }, [handleApiError])

  return { handleFetchError }
}

// Hook for error boundary integration
export function useErrorBoundaryHandler() {
  const { reportError } = useErrorReporting()

  const reportToErrorBoundary = useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    reportError(`Error boundary caught: ${error.message}`, {
      stack: error.stack,
      errorInfo,
      componentStack: errorInfo?.componentStack,
      boundary: true
    })
  }, [reportError])

  return { reportToErrorBoundary }
}