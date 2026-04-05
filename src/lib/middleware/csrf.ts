import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// CSRF Token Management
const CSRF_TOKEN_HEADER = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Get or create CSRF token for the current session
 */
export async function getCsrfToken(request: NextRequest): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('No active session')
  }

  // For now, store in memory per session
  // In production, store in Redis with session ID as key
  const token = generateCsrfToken()

  // TODO: Store in Redis
  // await redis.set(`csrf:${session.user.id}`, token, 'EX', 3600)

  return token
}

/**
 * Validate CSRF token from request
 */
export async function validateCsrfToken(request: NextRequest): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return false
  }

  const tokenFromHeader = request.headers.get(CSRF_TOKEN_HEADER)

  if (!tokenFromHeader) {
    return false
  }

  // TODO: Validate against stored token in Redis
  // const storedToken = await redis.get(`csrf:${session.user.id}`)
  // return storedToken === tokenFromHeader

  // Temporary: Accept any valid format token (for development)
  // In production, MUST validate against stored token
  return tokenFromHeader.length === CSRF_TOKEN_LENGTH * 2 // hex string length
}

/**
 * CSRF Protection Middleware
 * Use this for all state-changing operations (POST, PUT, DELETE)
 */
export async function csrfProtection(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return null
  }

  // Validate CSRF token
  const isValid = await validateCsrfToken(request)

  if (!isValid) {
    return NextResponse.json(
      {
        error: 'CSRF token validation failed',
        message: 'Invalid or missing CSRF token. Please refresh the page and try again.'
      },
      { status: 403 }
    )
  }

  return null // Token is valid, continue
}

/**
 * GET endpoint to retrieve CSRF token for client
 */
export async function getCsrfTokenResponse(): Promise<NextResponse> {
  try {
    const token = generateCsrfToken()

    // TODO: Store in Redis with user session

    return NextResponse.json({
      token,
      expiresIn: 3600 // 1 hour
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}

/**
 * Helper to add CSRF token to response headers
 */
export function addCsrfTokenToResponse(response: NextResponse, token: string): NextResponse {
  response.headers.set(CSRF_TOKEN_HEADER, token)
  return response
}
