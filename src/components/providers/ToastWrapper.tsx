'use client'

import { ToastProvider } from '@/contexts/ToastContext'
import { Toaster } from 'sonner'
import { ReactNode } from 'react'

interface ToastWrapperProps {
  children: ReactNode
}

/**
 * ToastWrapper - Provides toast functionality for dashboard pages
 *
 * This component wraps pages that need toast notifications.
 * Auth pages should NOT use this wrapper for faster initial load.
 */
export function ToastWrapper({ children }: ToastWrapperProps) {
  return (
    <ToastProvider>
      {children}
      <Toaster
        position="top-right"
        richColors
        duration={4000}
        theme="dark"
      />
    </ToastProvider>
  )
}
