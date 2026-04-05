/**
 * Security Event Logger
 * Fortune 500 Enterprise Standard
 *
 * SECURITY: Centralized security event logging for SIEM integration
 *
 * Features:
 * - Structured security event logging
 * - Real-time alerting for critical events
 * - SIEM-compatible format
 * - PII redaction
 * - Audit trail compliance
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'

// Security event types
export type SecurityEventType =
  // Authentication events
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_LOGOUT'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_TOKEN_REFRESHED'
  | 'AUTH_PASSWORD_CHANGED'
  | 'AUTH_PASSWORD_RESET_REQUESTED'
  | 'AUTH_PASSWORD_RESET_COMPLETED'
  | 'AUTH_2FA_ENABLED'
  | 'AUTH_2FA_DISABLED'
  | 'AUTH_2FA_VERIFIED'
  | 'AUTH_2FA_FAILED'

  // Customer-specific auth events
  | 'CUSTOMER_LOGIN_SUCCESS'
  | 'CUSTOMER_LOGIN_INVALID_MOBILE'
  | 'CUSTOMER_LOGIN_INVALID_PASSWORD'
  | 'CUSTOMER_LOGIN_ACCOUNT_LOCKED'
  | 'CUSTOMER_LOGIN_ACCOUNT_DEACTIVATED'
  | 'CUSTOMER_LOGIN_RATE_LIMIT_EXCEEDED'
  | 'CUSTOMER_LOGIN_CSRF_FAILED'
  | 'CUSTOMER_LOGIN_ERROR'
  | 'CUSTOMER_REGISTER_SUCCESS'
  | 'CUSTOMER_REGISTER_FAILED'

  // Access control events
  | 'ACCESS_DENIED'
  | 'ACCESS_GRANTED'
  | 'PERMISSION_ESCALATION_ATTEMPT'
  | 'UNAUTHORIZED_RESOURCE_ACCESS'

  // Rate limiting events
  | 'RATE_LIMIT_EXCEEDED'
  | 'IP_BLOCKED'
  | 'IP_UNBLOCKED'

  // Security threats
  | 'BRUTE_FORCE_DETECTED'
  | 'CSRF_ATTACK_DETECTED'
  | 'XSS_ATTEMPT_DETECTED'
  | 'SQL_INJECTION_DETECTED'
  | 'PATH_TRAVERSAL_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'MALICIOUS_FILE_UPLOAD'

  // Data events
  | 'SENSITIVE_DATA_ACCESS'
  | 'SENSITIVE_DATA_MODIFIED'
  | 'SENSITIVE_DATA_EXPORTED'
  | 'PII_ACCESS'

  // System events
  | 'CONFIG_CHANGED'
  | 'SECURITY_SETTINGS_MODIFIED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'

  // Compliance events
  | 'CONSENT_GIVEN'
  | 'CONSENT_WITHDRAWN'
  | 'DATA_DELETION_REQUESTED'
  | 'DATA_DELETION_COMPLETED'

// Severity levels
export type SecuritySeverity = 'info' | 'warning' | 'error' | 'critical'

// Security event interface
export interface SecurityEvent {
  event: SecurityEventType
  severity: SecuritySeverity
  ip?: string
  userAgent?: string
  userId?: string
  requestId?: string
  sessionId?: string
  endpoint?: string
  metadata?: Record<string, unknown>
}

// Log entry interface
interface SecurityLogEntry extends SecurityEvent {
  id: string
  timestamp: string
  source: string
  environment: string
}

// Alert thresholds
const ALERT_THRESHOLDS: Record<string, { count: number; windowMs: number }> = {
  AUTH_LOGIN_FAILED: { count: 5, windowMs: 300000 }, // 5 failures in 5 minutes
  BRUTE_FORCE_DETECTED: { count: 1, windowMs: 0 }, // Immediate alert
  PERMISSION_ESCALATION_ATTEMPT: { count: 1, windowMs: 0 },
  SQL_INJECTION_DETECTED: { count: 1, windowMs: 0 },
}

/**
 * Log a security event
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const logEntry: SecurityLogEntry = {
      id: crypto.randomUUID(),
      ...event,
      timestamp: new Date().toISOString(),
      source: 'loanz360-api',
      environment: process.env.NODE_ENV || 'development',
      metadata: redactPII(event.metadata),
    }

    // Log to database
    await logToDatabase(logEntry)

    // Log to console in structured format
    logToConsole(logEntry)

    // Check if alert should be triggered
    await checkAlertThreshold(logEntry)

  } catch (error) {
    // Fallback to console logging if database fails
    console.error('Failed to log security event:', error)
    console.error('Original event:', JSON.stringify(event))
  }
}

/**
 * Log to database
 */
async function logToDatabase(entry: SecurityLogEntry): Promise<void> {
  const supabase = createSupabaseAdmin()

  await supabase
    .from('security_logs')
    .insert({
      id: entry.id,
      event_type: entry.event,
      severity: entry.severity,
      ip_address: entry.ip,
      user_agent: entry.userAgent?.slice(0, 500),
      user_id: entry.userId,
      request_id: entry.requestId,
      session_id: entry.sessionId,
      endpoint: entry.endpoint,
      metadata: entry.metadata,
      source: entry.source,
      environment: entry.environment,
      created_at: entry.timestamp,
    })
    .catch(() => {
      // Silently fail - don't break the application
    })
}

/**
 * Log to console in structured format
 */
function logToConsole(entry: SecurityLogEntry): void {
  const logLevel = getConsoleLogLevel(entry.severity)
  const message = formatLogMessage(entry)

  console[logLevel](message)
}

/**
 * Get console log level
 */
