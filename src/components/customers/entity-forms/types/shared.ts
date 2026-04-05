/**
 * Shared utilities for entity form types
 */

/**
 * SSR-safe UUID generator - works on both server and client
 * Uses try-catch to handle any crypto API issues during SSR
 */
export const generateSafeId = (): string => {
  // Try to use crypto.randomUUID if available (works in browser and Node.js 15.6+)
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through to fallback
  }
  // Fallback for SSR or older browsers - timestamp + random suffix
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 11)
  return `${timestamp}-${randomPart}`
}
