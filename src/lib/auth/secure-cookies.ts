/**
 * Secure Cookie Management for LOANZ 360
 * Provides HTTP-Only cookie support via server-side operations
 */

import type { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  maxAge?: number
  path?: string
  domain?: string
}

/**
 * Determine if we're in a production environment
 * Uses multiple checks to prevent misconfiguration
 */
const isProduction = (): boolean => {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    process.env.FORCE_SECURE_COOKIES === 'true'
  )
}

const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction(), // SECURITY: Always enforce HTTPS in production
  sameSite: 'strict',
  path: '/',
}

/**
 * Set HTTP-Only cookie from server-side
 */
export async function setSecureCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): Promise<void> {
  const cookieStore = await cookies()
  const mergedOptions = { ...DEFAULT_COOKIE_OPTIONS, ...options }

  cookieStore.set(name, value, {
    httpOnly: mergedOptions.httpOnly,
    secure: mergedOptions.secure,
    sameSite: mergedOptions.sameSite,
    maxAge: mergedOptions.maxAge,
    path: mergedOptions.path,
  })
}

/**
 * Get cookie value from server-side
 */
export async function getSecureCookie(name: string): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(name)
  return cookie?.value || null
}

/**
 * Delete cookie from server-side
 */
export async function deleteSecureCookie(name: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(name)
}

/**
 * Set multiple cookies at once
 */
export async function setMultipleSecureCookies(
  cookies: Array<{ name: string; value: string; options?: CookieOptions }>
): Promise<void> {
  for (const cookie of cookies) {
    await setSecureCookie(cookie.name, cookie.value, cookie.options)
  }
}

/**
 * Set authentication cookies (session + CSRF)
 */
export async function setAuthCookies(
  sessionToken: string,
  csrfToken: string,
  options?: {
    sessionMaxAge?: number
    csrfMaxAge?: number
  }
): Promise<void> {
  const sessionMaxAge = options?.sessionMaxAge || 24 * 60 * 60 // 24 hours
  const csrfMaxAge = options?.csrfMaxAge || 60 * 60 // 1 hour

  await setMultipleSecureCookies([
    {
      name: 'auth-token',
      value: sessionToken,
      options: {
        httpOnly: true,
        secure: isProduction(), // SECURITY: Always enforce HTTPS in production
        sameSite: 'strict',
        maxAge: sessionMaxAge,
        path: '/',
      },
    },
    {
      name: 'csrf-token',
      value: csrfToken,
      options: {
        httpOnly: true,
        secure: isProduction(), // SECURITY: Always enforce HTTPS in production
        sameSite: 'strict',
        maxAge: csrfMaxAge,
        path: '/',
      },
    },
  ])
}

/**
 * Clear all authentication cookies
 */
export async function clearAuthCookies(): Promise<void> {
  await deleteSecureCookie('auth-token')
  await deleteSecureCookie('csrf-token')
  await deleteSecureCookie('refresh-token')
}

/**
 * Set cookie in NextResponse (for API routes)
 */
export function setResponseCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: CookieOptions = {}
): NextResponse {
  const mergedOptions = { ...DEFAULT_COOKIE_OPTIONS, ...options }

  response.cookies.set(name, value, {
    httpOnly: mergedOptions.httpOnly,
    secure: mergedOptions.secure,
    sameSite: mergedOptions.sameSite,
    maxAge: mergedOptions.maxAge,
    path: mergedOptions.path,
  })

  return response
}

/**
 * Set authentication cookies in response
 */
export function setAuthCookiesInResponse(
  response: NextResponse,
  sessionToken: string,
  csrfToken: string,
  options?: {
    sessionMaxAge?: number
    csrfMaxAge?: number
  }
): NextResponse {
  const sessionMaxAge = options?.sessionMaxAge || 24 * 60 * 60 // 24 hours
  const csrfMaxAge = options?.csrfMaxAge || 60 * 60 // 1 hour

  setResponseCookie(response, 'auth-token', sessionToken, {
    httpOnly: true,
    secure: isProduction(), // SECURITY: Always enforce HTTPS in production
    sameSite: 'strict',
    maxAge: sessionMaxAge,
    path: '/',
  })

  setResponseCookie(response, 'csrf-token', csrfToken, {
    httpOnly: true,
    secure: isProduction(), // SECURITY: Always enforce HTTPS in production
    sameSite: 'strict',
    maxAge: csrfMaxAge,
    path: '/',
  })

  return response
}

/**
 * Clear authentication cookies in response
 */
export function clearAuthCookiesInResponse(response: NextResponse): NextResponse {
  // Set expired cookies to clear them
  response.cookies.set('auth-token', '', { maxAge: 0, path: '/' })
  response.cookies.set('csrf-token', '', { maxAge: 0, path: '/' })
  response.cookies.set('refresh-token', '', { maxAge: 0, path: '/' })

  return response
}

/**
 * Validate cookie security settings
 */
export function validateCookieSecurity(
  cookieOptions: CookieOptions
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check HTTP-Only
  if (!cookieOptions.httpOnly) {
    errors.push('Cookie should be HTTP-Only for security')
  }

  // Check Secure flag in production
  if (isProduction() && !cookieOptions.secure) {
    errors.push('Cookie must use Secure flag in production')
  }

  // Check SameSite
  if (!cookieOptions.sameSite || cookieOptions.sameSite === 'none') {
    errors.push('Cookie should use SameSite=strict or lax')
  }

  // Check maxAge
  if (cookieOptions.maxAge && cookieOptions.maxAge > 7 * 24 * 60 * 60) {
    errors.push('Cookie maxAge should not exceed 7 days for security')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Cookie security configuration
 */
export const COOKIE_NAMES = {
  SESSION: 'auth-token',
  CSRF: 'csrf-token',
  REFRESH: 'refresh-token',
} as const

export const COOKIE_MAX_AGE = {
  SESSION: 24 * 60 * 60, // 24 hours
  CSRF: 60 * 60, // 1 hour
  REFRESH: 7 * 24 * 60 * 60, // 7 days
} as const

/**
 * Check if cookies are properly configured
 */
export async function checkCookieConfiguration(): Promise<{
  configured: boolean
  issues: string[]
}> {
  const issues: string[] = []

  // Check if running in secure context
  if (process.env.NODE_ENV === 'production') {
    const protocol = process.env.NEXT_PUBLIC_URL?.startsWith('https://')
    if (!protocol) {
      issues.push('Production environment must use HTTPS for secure cookies')
    }
  }

  // Check environment variables
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET must be at least 32 characters')
  }

  return {
    configured: issues.length === 0,
    issues,
  }
}