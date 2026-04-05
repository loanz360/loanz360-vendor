'use client'

/**
 * useFeatureFlags — Client hook for checking feature flags
 *
 * Usage:
 *   const { isEnabled, isLoading } = useFeatureFlag('credit-advisor')
 *   if (isEnabled) { show the feature }
 *
 *   const { flags } = useFeatureFlags('CUSTOMER')
 *   if (flags['loan-comparison']?.enabled) { ... }
 */

import { useState, useEffect, useCallback } from 'react'

interface FlagValue {
  enabled: boolean
  metadata: Record<string, unknown>
}

interface FeatureFlagsState {
  flags: Record<string, FlagValue>
  isLoading: boolean
  error: string | null
}

// Module-level cache to avoid refetching on every component mount
let _cache: Record<string, FlagValue> | null = null
let _cacheTimestamp = 0
const CACHE_TTL = 60_000 // 1 minute

/**
 * Fetch all feature flags for a portal
 */
export function useFeatureFlags(portal: string = 'CUSTOMER'): FeatureFlagsState {
  const [state, setState] = useState<FeatureFlagsState>({
    flags: _cache || {},
    isLoading: !_cache,
    error: null,
  })

  useEffect(() => {
    // Use cache if fresh
    if (_cache && Date.now() - _cacheTimestamp < CACHE_TTL) {
      setState({ flags: _cache, isLoading: false, error: null })
      return
    }

    let cancelled = false

    async function fetchFlags() {
      try {
        const res = await fetch(`/api/feature-flags?portal=${portal}`)
        const json = await res.json()

        if (!cancelled && json.success) {
          _cache = json.data
          _cacheTimestamp = Date.now()
          setState({ flags: json.data, isLoading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false, error: 'Failed to load feature flags' }))
        }
      }
    }

    fetchFlags()
    return () => { cancelled = true }
  }, [portal])

  return state
}

/**
 * Check if a single feature flag is enabled
 */
export function useFeatureFlag(flagKey: string, portal: string = 'CUSTOMER') {
  const { flags, isLoading } = useFeatureFlags(portal)

  return {
    isEnabled: flags[flagKey]?.enabled ?? false,
    metadata: flags[flagKey]?.metadata ?? {},
    isLoading,
  }
}

/**
 * Invalidate the feature flags cache (call after admin updates)
 */
export function invalidateFeatureFlagsCache() {
  _cache = null
  _cacheTimestamp = 0
}