function getConsoleLogLevel(
  severity: SecuritySeverity
): 'log' | 'warn' | 'error' {
  switch (severity) {
    case 'info':
      return 'log'
    case 'warning':
      return 'warn'
    case 'error':
    case 'critical':
      return 'error'
    default:
      return 'log'
  }
}

/**
 * Format log message for console
 */
function formatLogMessage(entry: SecurityLogEntry): string {
  return JSON.stringify({
    level: entry.severity.toUpperCase(),
    time: entry.timestamp,
    event: entry.event,
    ip: entry.ip,
    userId: entry.userId,
    requestId: entry.requestId,
    ...entry.metadata,
  })
}

/**
 * Redact PII from metadata
 */
function redactPII(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined

  const piiFields = [
    'email', 'phone', 'mobile', 'password', 'ssn', 'aadhaar', 'pan',
    'credit_card', 'bank_account', 'address', 'dob', 'date_of_birth'
  ]

  const redacted: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase()

    if (piiFields.some(field => lowerKey.includes(field))) {
      redacted[key] = '[REDACTED]'
    } else if (typeof value === 'string' && value.length > 4) {
      // Mask potential PII in values
      if (isEmail(value)) {
        redacted[key] = maskEmail(value)
      } else if (isPhone(value)) {
        redacted[key] = maskPhone(value)
      } else {
        redacted[key] = value
      }
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPII(value as Record<string, unknown>)
    } else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Check if value looks like an email
 */
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Check if value looks like a phone number
 */
function isPhone(value: string): boolean {
  return /^\+?[\d\s-]{10,15}$/.test(value)
}

/**
 * Mask email address
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***.***'
  const maskedLocal = local[0] + '***' + (local.length > 1 ? local[local.length - 1] : '')
  return `${maskedLocal}@${domain}`
}

/**
 * Mask phone number
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return '****' + digits.slice(-4)
}

/**
 * Check alert threshold and trigger alert if needed
 */
async function checkAlertThreshold(entry: SecurityLogEntry): Promise<void> {
  const threshold = ALERT_THRESHOLDS[entry.event]
  if (!threshold) return

  // For immediate alerts
  if (threshold.count === 1 && threshold.windowMs === 0) {
    await triggerSecurityAlert(entry)
    return
  }

  // Check count in window
  const supabase = createSupabaseAdmin()
  const windowStart = new Date(Date.now() - threshold.windowMs)

  const { count } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', entry.event)
    .eq('ip_address', entry.ip)
    .gte('created_at', windowStart.toISOString())

  if (count && count >= threshold.count) {
    await triggerSecurityAlert(entry, count)
  }
}

/**
 * Trigger a security alert
 */
async function triggerSecurityAlert(
  entry: SecurityLogEntry,
  count?: number
): Promise<void> {
  const alert = {
    type: 'SECURITY_ALERT',
    event: entry.event,
    severity: entry.severity,
    ip: entry.ip,
    userId: entry.userId,
    count,
    timestamp: new Date().toISOString(),
    message: `Security alert: ${entry.event} from IP ${entry.ip}`,
  }

  // Log alert
  console.error('🚨 SECURITY ALERT:', JSON.stringify(alert))

  // Store alert in database
  const supabase = createSupabaseAdmin()
  await supabase
    .from('security_alerts')
    .insert({
      id: crypto.randomUUID(),
      event_type: entry.event,
      severity: entry.severity,
      ip_address: entry.ip,
      user_id: entry.userId,
      occurrence_count: count,
      metadata: entry.metadata,
      status: 'open',
      created_at: alert.timestamp,
    })
    .catch(() => { /* Logging failure should not break main flow */ })

  // In production, you would also:
  // 1. Send to PagerDuty/Opsgenie
  // 2. Send to Slack/Teams
  // 3. Send email to security team
  // 4. Trigger automated response (block IP, etc.)
}

/**
 * Get security events for a user
 */
export async function getUserSecurityEvents(
  userId: string,
  limit: number = 100
): Promise<SecurityLogEntry[]> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('security_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    event: row.event_type,
    severity: row.severity,
    ip: row.ip_address,
    userAgent: row.user_agent,
    userId: row.user_id,
    requestId: row.request_id,
    sessionId: row.session_id,
    endpoint: row.endpoint,
    metadata: row.metadata,
    timestamp: row.created_at,
    source: row.source,
    environment: row.environment,
  }))
}

/**
 * Get security events for an IP
 */
export async function getIPSecurityEvents(
  ip: string,
  limit: number = 100
): Promise<SecurityLogEntry[]> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase
    .from('security_logs')
    .select('*')
    .eq('ip_address', ip)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(row => ({
    id: row.id,
    event: row.event_type,
    severity: row.severity,
    ip: row.ip_address,
    userAgent: row.user_agent,
    userId: row.user_id,
    requestId: row.request_id,
    sessionId: row.session_id,
    endpoint: row.endpoint,
    metadata: row.metadata,
    timestamp: row.created_at,
    source: row.source,
    environment: row.environment,
  }))
}

/**
 * Check if IP has suspicious activity
 */
export async function hasIPSuspiciousActivity(
  ip: string,
  windowMs: number = 3600000 // 1 hour
): Promise<boolean> {
  const supabase = createSupabaseAdmin()
  const windowStart = new Date(Date.now() - windowMs)

  const suspiciousEvents: SecurityEventType[] = [
    'BRUTE_FORCE_DETECTED',
    'SQL_INJECTION_DETECTED',
    'XSS_ATTEMPT_DETECTED',
    'PATH_TRAVERSAL_DETECTED',
    'PERMISSION_ESCALATION_ATTEMPT',
  ]

  const { count } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .in('event_type', suspiciousEvents)
    .gte('created_at', windowStart.toISOString())

  return (count || 0) > 0
}
