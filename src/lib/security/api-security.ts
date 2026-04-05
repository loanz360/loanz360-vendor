/**
 * API Security Middleware
 * Enterprise-grade security for Incentives Module
 *
 * Features:
 * - CSRF Protection
 * - Input Sanitization (XSS Prevention)
 * - Rate Limiting
 * - Request Validation
 * - IP Whitelist/Blacklist
 * - Request Signing for Webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';

// ===================================
// TYPE DEFINITIONS
// ===================================

export interface SecurityConfig {
  enableCSRF?: boolean;
  enableRateLimiting?: boolean;
  enableInputSanitization?: boolean;
  enableRequestSigning?: boolean;
  rateLimitWindow?: number; // in seconds
  rateLimitMax?: number; // max requests per window
}

export interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
}

export interface WebhookSignatureConfig {
  algorithm: string;
  header: string;
  secret: string;
}

// ===================================
// IN-MEMORY STORAGE (Use Redis in production)
// ===================================

const rateLimitStore = new Map<string, RateLimitEntry>();
const csrfTokenStore = new Map<string, { token: string; expiresAt: number }>();
const ipBlacklist = new Set<string>();
const ipWhitelist = new Set<string>();

// ===================================
// CSRF PROTECTION
// ===================================

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 3600000; // 1 hour

  csrfTokenStore.set(sessionId, { token, expiresAt });

  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored) {
    return false;
  }

  // Check if token is expired
  if (Date.now() > stored.expiresAt) {
    csrfTokenStore.delete(sessionId);
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(stored.token),
    Buffer.from(token)
  );
}

/**
 * CSRF Protection Middleware
 */
