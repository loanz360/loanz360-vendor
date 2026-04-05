'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { PageLoading } from '@/components/ui/loading-spinner'

interface LoadingContextType {
  /** Show the global loading spinner */
  showLoading: (message?: string, subMessage?: string) => void
  /** Hide the global loading spinner */
  hideLoading: () => void
  /** Check if loading is active */
  isLoading: boolean
  /** Register a component loader (returns cleanup function) */
  registerLoader: (id: string) => () => void
  /** Unregister a component loader */
  unregisterLoader: (id: string) => void
  /** Set loading for API calls */
  setApiLoading: (loading: boolean) => void
  /** Current loading message */
  loadingMessage: string
  /** Current loading sub-message */
  loadingSubMessage: string
}

const CustomerLoadingContext = createContext<LoadingContextType | undefined>(undefined)

interface CustomerLoadingProviderProps {
  children: ReactNode
  /** Minimum time to show loading (prevents flash) - default 300ms */
  minimumLoadTime?: number
}

export function CustomerLoadingProvider({
  children,
  minimumLoadTime = 300
}: CustomerLoadingProviderProps) {
  const [isManualLoading, setIsManualLoading] = useState(false)
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [isApiLoading, setIsApiLoading] = useState(false)
  const [activeLoaders, setActiveLoaders] = useState<Set<string>>(new Set())
  const [loadingMessage, setLoadingMessage] = useState('Loading...')
  const [loadingSubMessage, setLoadingSubMessage] = useState('Please wait')

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousPathRef = useRef<string | null>(null)
  const loadingStartTimeRef = useRef<number>(0)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track route changes for navigation loading
  useEffect(() => {
    const currentPath = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`

    if (previousPathRef.current !== null && previousPathRef.current !== currentPath) {
      // Route is changing - show loading
      setIsRouteLoading(true)
      loadingStartTimeRef.current = Date.now()
      setLoadingMessage('Loading page...')
      setLoadingSubMessage('Please wait')

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }

    previousPathRef.current = currentPath
  }, [pathname, searchParams])

  // Auto-hide route loading after content is ready
  useEffect(() => {
    if (isRouteLoading) {
      const checkTimeout = setTimeout(() => {
        if (activeLoaders.size === 0) {
          const elapsed = Date.now() - loadingStartTimeRef.current
          const remainingTime = Math.max(0, minimumLoadTime - elapsed)

          hideTimeoutRef.current = setTimeout(() => {
            setIsRouteLoading(false)
          }, remainingTime)
        }
      }, 50)

      return () => clearTimeout(checkTimeout)
    }
  }, [isRouteLoading, activeLoaders.size, minimumLoadTime])

  const showLoading = useCallback((message = 'Loading...', subMessage = 'Please wait') => {
    setLoadingMessage(message)
    setLoadingSubMessage(subMessage)
    setIsManualLoading(true)
    loadingStartTimeRef.current = Date.now()

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }, [])

  const hideLoading = useCallback(() => {
    const elapsed = Date.now() - loadingStartTimeRef.current
    const remainingTime = Math.max(0, minimumLoadTime - elapsed)

    hideTimeoutRef.current = setTimeout(() => {
      setIsManualLoading(false)
    }, remainingTime)
  }, [minimumLoadTime])

  const registerLoader = useCallback((id: string) => {
    setActiveLoaders(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })

    return () => {
      setActiveLoaders(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })

      if (activeLoaders.size <= 1) {
        const elapsed = Date.now() - loadingStartTimeRef.current
        const remainingTime = Math.max(0, minimumLoadTime - elapsed)

        hideTimeoutRef.current = setTimeout(() => {
          setIsRouteLoading(false)
        }, remainingTime)
      }
    }
  }, [activeLoaders.size, minimumLoadTime])

  const unregisterLoader = useCallback((id: string) => {
    setActiveLoaders(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const setApiLoadingState = useCallback((loading: boolean) => {
    if (loading) {
      loadingStartTimeRef.current = Date.now()
      setIsApiLoading(true)
    } else {
      const elapsed = Date.now() - loadingStartTimeRef.current
      const remainingTime = Math.max(0, minimumLoadTime - elapsed)

      setTimeout(() => {
        setIsApiLoading(false)
      }, remainingTime)
    }
  }, [minimumLoadTime])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const isLoading = isManualLoading || isRouteLoading || isApiLoading || activeLoaders.size > 0

  return (
    <CustomerLoadingContext.Provider
      value={{
        showLoading,
        hideLoading,
        isLoading,
        registerLoader,
        unregisterLoader,
        setApiLoading: setApiLoadingState,
        loadingMessage,
        loadingSubMessage,
      }}
    >
      {children}

      {isLoading && (
        <PageLoading
          text={loadingMessage}
          subText={loadingSubMessage}
        />
      )}
    </CustomerLoadingContext.Provider>
  )
}

export function useCustomerLoading() {
  const context = useContext(CustomerLoadingContext)
  if (!context) {
    throw new Error('useCustomerLoading must be used within a CustomerLoadingProvider')
  }
  return context
}

export function useComponentLoading(componentId: string, isComponentLoading: boolean) {
  const { registerLoader } = useCustomerLoading()

  useEffect(() => {
    if (isComponentLoading) {
      const unregister = registerLoader(componentId)
      return unregister
    }
  }, [componentId, isComponentLoading, registerLoader])
}

export function useLoadingFetch() {
  const { setApiLoading } = useCustomerLoading()

  const loadingFetch = useCallback(async <T,>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    setApiLoading(true)
    try {
      const response = await fetch(url, options)
      const data = await response.json()
      return data as T
    } finally {
      setApiLoading(false)
    }
  }, [setApiLoading])

  return loadingFetch
}
