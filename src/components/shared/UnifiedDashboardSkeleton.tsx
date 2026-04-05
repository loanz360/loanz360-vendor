'use client'

import React from 'react'
import { PageLoading } from '@/components/ui/loading-spinner'

interface UnifiedDashboardSkeletonProps {
  /**
   * Loading text to display
   * Default: "Loading dashboard..."
   */
  text?: string

  /**
   * Sub text to display below main text
   * Default: "Please wait"
   */
  subText?: string

  // Legacy props kept for backwards compatibility but no longer used
  statCards?: number
  showCharts?: boolean
  chartCount?: number
  showTable?: boolean
  showSidebar?: boolean
  portalType?: 'partner' | 'admin' | 'employee' | 'customer'
}

/**
 * Universal Dashboard Skeleton Loader
 *
 * Shows the LOANZ 360 logo spinner while dashboard content is loading.
 * This ensures a consistent branded loading experience across all dashboards.
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <UnifiedDashboardSkeleton text="Loading analytics..." />
 * }
 * ```
 */
export function UnifiedDashboardSkeleton({
  text = "Loading dashboard...",
  subText = "Please wait"
}: UnifiedDashboardSkeletonProps) {
  return (
    <PageLoading
      text={text}
      subText={subText}
    />
  )
}

/**
 * Minimal skeleton for page transitions
 * Shows the LOANZ 360 logo spinner during page navigation
 */
export function MinimalDashboardSkeleton() {
  return (
    <PageLoading
      text="Loading..."
      subText="Please wait"
    />
  )
}

/**
 * Hook to coordinate loading of multiple data sources
 * Ensures all data is loaded before removing skeleton
 *
 * @example
 * ```tsx
 * const { isLoading, allDataLoaded } = useUnifiedLoading([
 *   statsLoading,
 *   chartDataLoading,
 *   tableDataLoading
 * ])
 *
 * if (isLoading || !allDataLoaded) {
 *   return <UnifiedDashboardSkeleton />
 * }
 * ```
 */
export function useUnifiedLoading(loadingStates: boolean[]) {
  const [allDataLoaded, setAllDataLoaded] = React.useState(false)
  const isLoading = loadingStates.some(state => state === true)

  React.useEffect(() => {
    // Only set allDataLoaded to true when ALL loading states are false
    if (!isLoading && loadingStates.length > 0) {
      setAllDataLoaded(true)
    }
  }, [isLoading, loadingStates])

  return {
    isLoading,
    allDataLoaded
  }
}
