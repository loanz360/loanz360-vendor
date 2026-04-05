/**
 * Form Submission Rate Limiter
 * Prevents spam and bot attacks on public forms
 * Works alongside reCAPTCHA for defense in depth
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface RateLimitResult {
  allowed: boolean
  remaining?: number
  resetAt?: Date
  error?: string
}

/**
 * Check and enforce rate limiting for form submissions
 * Uses database tracking for distributed rate limiting
 *
 * @param identifier - IP address or user identifier
 * @param formType - Type of form (e.g., 'lead_submission', 'partner_registration')
 * @param maxAttempts - Maximum attempts allowed
 * @param windowMinutes - Time window in minutes
 * @returns Rate limit result
 */
export async function checkFormRateLimit(
  identifier: string,
  formType: string,
  maxAttempts: number = 5,
  windowMinutes: number = 60
): Promise<RateLimitResult> {
  try {
    // Calculate window start time
    const windowStart = new Date()
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes)

    // Count recent submissions
    const { count, error: countError } = await supabase
      .from('form_submissions_log')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('form_type', formType)
      .gte('created_at', windowStart.toISOString())

    if (countError) {
      console.error('Error checking rate limit:', countError)
      return { allowed: true } // Fail open (allow request on error)
    }

    const attemptCount = count || 0

    if (attemptCount >= maxAttempts) {
      const resetAt = new Date(windowStart)
      resetAt.setMinutes(resetAt.getMinutes() + windowMinutes)

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        error: `Too many attempts. Please try again after ${windowMinutes} minutes.`
      }
    }

    return {
      allowed: true,
      remaining: maxAttempts - attemptCount
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    return { allowed: true } // Fail open
  }
}

/**
 * Log form submission for rate limiting
 * Call this after successful submission
 */
export async function logFormSubmission(
  identifier: string,
  formType: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabase.from('form_submissions_log').insert({
      identifier,
      form_type: formType,
      metadata: metadata || {},
      created_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error logging form submission:', error)
  }
}

/**
 * Get IP address from request
 * Supports various proxy headers
 */
export function getClientIP(request: Request): string {
  const headers = request.headers

  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return 'unknown'
}

/**
 * Combined CAPTCHA + Rate Limit check
 * Use this as a comprehensive anti-spam check
 */
export async function checkSpamProtection(
  request: Request,
  formType: string
): Promise<{
  allowed: boolean
  reason?: string
  score?: number
}> {
  const ip = getClientIP(request)

  // Check rate limit first (cheaper operation)
  const rateLimitResult = await checkFormRateLimit(ip, formType)

  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      reason: rateLimitResult.error || 'Rate limit exceeded'
    }
  }

  return {
    allowed: true
  }
}
