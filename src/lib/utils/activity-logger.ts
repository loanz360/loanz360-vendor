/**
 * Activity Logger Utility
 *
 * Comprehensive activity tracking system for monitoring all user actions across the application.
 * Logs activities to the system_activities table for real-time monitoring by Super Admin.
 */

import { createClient } from '@/lib/supabase/server'

export type ActivityType =
  | 'auth'
  | 'user_management'
  | 'data_modification'
  | 'permission_change'
  | 'system_configuration'
  | 'api_call'
  | 'file_upload'
  | 'file_download'
  | 'approval_action'
  | 'notification_sent'
  | 'report_generated'
  | 'export_data'
  | 'import_data'
  | 'bulk_operation'
  | 'security_event'
  | 'error_event'

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'

export type UserType = 'superadmin' | 'admin' | 'employee' | 'partner' | 'customer' | 'vendor' | 'system'

export type ActivityStatus = 'active' | 'acknowledged' | 'resolved'

export interface ActivityLogData {
  // Required fields
  activityType: ActivityType
  severityLevel: SeverityLevel
  userType: UserType
  actionPerformed: string
  description: string

  // Optional user information (auto-populated from session if not provided)
  userId?: string
  userFullName?: string
  userEmail?: string
  userRole?: string

  // Optional entity information
  entityType?: string
  entityId?: string
  entityName?: string

  // Optional change tracking
  changesBefore?: Record<string, unknown>
  changesAfter?: Record<string, unknown>

  // Optional request context (auto-populated from request if available)
  ipAddress?: string
  location?: string
  userAgent?: string
  requestMethod?: string
  requestPath?: string

  // Optional additional metadata
  metadata?: Record<string, unknown>

  // Optional status
  status?: ActivityStatus
}

/**
 * Log an activity to the system_activities table
 *
 * @param data - Activity log data
 * @param request - Optional Next.js request object to auto-populate context
 * @returns Promise<boolean> - Success status
 */
export async function logActivity(
  data: ActivityLogData,
  request?: Request
): Promise<boolean> {
  try {
    const supabase = await createClient()

    // Get current user from session if not provided
    let userId = data.userId
    let userFullName = data.userFullName
    let userEmail = data.userEmail

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        userEmail = user.email || undefined
        userFullName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined
      }
    }

    // Extract request context if request object is provided
    let ipAddress = data.ipAddress
    let userAgent = data.userAgent
    let requestMethod = data.requestMethod
    let requestPath = data.requestPath

    if (request) {
      ipAddress = ipAddress || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
      userAgent = userAgent || request.headers.get('user-agent') || undefined
      requestMethod = requestMethod || request.method
      requestPath = requestPath || new URL(request.url).pathname
    }

    // Build changes JSON if before/after provided
    const changesJson = (data.changesBefore || data.changesAfter)
      ? {
          before: data.changesBefore || null,
          after: data.changesAfter || null
        }
      : {}

    // Insert activity log
    const { error } = await supabase
      .from('system_activities')
      .insert({
        activity_type: data.activityType,
        severity_level: data.severityLevel,
        user_id: userId,
        user_type: data.userType,
        user_full_name: userFullName,
        user_email: userEmail,
        user_role: data.userRole,
        action_performed: data.actionPerformed,
        entity_type: data.entityType,
        entity_id: data.entityId,
        entity_name: data.entityName,
        description: data.description,
        changes_json: changesJson,
        ip_address: ipAddress,
        location: data.location,
        user_agent: userAgent,
        request_method: requestMethod,
        request_path: requestPath,
        metadata: data.metadata || {},
        status: data.status || 'active'
      })

    if (error) {
      console.error('[Activity Logger] Failed to log activity:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[Activity Logger] Exception while logging activity:', error)
    return false
  }
}

/**
 * Log authentication activity
 */
export async function logAuthActivity(
  action: 'login' | 'logout' | 'signup' | 'password_reset' | 'password_change' | 'failed_login',
  userType: UserType,
  severity: SeverityLevel = 'low',
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  const severityMap: Record<string, SeverityLevel> = {
    'login': 'low',
    'logout': 'low',
    'signup': 'medium',
    'password_reset': 'medium',
    'password_change': 'medium',
    'failed_login': 'high'
  }

  const descriptionMap: Record<string, string> = {
    'login': `User successfully logged in`,
    'logout': `User logged out`,
    'signup': `New user account created`,
    'password_reset': `Password reset requested`,
    'password_change': `Password changed successfully`,
    'failed_login': `Failed login attempt detected`
  }

  return logActivity({
    activityType: 'auth',
    severityLevel: severity || severityMap[action] || 'low',
    userType,
    actionPerformed: action,
    description: descriptionMap[action] || `Authentication action: ${action}`,
    ...additionalData
  }, request)
}

/**
 * Log data modification activity
 */
export async function logDataModification(
  action: 'create' | 'update' | 'delete',
  entityType: string,
  entityId: string,
  entityName: string,
  userType: UserType,
  severity: SeverityLevel = 'medium',
  changesBefore?: Record<string, unknown>,
  changesAfter?: Record<string, unknown>,
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  const descriptionMap: Record<string, string> = {
    'create': `Created new ${entityType}: ${entityName}`,
    'update': `Updated ${entityType}: ${entityName}`,
    'delete': `Deleted ${entityType}: ${entityName}`
  }

  return logActivity({
    activityType: 'data_modification',
    severityLevel: severity,
    userType,
    actionPerformed: action,
    entityType,
    entityId,
    entityName,
    description: descriptionMap[action] || `Data modification: ${action} ${entityType}`,
    changesBefore,
    changesAfter,
    ...additionalData
  }, request)
}

