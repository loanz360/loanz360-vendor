/**
 * IP Whitelist for SuperAdmin Access
 * E12: Network-level security for sensitive operations
 */

import { apiLogger } from '@/lib/utils/logger'

/**
 * Get configured IP whitelist from environment
 * Set SUPERADMIN_IP_WHITELIST env var as comma-separated IPs
 * If not set, all IPs are allowed (development mode)
 */
function getWhitelist(): string[] {
  const whitelist = process.env.SUPERADMIN_IP_WHITELIST
  if (!whitelist) return []
  return whitelist.split(',').map(ip => ip.trim()).filter(Boolean)
}

/**
 * Check if an IP is whitelisted for SuperAdmin access
 * Returns true if:
 * - No whitelist is configured (development/staging)
 * - IP is in the whitelist
 * - IP is localhost (127.0.0.1, ::1)
 */
export function isIPWhitelisted(ip: string | null): boolean {
  if (!ip) return false

  const whitelist = getWhitelist()

  // If no whitelist configured, allow all (for development)
  if (whitelist.length === 0) return true

  // Always allow localhost
  const localIPs = ['127.0.0.1', '::1', 'localhost']
  if (localIPs.includes(ip)) return true

  // Check whitelist
  const isAllowed = whitelist.includes(ip)

  if (!isAllowed) {
    apiLogger.warn('IP not whitelisted for SuperAdmin access', { ip, whitelistSize: whitelist.length })
  }

  return isAllowed
}

/**
 * Extract client IP from request headers
 */
export function extractClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  )
}
