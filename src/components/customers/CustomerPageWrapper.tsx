'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { PageLoading } from '@/components/ui/loading-spinner'

interface CustomerPageWrapperProps {
  children: React.ReactNode
  loadingText?: string
  loadingSubText?: string
  minimumLoadTime?: number
  showInitialLoader?: boolean
}

export function CustomerPageWrapper({
  children,
  loadingText = 'Loading...',
  loadingSubText = 'Please wait',
  minimumLoadTime = 300,
  showInitialLoader = true
}: CustomerPageWrapperProps) {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(showInitialLoader)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [previousPath, setPreviousPath] = useState<string | null>(null)

  useEffect(() => {
    if (showInitialLoader) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, minimumLoadTime)
      return () => clearTimeout(timer)
    }
  }, [showInitialLoader, minimumLoadTime])

  useEffect(() => {
    if (previousPath && previousPath !== pathname) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, minimumLoadTime)
      return () => clearTimeout(timer)
    }
    setPreviousPath(pathname)
  }, [pathname, previousPath, minimumLoadTime])

  if (isLoading || isTransitioning) {
    return <PageLoading text={loadingText} subText={loadingSubText} />
  }

  return <>{children}</>
}

export function usePageLoading(initialLoading = true) {
  const [isLoading, setIsLoading] = useState(initialLoading)

  const startLoading = useCallback(() => setIsLoading(true), [])
  const stopLoading = useCallback(() => setIsLoading(false), [])

  return {
    isLoading,
    startLoading,
    stopLoading,
    setIsLoading
  }
}

export function useMultipleLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }))
  }, [])

  const isAnyLoading = Object.values(loadingStates).some(state => state)

  return {
    loadingStates,
    setLoading,
    isAnyLoading
  }
}

export default CustomerPageWrapper
