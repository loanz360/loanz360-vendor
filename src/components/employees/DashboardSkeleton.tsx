'use client'

import React from 'react'
import { PageLoading } from '@/components/ui/loading-spinner'

interface DashboardSkeletonProps {
  title?: string
}

/**
 * Dashboard Skeleton Loader
 * Shows the LOANZ 360 logo spinner while dashboard content is loading
 */
export default function DashboardSkeleton({ title }: DashboardSkeletonProps) {
  return (
    <PageLoading
      text={title ? `Loading ${title}...` : "Loading your dashboard..."}
      subText="Please wait while we prepare your dashboard"
    />
  )
}
