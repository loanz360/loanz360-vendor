'use client'

import { useEffect, useState, useCallback } from 'react'
import { clientLogger } from '@/lib/utils/client-logger'

export function useCSRFProtection() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch CSRF token on mount
  useEffect(() => {
    fetchToken()
  }, [])

  const fetchToken = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token')
      }

      const data = await response.json() as { csrfToken: string }
      setCSRFToken(data.csrfToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      clientLogger.error('Failed to fetch CSRF token', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Helper to make CSRF-protected requests
  const fetchWithCSRF = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    if (!csrfToken) {
      throw new Error('CSRF token not available')
    }

    const headers = new Headers(options.headers)
    headers.set('x-csrf-token', csrfToken)

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    })
  }, [csrfToken])

  return {
    csrfToken,
    isLoading,
    error,
    refreshToken: fetchToken,
    fetchWithCSRF
  }
}