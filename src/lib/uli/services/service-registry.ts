/**
 * ULI Service Registry
 * Maps service_code → DB row, validates enabled status, throws if disabled
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { ULIService } from '../uli-types'

// In-memory cache: service_code → ULIService (TTL 5 minutes)
const serviceCache = new Map<string, { service: ULIService; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Get a ULI service by service_code, throws if disabled or not found
 */
export async function getEnabledULIService(serviceCode: string): Promise<ULIService> {
  const now = Date.now()
  const cached = serviceCache.get(serviceCode)

  if (cached && cached.expiresAt > now) {
    if (!cached.service.is_enabled) {
      throw new Error(`ULI service ${serviceCode} is disabled. Enable it from Super Admin > ULI Hub.`)
    }
    return cached.service
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('uli_services')
    .select('*')
    .eq('service_code', serviceCode)
    .maybeSingle()

  if (error || !data) {
    throw new Error(`ULI service ${serviceCode} not found in registry.`)
  }

  // Cache it
  serviceCache.set(serviceCode, { service: data, expiresAt: now + CACHE_TTL_MS })

  if (!data.is_enabled) {
    throw new Error(`ULI service ${serviceCode} is disabled. Enable it from Super Admin > ULI Hub.`)
  }

  return data
}

/**
 * Check if a ULI service is enabled (non-throwing)
 */
export async function isULIServiceEnabled(serviceCode: string): Promise<boolean> {
  try {
    await getEnabledULIService(serviceCode)
    return true
  } catch {
    return false
  }
}

/**
 * Check if an entire ULI category is enabled via feature flag
 */
export async function isULICategoryEnabled(featureFlagKey: string): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('uli_services')
      .select('is_enabled')
      .eq('feature_flag_key', featureFlagKey)
      .eq('is_enabled', true)
      .limit(1)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

/**
 * Invalidate cache for a service (call after toggling enable/disable)
 */
export function invalidateServiceCache(serviceCode?: string) {
  if (serviceCode) {
    serviceCache.delete(serviceCode)
  } else {
    serviceCache.clear()
  }
}
