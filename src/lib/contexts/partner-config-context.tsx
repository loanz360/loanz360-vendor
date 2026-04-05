'use client'

/**
 * Partner Configuration Context
 * Provides cached partner configuration to avoid repeated database queries
 * This significantly improves performance by loading menu items only once
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getPartnerConfig, type PartnerConfig } from '@/lib/services/partner-config-service'
import { clientLogger } from '@/lib/utils/client-logger'

interface PartnerConfigContextType {
  config: PartnerConfig | null
  loading: boolean
  error: string | null
  refreshConfig: () => Promise<void>
}

const PartnerConfigContext = createContext<PartnerConfigContextType | undefined>(undefined)

interface PartnerConfigProviderProps {
  children: React.ReactNode
  partnerType: 'BUSINESS_ASSOCIATE' | 'BUSINESS_PARTNER' | 'CHANNEL_PARTNER'
}

export function PartnerConfigProvider({ children, partnerType }: PartnerConfigProviderProps) {
  const [config, setConfig] = useState<PartnerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      clientLogger.debug('[PartnerConfigContext] Loading config', { partnerType })
      setLoading(true)
      setError(null)

      const partnerConfig = await getPartnerConfig(partnerType)

      if (!partnerConfig) {
        throw new Error(`Configuration not found for ${partnerType}`)
      }

      setConfig(partnerConfig)
      clientLogger.debug('[PartnerConfigContext] Config loaded successfully', {
        partnerType,
        menuItems: partnerConfig.menuItems.length
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configuration'
      clientLogger.error('[PartnerConfigContext] Failed to load config', { error: errorMessage })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [partnerType])

  // Load config only once on mount
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const refreshConfig = useCallback(async () => {
    await loadConfig()
  }, [loadConfig])

  return (
    <PartnerConfigContext.Provider value={{ config, loading, error, refreshConfig }}>
      {children}
    </PartnerConfigContext.Provider>
  )
}

export function usePartnerConfig() {
  const context = useContext(PartnerConfigContext)
  if (context === undefined) {
    throw new Error('usePartnerConfig must be used within a PartnerConfigProvider')
  }
  return context
}
