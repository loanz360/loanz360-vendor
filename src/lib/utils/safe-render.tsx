/**
 * Safe Text Rendering Utilities
 * Prevents XSS attacks by sanitizing user-generated content
 */

import { sanitizeHTML } from '@/lib/validation/input-validator'

/**
 * Safely render user text by escaping HTML
 * Use this for any user-generated content that will be displayed
 */
export function SafeText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null

  // Sanitize the text to escape HTML special characters
  const safe = sanitizeHTML(text)

  return <span className={className}>{safe}</span>
}

/**
 * Safely render user name with fallback
 */
export function SafeUserName({
  name,
  fallback = 'User',
  className
}: {
  name: string | null | undefined
  fallback?: string
  className?: string
}) {
  const displayName = name || fallback
  return <SafeText text={displayName} className={className} />
}

/**
 * Safely render email
 */
export function SafeEmail({
  email,
  className
}: {
  email: string | null | undefined
  className?: string
}) {
  if (!email) return null
  const safe = sanitizeHTML(email)
  return <span className={className}>{safe}</span>
}

/**
 * Truncate text safely
 */
export function SafeTruncatedText({
  text,
  maxLength = 50,
  className
}: {
  text: string | null | undefined
  maxLength?: number
  className?: string
}) {
  if (!text) return null

  const safe = sanitizeHTML(text)
  const truncated = safe.length > maxLength
    ? safe.substring(0, maxLength) + '...'
    : safe

  return <span className={className} title={safe}>{truncated}</span>
}
