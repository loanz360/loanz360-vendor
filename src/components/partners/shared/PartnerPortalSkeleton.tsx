'use client'

import React from 'react'
import { PageLoading } from '@/components/ui/loading-spinner'

/**
 * Partner Portal Skeleton Loader
 * Shows the LOANZ 360 logo spinner while partner configuration and menu items are loading
 */
export function PartnerPortalSkeleton() {
  return (
    <PageLoading
      text="Loading Portal..."
      subText="Setting up your dashboard"
    />
  )
}