/**
 * Log permission change activity
 */
export async function logPermissionChange(
  action: string,
  targetEntity: string,
  targetEntityName: string,
  userType: UserType,
  changesBefore?: Record<string, unknown>,
  changesAfter?: Record<string, unknown>,
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  return logActivity({
    activityType: 'permission_change',
    severityLevel: 'high',
    userType,
    actionPerformed: action,
    entityType: targetEntity,
    entityName: targetEntityName,
    description: `Permission changed: ${action} for ${targetEntity} ${targetEntityName}`,
    changesBefore,
    changesAfter,
    ...additionalData
  }, request)
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  action: string,
  description: string,
  userType: UserType,
  severity: SeverityLevel = 'critical',
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  return logActivity({
    activityType: 'security_event',
    severityLevel: severity,
    userType,
    actionPerformed: action,
    description,
    ...additionalData
  }, request)
}

/**
 * Log system error event
 */
export async function logErrorEvent(
  action: string,
  description: string,
  userType: UserType,
  severity: SeverityLevel = 'high',
  errorDetails?: Record<string, unknown>,
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  return logActivity({
    activityType: 'error_event',
    severityLevel: severity,
    userType,
    actionPerformed: action,
    description,
    metadata: errorDetails,
    ...additionalData
  }, request)
}

/**
 * Log approval action
 */
export async function logApprovalAction(
  action: 'approve' | 'reject' | 'pending',
  entityType: string,
  entityId: string,
  entityName: string,
  userType: UserType,
  reason?: string,
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  const descriptionMap: Record<string, string> = {
    'approve': `Approved ${entityType}: ${entityName}`,
    'reject': `Rejected ${entityType}: ${entityName}`,
    'pending': `Marked ${entityType} as pending: ${entityName}`
  }

  return logActivity({
    activityType: 'approval_action',
    severityLevel: 'medium',
    userType,
    actionPerformed: action,
    entityType,
    entityId,
    entityName,
    description: reason ? `${descriptionMap[action]} - Reason: ${reason}` : descriptionMap[action],
    ...additionalData
  }, request)
}

/**
 * Log bulk operation
 */
export async function logBulkOperation(
  action: string,
  entityType: string,
  recordCount: number,
  userType: UserType,
  severity: SeverityLevel = 'high',
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  return logActivity({
    activityType: 'bulk_operation',
    severityLevel: severity,
    userType,
    actionPerformed: action,
    entityType,
    description: `Bulk operation: ${action} on ${recordCount} ${entityType} records`,
    metadata: { record_count: recordCount },
    ...additionalData
  }, request)
}

/**
 * Log file operation
 */
export async function logFileOperation(
  action: 'upload' | 'download' | 'delete',
  fileName: string,
  fileSize?: number,
  userType?: UserType,
  additionalData?: Partial<ActivityLogData>,
  request?: Request
): Promise<boolean> {
  const descriptionMap: Record<string, string> = {
    'upload': `Uploaded file: ${fileName}`,
    'download': `Downloaded file: ${fileName}`,
    'delete': `Deleted file: ${fileName}`
  }

  return logActivity({
    activityType: action === 'upload' ? 'file_upload' : 'file_download',
    severityLevel: action === 'delete' ? 'medium' : 'low',
    userType: userType || 'system',
    actionPerformed: action,
    entityType: 'file',
    entityName: fileName,
    description: descriptionMap[action],
    metadata: fileSize ? { file_size_bytes: fileSize } : {},
    ...additionalData
  }, request)
}

/**
 * Determine severity based on action type (helper function)
 */
export function determineSeverity(
  action: string,
  entityType?: string
): SeverityLevel {
  // Critical severity
  const criticalActions = ['delete_account', 'security_breach', 'system_failure', 'data_breach']
  if (criticalActions.some(a => action.includes(a))) return 'critical'

  // High severity
  const highActions = ['delete', 'permission', 'role_change', 'bulk_delete', 'failed_login']
  if (highActions.some(a => action.includes(a))) return 'high'

  // Medium severity
  const mediumActions = ['create', 'update', 'approve', 'reject', 'password']
  if (mediumActions.some(a => action.includes(a))) return 'medium'

  // Default to low
  return 'low'
}

/**
 * Get user type from role string (helper function)
 */
export function getUserTypeFromRole(role?: string): UserType {
  if (!role) return 'system'

  const roleLower = role.toLowerCase()

  if (roleLower.includes('superadmin') || roleLower === 'super_admin') return 'superadmin'
  if (roleLower.includes('admin')) return 'admin'
  if (roleLower.includes('employee') || roleLower === 'hr' || roleLower === 'cro') return 'employee'
  if (roleLower.includes('partner') || roleLower === 'ba' || roleLower === 'bp' || roleLower === 'cp') return 'partner'
  if (roleLower.includes('customer')) return 'customer'
  if (roleLower.includes('vendor')) return 'vendor'

  return 'system'
}
