/**
 * ULI Service Registry — In-memory cache of enabled services
 * Provides fast lookups for service_code → ULIService
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { ULIService, ULIServiceCategory } from './uli-types'

let serviceCache: ULIService[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get all enabled ULI services (cached)
 */
export async function getEnabledServices(): Promise<ULIService[]> {
  if (Date.now() - cacheTimestamp < CACHE_TTL_MS && serviceCache.length > 0) {
    return serviceCache
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('uli_services')
    .select('*')
    .eq('is_enabled', true)
    .order('category')
    .order('display_order')

  if (error) {
    console.error('Failed to fetch ULI services:', error)
    return serviceCache // Return stale cache on error
  }

  serviceCache = data || []
  cacheTimestamp = Date.now()
  return serviceCache
}

/**
 * Lookup a service by its service_code
 */
export async function getServiceByCode(code: string): Promise<ULIService | null> {
  const services = await getEnabledServices()
  return services.find(s => s.service_code === code) || null
}

/**
 * Get all enabled services in a category
 */
export async function getServicesByCategory(category: ULIServiceCategory): Promise<ULIService[]> {
  const services = await getEnabledServices()
  return services.filter(s => s.category === category)
}

/**
 * Check if a specific service is enabled
 */
export async function isServiceEnabled(code: string): Promise<boolean> {
  const service = await getServiceByCode(code)
  return service !== null
}

/**
 * Invalidate the service cache (call after CRUD operations)
 */
export function invalidateServiceCache() {
  cacheTimestamp = 0
  serviceCache = []
}
