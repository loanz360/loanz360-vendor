'use client'

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react'
import Toast, { ToastType } from '@/components/ui/Toast'

interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString() + Math.random().toString(36)
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast])
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast])
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast])
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast])

  // Listen for custom toast events from toast-helper (for class components)
  useEffect(() => {
    const handleToastEvent = (event: CustomEvent<{ message: string; type: ToastType }>) => {
      showToast(event.detail.message, event.detail.type)
    }

    window.addEventListener('show-toast' as any, handleToastEvent as EventListener)

    return () => {
      window.removeEventListener('show-toast' as any, handleToastEvent as EventListener)
    }
  }, [showToast])

  // Memoize provider value — without this, every render produced a new
  // object, every `useToast()` consumer got a new ref, and useCallbacks
  // depending on `toast` got new fn refs each render, retriggering any
  // useEffect that listed them in deps and producing infinite fetch loops.
  const value = useMemo(
    () => ({ showToast, success, error, warning, info }),
    [showToast, success, error, warning, info]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
