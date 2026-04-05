'use client'

import React from 'react'
import { usePartnerConfig } from '@/lib/contexts/partner-config-context'
import { PartnerPortalSkeleton } from './PartnerPortalSkeleton'
import CommissionChatbot from './CommissionChatbot'

interface PartnerPortalContentProps {
  children: React.ReactNode
}

/**
 * Partner Portal Content Wrapper
 * Shows skeleton loader while configuration is loading
 * Renders children once config is ready
 */
export function PartnerPortalContent({ children }: PartnerPortalContentProps) {
  const { config, loading, error } = usePartnerConfig()

  // Show skeleton while loading
  if (loading) {
    return <PartnerPortalSkeleton />
  }

  // Show error state if config failed to load
  if (error || !config) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-gray-900/90 backdrop-blur-lg rounded-xl shadow-2xl border border-red-500/50 p-8 max-w-md">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Configuration Error</h3>
            <p className="text-gray-400 text-sm">
              {error || 'Failed to load portal configuration. Please try refreshing the page.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Map partner type for chatbot
  const partnerTypeMap: Record<string, 'BA' | 'BP' | 'CP'> = {
    'BUSINESS_ASSOCIATE': 'BA',
    'BUSINESS_PARTNER': 'BP',
    'CHANNEL_PARTNER': 'CP'
  }
  const chatbotPartnerType = partnerTypeMap[config.key] || partnerTypeMap[config.partnerType] || 'BA'

  // Render actual content once loaded
  return (
    <>
      {children}
      <CommissionChatbot partnerType={chatbotPartnerType} />
    </>
  )
}
