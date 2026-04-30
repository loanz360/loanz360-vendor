import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

// Store tokens in memory (in production, use Redis or session storage)
const tokenStore = new Map<string, { token: string; expires: number }>()

// Clean up expired tokens periodically
function cleanupExpiredTokens() {
  const now = Date.now()
  for (const [key, value] of tokenStore.entries()) {
    if (value.expires < now) {
      tokenStore.delete(key)
    }
  }
}

// Generate a secure CSRF token
function generateToken(): string {
  return randomBytes(32).toString('hex')
}

// Create a hash of user ID + token for verification
function createTokenHash(userId: string, token: string): string {
  return createHash('sha256')
    .update(`${userId}:${token}:${process.env.CSRF_SECRET || 'csrf-secret-key'}`)
    .digest('hex')
}

/**
 * GET /api/csrf - Generate a new CSRF token for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Clean up old tokens
    cleanupExpiredTokens()

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Generate new token
    const token = generateToken()
    const tokenHash = createTokenHash(user.id, token)

    // Store token with 1 hour expiry
    const expires = Date.now() + (60 * 60 * 1000) // 1 hour
    tokenStore.set(user.id, { token: tokenHash, expires })

    // Return the raw token (not the hash) to the client
    return NextResponse.json({
      token,
      expiresAt: new Date(expires).toISOString()
    })
  } catch (error) {
    apiLogger.error('CSRF token generation error', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/csrf/verify - Verify a CSRF token
 * This is used internally by other API routes
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      token: z.string(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token required' },
        { status: 400 }
      )
    }

    // Get stored token for user
    const storedData = tokenStore.get(user.id)

    if (!storedData) {
      return NextResponse.json(
        { valid: false, error: 'No token found for user' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (storedData.expires < Date.now()) {
      tokenStore.delete(user.id)
      return NextResponse.json(
        { valid: false, error: 'Token expired' },
        { status: 400 }
      )
    }

    // Verify token hash
    const tokenHash = createTokenHash(user.id, token)
    const isValid = tokenHash === storedData.token

    return NextResponse.json({ valid: isValid })
  } catch (error) {
    apiLogger.error('CSRF token verification error', error)
    return NextResponse.json(
      { valid: false, error: 'Verification failed' },
      { status: 500 }
    )
  }
}
