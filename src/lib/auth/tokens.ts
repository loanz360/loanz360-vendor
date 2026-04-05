import { randomBytes, createHash, createHmac, timingSafeEqual } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { authConfig } from '@/lib/config/env'

export interface SessionData {
  userId: string
  email: string
  role: string
  sessionId: string
  issuedAt: number
  expiresAt: number
}

export interface RefreshTokenData {
  sessionId: string
  userId: string
  issuedAt: number
  expiresAt: number
}

// Token configuration
const ACCESS_TOKEN_EXPIRY = 15 * 60 // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 // 7 days

// Convert string secret to Uint8Array for jose
const getSecretKey = (secret: string): Uint8Array => {
  return new TextEncoder().encode(secret)
}

// Generate cryptographically secure random token
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url')
}

// Generate session ID
export function generateSessionId(): string {
  return generateSecureToken(16)
}

// Create secure session token (for super admin authentication)
export async function createSessionToken(data: {
  userId: string
  sessionId: string
  role: string
  expiresAt: Date
  email?: string
}): Promise<{ token: string; tokenHash: string }> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAtSeconds = Math.floor(data.expiresAt.getTime() / 1000)

  const payload = {
    tokenType: 'session',
    userId: data.userId,
    email: data.email,
    role: data.role,
    sessionId: data.sessionId,
    issuedAt,
    expiresAt: expiresAtSeconds
  }

  // Create a secure token using HMAC with sorted keys for consistent serialization
  const sortedKeys = Object.keys(payload).sort()
  const canonicalPayload = sortedKeys.reduce((obj: Record<string, unknown>, key: string) => {
    obj[key] = payload[key as keyof typeof payload]
    return obj
  }, {} as Record<string, unknown>)

  const tokenData = JSON.stringify(canonicalPayload)
  const signature = createHmac('sha256', authConfig.jwtSecret)
    .update(tokenData)
    .digest('base64url')

  const token = Buffer.from(JSON.stringify({
    ...payload,
    signature
  })).toString('base64url')

  // Generate token hash for storage in database
  const tokenHash = createHash('sha256')
    .update(token)
    .digest('hex')

  return { token, tokenHash }
}

// Verify session token with timing-attack protection
export function verifySessionToken(token: string): SessionData | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())

    if (!decoded.signature || decoded.tokenType !== 'session') {
      return null
    }

    // Verify signature with proper timing-safe comparison
    const { signature, ...payload } = decoded

    // Create canonical payload with sorted keys (same as creation)
    const sortedKeys = Object.keys(payload).sort()
    const canonicalPayload = sortedKeys.reduce((obj: Record<string, unknown>, key: string) => {
      obj[key] = payload[key as keyof typeof payload]
      return obj
    }, {} as Record<string, unknown>)

    const expectedSignature = createHmac('sha256', authConfig.jwtSecret)
      .update(JSON.stringify(canonicalPayload))
      .digest('base64url')

    // Convert to fixed-length buffers to prevent length-based timing attacks
    const signatureBuffer = Buffer.alloc(64)
    const expectedBuffer = Buffer.alloc(64)

    // Pad with zeros to ensure equal length
    Buffer.from(signature, 'base64url').copy(signatureBuffer)
    Buffer.from(expectedSignature, 'base64url').copy(expectedBuffer)

    // Timing-safe comparison with guaranteed equal lengths
    if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null
    }

    // Verify the actual signature matches (additional check)
    if (signature !== expectedSignature) {
      return null
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now > payload.expiresAt) {
      return null
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt
    }
  } catch {
    return null
  }
}

// Create JWT access token
export async function createAccessToken(data: {
  userId: string
  email: string
  role: string
  sessionId: string
}): Promise<string> {
  const secret = getSecretKey(authConfig.jwtSecret)
  const issuedAt = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    userId: data.userId,
    email: data.email,
    role: data.role,
    sessionId: data.sessionId,
    tokenType: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_EXPIRY)
    .setSubject(data.userId)
    .sign(secret)
}

// Create JWT refresh token
export async function createRefreshToken(data: {
  userId: string
  sessionId: string
}): Promise<string> {
  const secret = getSecretKey(authConfig.jwtRefreshSecret)
  const issuedAt = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    sessionId: data.sessionId,
    userId: data.userId,
    tokenType: 'refresh'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + REFRESH_TOKEN_EXPIRY)
    .setSubject(data.userId)
    .sign(secret)
}

// Verify JWT access token
export async function verifyAccessToken(token: string): Promise<SessionData | null> {
  try {
    const secret = getSecretKey(authConfig.jwtSecret)
    const { payload } = await jwtVerify(token, secret)

    if (payload.tokenType !== 'access') {
      return null
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      sessionId: payload.sessionId as string,
      issuedAt: payload.iat as number,
      expiresAt: payload.exp as number
    }
  } catch {
    return null
  }
}

// Verify JWT refresh token
export async function verifyRefreshToken(token: string): Promise<RefreshTokenData | null> {
  try {
    const secret = getSecretKey(authConfig.jwtRefreshSecret)
    const { payload } = await jwtVerify(token, secret)

    if (payload.tokenType !== 'refresh') {
      return null
    }

    return {
      sessionId: payload.sessionId as string,
      userId: payload.userId as string,
      issuedAt: payload.iat as number,
      expiresAt: payload.exp as number
    }
  } catch {
    return null
  }
}

// Invalidate session token (for logout)
export async function invalidateSessionToken(): Promise<string> {
  const result = await createSessionToken({
    userId: 'invalidated',
    sessionId: 'invalidated',
    role: 'NONE',
    expiresAt: new Date(0) // Expired date
  })
  return result.token
}

// Check if token is expired
export function isTokenExpired(expiresAt: number): boolean {
  return Math.floor(Date.now() / 1000) > expiresAt
}