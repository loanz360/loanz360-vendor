/**
 * Secure Session Management
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Enterprise-grade session management
 *
 * Features:
 * - Secure session token generation
 * - Session binding (IP, fingerprint, device)
 * - Automatic session invalidation
 * - Concurrent session control
 * - Session activity tracking
 * - Secure logout with session cleanup
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'

// Session configuration
const SESSION_COOKIE_NAME = 'session_id'
const SESSION_TOKEN_LENGTH = 32
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CONCURRENT_SESSIONS = 5

// Session data structure
export interface SecureSession {
  id: string
  userId: string
  tokenHash: string
  ipAddress: string
  userAgent: string
  fingerprint: string
  deviceId?: string
  createdAt: Date
  lastActivityAt: Date
  expiresAt: Date
  isActive: boolean
  metadata?: Record<string, unknown>
}

// Session validation result
export interface SessionValidationResult {
  valid: boolean
  session?: SecureSession
  error?: string
  requiresReauth?: boolean
}

/**
 * Generate cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_LENGTH).toString('base64url')
}

/**
 * Hash session token for storage
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Generate device fingerprint from request
 */
export function generateFingerprint(request: NextRequest): string {
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('sec-ch-ua') || '',
    request.headers.get('sec-ch-ua-platform') || '',
    request.headers.get('sec-ch-ua-mobile') || '',
  ]

  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 32)
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.ip ||
    'unknown'
  )
}

/**
 * Create a new secure session
 */
