/**
 * Enhanced Activity Logger
 * Enterprise-grade activity logging for real-time feed
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import {
  EventCategory,
  SeverityLevel,
  ActorType,
  SourceType,
  RealtimeActivity
} from './types'

// =====================================================
// INTERFACES
// =====================================================

export interface LogActivityParams {
  // Required
  event_category: EventCategory
  event_type: string
  title: string

  // Optional classification
  event_subtype?: string
  severity_level?: SeverityLevel
  status?: 'active' | 'acknowledged' | 'resolved'

  // Actor (auto-populated if not provided)
  actor_id?: string
  actor_type?: ActorType
  actor_name?: string
  actor_email?: string
  actor_role?: string
  actor_department?: string

  // Entity being acted upon
  entity_type?: string
  entity_id?: string
  entity_name?: string

  // Source information
  module?: string
  source?: SourceType
  source_service?: string

  // Content
  description?: string
  changes_before?: Record<string, unknown>
  changes_after?: Record<string, unknown>
  changed_fields?: string[]

  // Technical context
  request_id?: string
  session_id?: string
  correlation_id?: string

  // Network (auto-extracted from request)
  ip_address?: string
  user_agent?: string
  device_type?: string

  // Geolocation
  country?: string
  region?: string
  city?: string
  timezone?: string

  // Security flags
  is_suspicious?: boolean
  is_security_event?: boolean
  threat_level?: number
  security_tags?: string[]

  // Performance
  response_time_ms?: number
  error_code?: string
  error_message?: string
  stack_trace?: string

  // Metadata
  metadata?: Record<string, unknown>
  tags?: string[]
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp

  return undefined
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function detectDeviceType(userAgent?: string): string {
  if (!userAgent) return 'unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
  if (ua.includes('postman') || ua.includes('curl') || ua.includes('api')) return 'api_client'
  return 'desktop'
}

function detectBrowser(userAgent?: string): string {
  if (!userAgent) return 'unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('chrome')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari')) return 'Safari'
  if (ua.includes('edge')) return 'Edge'
  if (ua.includes('opera')) return 'Opera'
  return 'Other'
}

function detectOS(userAgent?: string): string {
  if (!userAgent) return 'unknown'
  const ua = userAgent.toLowerCase()
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac')) return 'macOS'
  if (ua.includes('linux')) return 'Linux'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS'
  return 'Other'
}

function determineSeverityFromEvent(eventType: string, category: EventCategory): SeverityLevel {
  // Critical events
  const criticalPatterns = [
    'unauthorized', 'brute_force', 'injection', 'xss', 'csrf',
    'data_breach', 'privilege_escalation', 'malware', 'vulnerability'
  ]
  if (criticalPatterns.some(p => eventType.includes(p))) return 'critical'

  // Error events
  const errorPatterns = [
    'error', 'failed', 'failure', 'blocked', 'rejected', 'timeout'
  ]
  if (errorPatterns.some(p => eventType.includes(p))) return 'error'

  // Warning events
  const warningPatterns = [
    'suspicious', 'anomaly', 'warning', 'limit', 'expired', 'slow'
  ]
  if (warningPatterns.some(p => eventType.includes(p))) return 'warning'

  // Security category defaults to warning
  if (category === 'security') return 'warning'

  // Technical errors
  if (category === 'technical' && eventType.includes('error')) return 'error'

  return 'info'
}

// =====================================================
// MAIN LOGGING FUNCTION
// =====================================================

export async function logRealtimeActivity(
  params: LogActivityParams,
  request?: NextRequest
): Promise<string | null> {
  try {
    const supabase = createSupabaseAdmin()

    // Extract request context
    const userAgent = params.user_agent || request?.headers.get('user-agent') || undefined
    const ipAddress = params.ip_address || (request ? getClientIp(request) : undefined)
    const requestId = params.request_id || request?.headers.get('x-request-id') || generateRequestId()

    // Determine severity if not provided
    const severityLevel = params.severity_level ||
      determineSeverityFromEvent(params.event_type, params.event_category)

    // Detect device info
    const deviceType = params.device_type || detectDeviceType(userAgent)
    const browser = detectBrowser(userAgent)
    const os = detectOS(userAgent)

    // Determine if security event
    const isSecurityEvent = params.is_security_event ??
      (params.event_category === 'security' ||
        ['unauthorized', 'brute_force', 'suspicious', 'blocked', 'injection'].some(
          p => params.event_type.includes(p)
        ))

    // Build the insert data
    const activityData = {
      event_category: params.event_category,
      event_type: params.event_type,
      event_subtype: params.event_subtype,
      severity_level: severityLevel,
      status: params.status || 'active',

      actor_id: params.actor_id,
      actor_type: params.actor_type || 'system',
      actor_name: params.actor_name,
      actor_email: params.actor_email,
      actor_role: params.actor_role,
      actor_department: params.actor_department,

      entity_type: params.entity_type,
      entity_id: params.entity_id,
      entity_name: params.entity_name,

      module: params.module,
      source: params.source || 'system',
      source_service: params.source_service,

      title: params.title,
      description: params.description,

      changes_before: params.changes_before || {},
      changes_after: params.changes_after || {},
      changed_fields: params.changed_fields,

      request_id: requestId,
      session_id: params.session_id,
      correlation_id: params.correlation_id,

      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: deviceType,
      browser,
      os,

      country: params.country,
      region: params.region,
      city: params.city,
      timezone: params.timezone,

      is_suspicious: params.is_suspicious || false,
      is_security_event: isSecurityEvent,
      threat_level: params.threat_level || 0,
      security_tags: params.security_tags,

      response_time_ms: params.response_time_ms,
      error_code: params.error_code,
      error_message: params.error_message,
      stack_trace: params.stack_trace,

      metadata: params.metadata || {},
      tags: params.tags
    }

    const { data, error } = await supabase
      .from('realtime_activities')
      .insert(activityData)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[RealtimeActivityLogger] Failed to log activity:', error)
      return null
    }

    return data?.id || null
  } catch (error) {
    console.error('[RealtimeActivityLogger] Exception:', error)
    return null
  }
}

// =====================================================
// CONVENIENCE LOGGING FUNCTIONS
// =====================================================

// User Events
export async function logUserLogin(
  actorId: string,
  actorName: string,
  actorEmail: string,
  actorType: ActorType,
  request?: NextRequest,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'user',
    event_type: 'login',
    title: 'User Login',
    description: `${actorName} logged in successfully`,
    actor_id: actorId,
    actor_name: actorName,
    actor_email: actorEmail,
    actor_type: actorType,
    module: 'auth',
    source: 'ui',
    severity_level: 'info',
    metadata
  }, request)
}

export async function logFailedLogin(
  email: string,
  reason: string,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'user',
    event_type: 'failed_login',
    title: 'Failed Login Attempt',
    description: `Login attempt failed for ${email}: ${reason}`,
    actor_email: email,
    actor_type: 'unknown',
    module: 'auth',
    source: 'ui',
    severity_level: 'warning',
    is_suspicious: true,
    metadata: { email, reason }
  }, request)
}

export async function logUserLogout(
  actorId: string,
  actorName: string,
  actorType: ActorType,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'user',
    event_type: 'logout',
    title: 'User Logout',
    description: `${actorName} logged out`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    module: 'auth',
    source: 'ui',
    severity_level: 'info'
  }, request)
}

export async function logPasswordChange(
  actorId: string,
  actorName: string,
  actorType: ActorType,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'user',
    event_type: 'password_change',
    title: 'Password Changed',
    description: `${actorName} changed their password`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    module: 'auth',
    source: 'ui',
    severity_level: 'warning'
  }, request)
}

export async function logRoleChange(
  actorId: string,
  actorName: string,
  targetUserId: string,
  targetUserName: string,
  oldRole: string,
  newRole: string,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'user',
    event_type: 'role_change',
    title: 'User Role Changed',
    description: `${actorName} changed ${targetUserName}'s role from ${oldRole} to ${newRole}`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: 'admin',
    entity_type: 'user',
    entity_id: targetUserId,
    entity_name: targetUserName,
    module: 'admin',
    source: 'ui',
    severity_level: 'warning',
    changes_before: { role: oldRole },
    changes_after: { role: newRole },
    changed_fields: ['role']
  }, request)
}

// Business Events
export async function logDataCreation(
  entityType: string,
  entityId: string,
  entityName: string,
  actorId: string,
  actorName: string,
  actorType: ActorType,
  module: string,
  data?: Record<string, unknown>,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'business',
    event_type: `${entityType}_created`,
    title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Created`,
    description: `${actorName} created ${entityType}: ${entityName}`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    module,
    source: 'ui',
    severity_level: 'info',
    changes_after: data
  }, request)
}

export async function logDataUpdate(
  entityType: string,
  entityId: string,
  entityName: string,
  actorId: string,
  actorName: string,
  actorType: ActorType,
  module: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  request?: NextRequest
): Promise<string | null> {
  // Calculate changed fields
  const changedFields = Object.keys(newData).filter(
    key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
  )

  return logRealtimeActivity({
    event_category: 'business',
    event_type: `${entityType}_updated`,
    title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Updated`,
    description: `${actorName} updated ${entityType}: ${entityName}`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    module,
    source: 'ui',
    severity_level: 'info',
    changes_before: oldData,
    changes_after: newData,
    changed_fields: changedFields
  }, request)
}

export async function logDataDeletion(
  entityType: string,
  entityId: string,
  entityName: string,
  actorId: string,
  actorName: string,
  actorType: ActorType,
  module: string,
  deletedData?: Record<string, unknown>,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'business',
    event_type: `${entityType}_deleted`,
    title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Deleted`,
    description: `${actorName} deleted ${entityType}: ${entityName}`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    module,
    source: 'ui',
    severity_level: 'warning',
    changes_before: deletedData
  }, request)
}

export async function logBulkOperation(
  operation: 'import' | 'export' | 'delete' | 'update',
  entityType: string,
  count: number,
  actorId: string,
  actorName: string,
  actorType: ActorType,
  module: string,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'business',
    event_type: `bulk_${operation}`,
    title: `Bulk ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
    description: `${actorName} performed bulk ${operation} on ${count} ${entityType} records`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    entity_type: entityType,
    module,
    source: 'ui',
    severity_level: operation === 'delete' ? 'warning' : 'info',
    metadata: { count, operation }
  }, request)
}

// Technical Events
export async function logApiError(
  endpoint: string,
  method: string,
  statusCode: number,
  errorMessage: string,
  stackTrace?: string,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'technical',
    event_type: 'api_error',
    title: 'API Error',
    description: `${method} ${endpoint} returned ${statusCode}: ${errorMessage}`,
    entity_type: 'endpoint',
    entity_name: endpoint,
    module: 'api',
    source: 'api',
    severity_level: statusCode >= 500 ? 'error' : 'warning',
    error_code: String(statusCode),
    error_message: errorMessage,
    stack_trace: stackTrace,
    metadata: { method, endpoint, statusCode }
  }, request)
}

export async function logBackgroundJobFailed(
  jobName: string,
  jobId: string,
  errorMessage: string,
  stackTrace?: string
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'technical',
    event_type: 'background_job_failed',
    title: 'Background Job Failed',
    description: `Job "${jobName}" (${jobId}) failed: ${errorMessage}`,
    entity_type: 'job',
    entity_id: jobId,
    entity_name: jobName,
    source: 'background_job',
    severity_level: 'error',
    error_message: errorMessage,
    stack_trace: stackTrace
  })
}

export async function logCronJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  duration?: number,
  errorMessage?: string
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'technical',
    event_type: `cron_job_${status}`,
    title: `Cron Job ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    description: `Scheduled job "${jobName}" ${status}${duration ? ` in ${duration}ms` : ''}`,
    entity_type: 'cron',
    entity_name: jobName,
    source: 'cron',
    severity_level: status === 'failed' ? 'error' : 'info',
    response_time_ms: duration,
    error_message: errorMessage
  })
}

// Security Events
export async function logSecurityEvent(
  eventType: string,
  title: string,
  description: string,
  threatLevel: number,
  actorId?: string,
  actorEmail?: string,
  request?: NextRequest,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: 'security',
    event_type: eventType,
    title,
    description,
    actor_id: actorId,
    actor_email: actorEmail,
    actor_type: actorId ? 'unknown' : 'system',
    module: 'security',
    source: request ? 'api' : 'system',
    severity_level: threatLevel >= 7 ? 'critical' : threatLevel >= 4 ? 'error' : 'warning',
    is_security_event: true,
    is_suspicious: true,
    threat_level: threatLevel,
    metadata
  }, request)
}

export async function logUnauthorizedAccess(
  endpoint: string,
  reason: string,
  request: NextRequest
): Promise<string | null> {
  return logSecurityEvent(
    'unauthorized_access',
    'Unauthorized Access Attempt',
    `Unauthorized access to ${endpoint}: ${reason}`,
    8,
    undefined,
    undefined,
    request,
    { endpoint, reason }
  )
}

export async function logBruteForceAttempt(
  email: string,
  attemptCount: number,
  request: NextRequest
): Promise<string | null> {
  return logSecurityEvent(
    'brute_force_attempt',
    'Brute Force Attack Detected',
    `Multiple failed login attempts (${attemptCount}) for ${email}`,
    9,
    undefined,
    email,
    request,
    { email, attemptCount }
  )
}

export async function logSuspiciousActivity(
  activityType: string,
  description: string,
  actorId?: string,
  actorEmail?: string,
  request?: NextRequest,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return logSecurityEvent(
    'suspicious_activity',
    `Suspicious Activity: ${activityType}`,
    description,
    5,
    actorId,
    actorEmail,
    request,
    metadata
  )
}

export async function logDataAccessAttempt(
  entityType: string,
  entityId: string,
  accessType: 'view' | 'download' | 'export',
  actorId: string,
  actorName: string,
  actorType: ActorType,
  isSensitive: boolean,
  request?: NextRequest
): Promise<string | null> {
  return logRealtimeActivity({
    event_category: isSensitive ? 'security' : 'business',
    event_type: `sensitive_data_${accessType}`,
    title: `Data ${accessType.charAt(0).toUpperCase() + accessType.slice(1)}`,
    description: `${actorName} ${accessType}ed ${entityType} (ID: ${entityId})`,
    actor_id: actorId,
    actor_name: actorName,
    actor_type: actorType,
    entity_type: entityType,
    entity_id: entityId,
    source: 'ui',
    severity_level: isSensitive ? 'warning' : 'info',
    is_security_event: isSensitive,
    metadata: { accessType, isSensitive }
  }, request)
}

// Export all convenience functions
export const ActivityLogger = {
  // Core
  log: logRealtimeActivity,

  // User events
  login: logUserLogin,
  failedLogin: logFailedLogin,
  logout: logUserLogout,
  passwordChange: logPasswordChange,
  roleChange: logRoleChange,

  // Business events
  create: logDataCreation,
  update: logDataUpdate,
  delete: logDataDeletion,
  bulk: logBulkOperation,

  // Technical events
  apiError: logApiError,
  jobFailed: logBackgroundJobFailed,
  cronJob: logCronJobExecution,

  // Security events
  security: logSecurityEvent,
  unauthorized: logUnauthorizedAccess,
  bruteForce: logBruteForceAttempt,
  suspicious: logSuspiciousActivity,
  dataAccess: logDataAccessAttempt
}

export default ActivityLogger
