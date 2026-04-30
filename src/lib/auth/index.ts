/**
 * LOANZ 360 — Unified Auth Barrel Export
 * 
 * Consolidates all auth modules into a single import point.
 * 
 * Usage:
 *   import { checkRateLimit, verifyRole, validateSession } from '@/lib/auth'
 * 
 * Module Groups:
 *   1. Core Auth: context, hooks, check-auth, unified-auth
 *   2. Session: config, manager, storage, timeout, validation
 *   3. Role Verification: cpe, dse, employee, hr, rbac
 *   4. Security: CSRF, CORS, rate limiting, tokens
 *   5. 2FA: TOTP, two-factor setup
 *   6. Super Admin: context, helpers, service
 */

// ─── Core Auth ───────────────────────────────────────────────
export { checkAuth, requireAuth } from './check-auth'
export { UnifiedAuthProvider } from './unified-auth'

// ─── Session Management ──────────────────────────────────────
export type { SessionConfig } from './session-config'
export { getSessionConfig, SESSION_DEFAULTS } from './session-config'
export { validateSession, refreshSession } from './session-validation'
export { SessionManager } from './session-manager'

// ─── Role Verification ──────────────────────────────────────
export { verifyCPERole } from './cpe-auth'
export { verifyDSERole } from './dse-auth'
export { verifyEmployeeRole } from './verify-employee'
export { checkPermission, hasPermission } from './permission-checker'
export { checkServerRBAC } from './server-rbac'

// ─── Security Middleware ────────────────────────────────────
export { validateCSRFToken } from './csrf-protection'
export { corsProtection } from './cors-protection'
export { checkRateLimit } from './database-rate-limiter'

// ─── Token Management ───────────────────────────────────────
export { generateToken, verifyToken } from './tokens'
export { blacklistToken, isTokenBlacklisted } from './token-blacklist'

// ─── Password ───────────────────────────────────────────────
export { checkPasswordHistory, addToPasswordHistory } from './password-history'

// ─── 2FA ────────────────────────────────────────────────────
export { generateTOTP, verifyTOTP } from './totp'

// ─── Logging ────────────────────────────────────────────────
export { secureLog } from './secure-logger'