export async function csrfProtection(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return null;
  }

  const sessionId = request.cookies.get('session-id')?.value;
  const csrfToken = request.headers.get('x-csrf-token');

  if (!sessionId || !csrfToken) {
    return NextResponse.json(
      {
        error: 'CSRF token missing',
        code: 'CSRF_TOKEN_MISSING',
      },
      { status: 403 }
    );
  }

  if (!validateCSRFToken(sessionId, csrfToken)) {
    return NextResponse.json(
      {
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

// ===================================
// INPUT SANITIZATION (XSS Prevention)
// ===================================

/**
 * Sanitize string to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  // Remove any HTML tags and scripts
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeString(value) as T[keyof T];
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object'
          ? sanitizeObject(item)
          : item
      ) as T[keyof T];
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize request body
 */
export async function sanitizeRequestBody(
  request: NextRequest
): Promise<any> {
  try {
    const body = await request.json();
    return sanitizeObject(body);
  } catch (error) {
    return null;
  }
}

// ===================================
// RATE LIMITING
// ===================================

/**
 * Get rate limit key (IP + User ID)
 */
function getRateLimitKey(request: NextRequest, userId?: string): string {
  const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';
  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Check rate limit
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  // Create new entry if doesn't exist or window expired
  if (!entry || now - entry.windowStart > windowMs) {
    entry = {
      count: 0,
      windowStart: now,
      blocked: false,
    };
    rateLimitStore.set(key, entry);
  }

  // Check if blocked
  if (entry.blocked && now - entry.windowStart < windowMs) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    };
  }

  // Increment count
  entry.count++;

  // Block if exceeded
  if (entry.count > maxRequests) {
    entry.blocked = true;
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

/**
 * Rate Limiting Middleware
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  config: { max: number; window: number }
): Promise<NextResponse | null> {
  const key = getRateLimitKey(request);
  const result = checkRateLimit(key, config.max, config.window);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        resetAt: new Date(result.resetAt).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': config.max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toString(),
          'Retry-After': Math.ceil(
            (result.resetAt - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }

  return null; // Rate limit not exceeded
}

// ===================================
// IP FILTERING
// ===================================

/**
 * Add IP to blacklist
 */
export function blockIP(ip: string): void {
  ipBlacklist.add(ip);
}

/**
 * Remove IP from blacklist
 */
export function unblockIP(ip: string): void {
  ipBlacklist.delete(ip);
}

/**
 * Add IP to whitelist
 */
export function whitelistIP(ip: string): void {
  ipWhitelist.add(ip);
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(request: NextRequest): boolean {
  const ip = request.headers.get('x-forwarded-for') || request.ip || '';

  // If whitelist exists and IP is not in it
  if (ipWhitelist.size > 0 && !ipWhitelist.has(ip)) {
    return true;
  }

  // If IP is in blacklist
  if (ipBlacklist.has(ip)) {
    return true;
  }

  return false;
}

/**
 * IP Filtering Middleware
 */
export async function ipFilterMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  if (isIPBlocked(request)) {
    return NextResponse.json(
      {
        error: 'Access denied',
        code: 'IP_BLOCKED',
      },
      { status: 403 }
    );
  }

  return null;
}

// ===================================
// WEBHOOK SIGNATURE VERIFICATION
// ===================================

/**
 * Generate webhook signature
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  algorithm: string = 'sha256'
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256'
): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret, algorithm);

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Webhook Signature Middleware
 */
export async function webhookSignatureMiddleware(
  request: NextRequest,
  config: WebhookSignatureConfig
): Promise<NextResponse | null> {
  const signature = request.headers.get(config.header);

  if (!signature) {
    return NextResponse.json(
      {
        error: 'Webhook signature missing',
        code: 'SIGNATURE_MISSING',
      },
      { status: 401 }
    );
  }

  // Get raw body
  const body = await request.text();

  if (!verifyWebhookSignature(body, signature, config.secret, config.algorithm)) {
    return NextResponse.json(
      {
        error: 'Invalid webhook signature',
        code: 'SIGNATURE_INVALID',
      },
      { status: 401 }
    );
  }

  return null;
}

// ===================================
// REQUEST VALIDATION
// ===================================

/**
 * Validate request headers
 */
export function validateHeaders(
  request: NextRequest,
  requiredHeaders: string[]
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const header of requiredHeaders) {
    if (!request.headers.get(header)) {
      missing.push(header);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate content type
 */
export function validateContentType(
  request: NextRequest,
  allowedTypes: string[]
): boolean {
  const contentType = request.headers.get('content-type');

  if (!contentType) {
    return false;
  }

  return allowedTypes.some((type) => contentType.includes(type));
}

// ===================================
// COMPREHENSIVE SECURITY MIDDLEWARE
// ===================================

export interface SecurityMiddlewareOptions {
  enableCSRF?: boolean;
  enableRateLimit?: boolean;
  enableIPFilter?: boolean;
  enableSanitization?: boolean;
  rateLimitConfig?: { max: number; window: number };
  requiredHeaders?: string[];
  allowedContentTypes?: string[];
  webhookConfig?: WebhookSignatureConfig;
}

/**
 * Comprehensive security middleware
 */
export async function securityMiddleware(
  request: NextRequest,
  options: SecurityMiddlewareOptions = {}
): Promise<{ error: NextResponse | null; sanitizedBody?: any }> {
  const {
    enableCSRF = true,
    enableRateLimit = true,
    enableIPFilter = true,
    enableSanitization = true,
    rateLimitConfig = { max: 100, window: 60 },
    requiredHeaders = [],
    allowedContentTypes = ['application/json'],
    webhookConfig,
  } = options;

  // 1. IP Filtering
  if (enableIPFilter) {
    const ipError = await ipFilterMiddleware(request);
    if (ipError) return { error: ipError };
  }

  // 2. Rate Limiting
  if (enableRateLimit) {
    const rateLimitError = await rateLimitMiddleware(request, rateLimitConfig);
    if (rateLimitError) return { error: rateLimitError };
  }

  // 3. Header Validation
  if (requiredHeaders.length > 0) {
    const headerValidation = validateHeaders(request, requiredHeaders);
    if (!headerValidation.valid) {
      return {
        error: NextResponse.json(
          {
            error: 'Missing required headers',
            code: 'HEADERS_MISSING',
            missing: headerValidation.missing,
          },
          { status: 400 }
        ),
      };
    }
  }

  // 4. Content Type Validation
  if (
    !['GET', 'HEAD', 'DELETE'].includes(request.method) &&
    allowedContentTypes.length > 0
  ) {
    if (!validateContentType(request, allowedContentTypes)) {
      return {
        error: NextResponse.json(
          {
            error: 'Invalid content type',
            code: 'CONTENT_TYPE_INVALID',
            allowed: allowedContentTypes,
          },
          { status: 415 }
        ),
      };
    }
  }

  // 5. Webhook Signature Verification
  if (webhookConfig) {
    const webhookError = await webhookSignatureMiddleware(request, webhookConfig);
    if (webhookError) return { error: webhookError };
  }

  // 6. CSRF Protection
  if (enableCSRF && !webhookConfig) {
    const csrfError = await csrfProtection(request);
    if (csrfError) return { error: csrfError };
  }

  // 7. Input Sanitization
  let sanitizedBody;
  if (enableSanitization && !['GET', 'HEAD', 'DELETE'].includes(request.method)) {
    sanitizedBody = await sanitizeRequestBody(request);
  }

  return { error: null, sanitizedBody };
}

// ===================================
// SECURITY UTILITIES
// ===================================

/**
 * Generate secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data
 */
export function hashData(data: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * Encrypt sensitive data (AES-256-GCM)
 */
export function encryptData(
  data: string,
  key: Buffer,
  iv?: Buffer
): { encrypted: string; iv: string; tag: string } {
  const ivBuffer = iv || crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, ivBuffer);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: ivBuffer.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt sensitive data (AES-256-GCM)
 */
export function decryptData(
  encrypted: string,
  key: Buffer,
  iv: string,
  tag: string
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();

  // Clean CSRF tokens
  for (const [sessionId, entry] of csrfTokenStore.entries()) {
    if (now > entry.expiresAt) {
      csrfTokenStore.delete(sessionId);
    }
  }

  // Clean rate limit entries (older than 1 hour)
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > 3600000) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 15 minutes
if (typeof window === 'undefined') {
  setInterval(cleanupExpiredEntries, 900000);
}

export default securityMiddleware;