export async function createSession(
  userId: string,
  request: NextRequest,
  metadata?: Record<string, unknown>
): Promise<{ token: string; session: SecureSession }> {
  const supabase = createSupabaseAdmin()

  // Generate session token
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)

  // Get request info
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const fingerprint = generateFingerprint(request)

  // Create session
  const now = new Date()
  const session: Omit<SecureSession, 'id'> = {
    userId,
    tokenHash,
    ipAddress,
    userAgent,
    fingerprint,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_MS),
    isActive: true,
    metadata,
  }

  // Check concurrent sessions
  await enforceSessionLimit(userId)

  // Store session
  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: session.userId,
      token_hash: session.tokenHash,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
      fingerprint: session.fingerprint,
      created_at: session.createdAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString(),
      expires_at: session.expiresAt.toISOString(),
      is_active: session.isActive,
      metadata: session.metadata,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`)
  }

  return {
    token,
    session: { ...session, id: data.id } as SecureSession,
  }
}

/**
 * Validate session token
 */
export async function validateSession(
  request: NextRequest
): Promise<SessionValidationResult> {
  try {
    // Get session token from cookie
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return { valid: false, error: 'No session token' }
    }

    const tokenHash = hashSessionToken(token)
    const supabase = createSupabaseAdmin()

    // Get session from database
    const { data: session, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !session) {
      return { valid: false, error: 'Session not found' }
    }

    const now = new Date()

    // Check expiration
    if (new Date(session.expires_at) < now) {
      await invalidateSession(session.id)
      return { valid: false, error: 'Session expired', requiresReauth: true }
    }

    // Check idle timeout
    const lastActivity = new Date(session.last_activity_at)
    if (now.getTime() - lastActivity.getTime() > SESSION_IDLE_TIMEOUT_MS) {
      await invalidateSession(session.id)
      return { valid: false, error: 'Session idle timeout', requiresReauth: true }
    }

    // Validate fingerprint (detect session hijacking)
    const currentFingerprint = generateFingerprint(request)
    if (session.fingerprint !== currentFingerprint) {
      // Fingerprint mismatch - possible session hijacking
      await invalidateSession(session.id)

      // Log security event
      console.warn('[Session] Fingerprint mismatch detected', {
        sessionId: session.id,
        expected: session.fingerprint,
        received: currentFingerprint,
      })

      return {
        valid: false,
        error: 'Session binding validation failed',
        requiresReauth: true,
      }
    }

    // Optional: Validate IP (more strict)
    const currentIP = getClientIP(request)
    if (session.ip_address !== currentIP) {
      // Log but don't invalidate (IPs can change)
      console.info('[Session] IP address changed', {
        sessionId: session.id,
        originalIP: session.ip_address,
        currentIP,
      })
    }

    // Update last activity
    await supabase
      .from('user_sessions')
      .update({ last_activity_at: now.toISOString() })
      .eq('id', session.id)

    return {
      valid: true,
      session: {
        id: session.id,
        userId: session.user_id,
        tokenHash: session.token_hash,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        fingerprint: session.fingerprint,
        deviceId: session.device_id,
        createdAt: new Date(session.created_at),
        lastActivityAt: new Date(session.last_activity_at),
        expiresAt: new Date(session.expires_at),
        isActive: session.is_active,
        metadata: session.metadata,
      },
    }
  } catch (error) {
    console.error('[Session] Validation error:', error)
    return { valid: false, error: 'Session validation failed' }
  }
}

/**
 * Invalidate a session
 */
export async function invalidateSession(sessionId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()

    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        invalidated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    return !error
  } catch (error) {
    console.error('[Session] Invalidation error:', error)
    return false
  }
}

/**
 * Invalidate all sessions for a user
 */
export async function invalidateAllUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  try {
    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('user_sessions')
      .update({
        is_active: false,
        invalidated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_active', true)

    if (exceptSessionId) {
      query = query.neq('id', exceptSessionId)
    }

    const { data, error } = await query.select('id')

    if (error) {
      console.error('[Session] Bulk invalidation error:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('[Session] Bulk invalidation error:', error)
    return 0
  }
}

/**
 * Enforce session limit per user
 */
async function enforceSessionLimit(userId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdmin()

    // Get active sessions for user
    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error || !sessions) return

    // If over limit, invalidate oldest sessions
    if (sessions.length >= MAX_CONCURRENT_SESSIONS) {
      const sessionsToInvalidate = sessions.slice(MAX_CONCURRENT_SESSIONS - 1)

      for (const session of sessionsToInvalidate) {
        await invalidateSession(session.id)
      }
    }
  } catch (error) {
    console.error('[Session] Limit enforcement error:', error)
  }
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SecureSession[]> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_activity_at', { ascending: false })

    if (error || !data) return []

    return data.map((s) => ({
      id: s.id,
      userId: s.user_id,
      tokenHash: s.token_hash,
      ipAddress: s.ip_address,
      userAgent: s.user_agent,
      fingerprint: s.fingerprint,
      deviceId: s.device_id,
      createdAt: new Date(s.created_at),
      lastActivityAt: new Date(s.last_activity_at),
      expiresAt: new Date(s.expires_at),
      isActive: s.is_active,
      metadata: s.metadata,
    }))
  } catch (error) {
    console.error('[Session] Get sessions error:', error)
    return []
  }
}

/**
 * Set session cookie on response
 */
export function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_MS / 1000
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAgeSeconds,
    path: '/',
  })
}

/**
 * Clear session cookie on response
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  })
}

/**
 * Secure logout - invalidates session and clears cookie
 */
export async function secureLogout(
  request: NextRequest,
  response: NextResponse
): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    const tokenHash = hashSessionToken(token)
    const supabase = createSupabaseAdmin()

    // Find and invalidate session
    const { data } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (data) {
      await invalidateSession(data.id)
    }
  }

  // Clear cookie
  clearSessionCookie(response)
}

/**
 * Refresh session (extend expiration)
 */
export async function refreshSession(sessionId: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin()
    const now = new Date()

    const { error } = await supabase
      .from('user_sessions')
      .update({
        last_activity_at: now.toISOString(),
        expires_at: new Date(now.getTime() + SESSION_MAX_AGE_MS).toISOString(),
      })
      .eq('id', sessionId)
      .eq('is_active', true)

    return !error
  } catch (error) {
    console.error('[Session] Refresh error:', error)
    return false
  }
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const supabase = createSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        invalidated_at: new Date().toISOString(),
      })
      .lt('expires_at', new Date().toISOString())
      .eq('is_active', true)
      .select('id')

    if (error) {
      console.error('[Session] Cleanup error:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.error('[Session] Cleanup error:', error)
    return 0
  }
}
