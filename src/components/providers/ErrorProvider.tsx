'use client'

import { useEffect } from 'react'
import { globalErrorHandler } from '@/lib/error-handling/global-error-handler'
import { CriticalErrorBoundary } from '@/components/error-boundary/ErrorBoundary'

interface ErrorProviderProps {
  children: React.ReactNode
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  useEffect(() => {
    // Initialize global error handler on client side
    globalErrorHandler.initialize()

    // Cleanup function
    return () => {
      // Any cleanup needed
    }
  }, [])

  return (
    <CriticalErrorBoundary name="Root Application">
      {children}
    </CriticalErrorBoundary>
  )
}