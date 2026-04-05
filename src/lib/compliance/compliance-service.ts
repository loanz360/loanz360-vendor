/**
 * Compliance & Audit Service
 * Core service for enterprise compliance operations
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import type {
  LogAuditEventParams,
  CreateViolationParams,
  GenerateReportParams,
  ChainVerificationResult,
  AuditTrailEntry,
} from './compliance-types'

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log an audit event with cryptographic chain
 */
export async function logAuditEvent(params: LogAuditEventParams): Promise<number | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('log_audit_event', {
    p_admin_id: params.adminId,
    p_admin_email: params.adminEmail,
    p_admin_role: params.adminRole,
    p_action: params.action,
    p_resource_type: params.resourceType || null,
    p_resource_id: params.resourceId || null,
    p_before_state: params.beforeState || null,
    p_after_state: params.afterState || null,
    p_ip_address: params.ipAddress || null,
    p_user_agent: params.userAgent || null,
    p_session_id: params.sessionId || null,
    p_severity: params.severity || 'info',
    p_status: params.status || 'success',
    p_frameworks: params.frameworks || ['soc2'],
    p_sensitivity: params.sensitivityLevel || 'internal',
  })

  if (error) {
    console.error('Failed to log audit event:', error)
    return null
  }

  return data
}

/**
 * Verify audit chain integrity
 */
export async function verifyAuditChain(
  fromSequence?: number,
  toSequence?: number
): Promise<ChainVerificationResult | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('verify_audit_chain', {
    p_from_sequence: fromSequence || 1,
    p_to_sequence: toSequence || null,
  })

  if (error) {
    console.error('Failed to verify audit chain:', error)
    return null
  }

  return data[0] || null
}

/**
 * Get audit trail for a resource
 */
export async function getResourceAuditTrail(
  resourceType: string,
  resourceId: string,
  limit: number = 100
): Promise<AuditTrailEntry[]> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('get_resource_audit_trail', {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_limit: limit,
  })

  if (error) {
    console.error('Failed to get audit trail:', error)
    return []
  }

  return data || []
}

// ============================================================================
// POLICY COMPLIANCE
// ============================================================================

/**
 * Check policy compliance for an action
 */
export async function checkPolicyCompliance(
  action: string,
  adminId: string,
  resourceType?: string,
  context?: Record<string, any>
): Promise<
  Array<{
    policy_id: string
    policy_code: string
    is_compliant: boolean
    violation_reason: string | null
  }>
> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('check_policy_compliance', {
    p_action: action,
    p_admin_id: adminId,
    p_resource_type: resourceType || null,
    p_context: context || {},
  })

  if (error) {
    console.error('Failed to check policy compliance:', error)
    return []
  }

  return data || []
}

/**
 * Create a policy violation
 */
export async function createViolation(params: CreateViolationParams): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('create_violation', {
    p_policy_id: params.policyId,
    p_audit_log_id: params.auditLogId || null,
    p_admin_id: params.adminId || null,
    p_violation_type: params.violationType,
    p_description: params.description,
    p_severity: params.severity || 'medium',
    p_auto_assign: params.autoAssign !== false,
  })

  if (error) {
    console.error('Failed to create violation:', error)
    return null
  }

  return data
}

// ============================================================================
// ACCESS REVIEWS
// ============================================================================

/**
 * Initiate quarterly access review
 */
export async function initiateAccessReview(
  reviewType: string = 'quarterly_certification',
  reviewerId?: string
): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('initiate_access_review', {
    p_review_type: reviewType,
    p_reviewer_id: reviewerId || null,
  })

  if (error) {
    console.error('Failed to initiate access review:', error)
    return null
  }

  return data
}

// ============================================================================
// COMPLIANCE SCORING
// ============================================================================

/**
 * Calculate compliance score for a framework
 */
export async function calculateComplianceScore(
  framework: string = 'soc2',
  periodDays: number = 30
): Promise<number | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('calculate_compliance_score', {
    p_framework: framework,
    p_period_days: periodDays,
  })

  if (error) {
    console.error('Failed to calculate compliance score:', error)
    return null
  }

  return data
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate compliance report
 */
export async function generateComplianceReport(
  params: GenerateReportParams
): Promise<string | null> {
  const supabase = createSupabaseAdmin()

  // Create report record
  const reportCode = `${params.framework?.toUpperCase() || 'CUSTOM'}_${params.reportType.toUpperCase()}_${new Date().getFullYear()}Q${Math.floor(new Date().getMonth() / 3) + 1}`

  const { data, error } = await supabase
    .from('compliance_reports')
    .insert({
      report_code: reportCode,
      report_type: params.reportType,
      framework: params.framework || null,
      title: `${params.reportType} Report`,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      export_format: params.exportFormat || 'pdf',
      status: 'pending',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to create report:', error)
    return null
  }

  // Report generation will be handled by a background job
  // This just creates the record and returns the ID

  return data.id
}

/**
 * Get compliance dashboard stats
 */
export async function getComplianceStats(): Promise<any> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('get_compliance_stats')

  if (error) {
    console.error('Failed to get compliance stats:', error)
    return null
  }

  return data
}

// ============================================================================
// ARCHIVAL
// ============================================================================

/**
 * Archive old audit logs (90+ days)
 */
export async function archiveAuditLogs(
  archiveOlderThanDays: number = 90
): Promise<number | null> {
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.rpc('archive_audit_logs', {
    p_archive_older_than_days: archiveOlderThanDays,
  })

  if (error) {
    console.error('Failed to archive audit logs:', error)
    return null
  }

  return data
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'high':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'low':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

/**
 * Get severity badge color
 */
export function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-600 text-white'
    case 'high':
      return 'bg-orange-600 text-white'
    case 'medium':
      return 'bg-yellow-600 text-white'
    case 'low':
      return 'bg-blue-600 text-white'
    default:
      return 'bg-gray-600 text-white'
  }
}

/**
 * Get status color for violations
 */
export function getViolationStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'text-red-600 bg-red-50'
    case 'investigating':
      return 'text-yellow-600 bg-yellow-50'
    case 'resolved':
      return 'text-green-600 bg-green-50'
    case 'false_positive':
      return 'text-gray-600 bg-gray-50'
    case 'accepted_risk':
      return 'text-purple-600 bg-purple-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

/**
 * Get framework badge color
 */
export function getFrameworkColor(framework: string): string {
  switch (framework) {
    case 'soc2':
      return 'bg-blue-600 text-white'
    case 'iso27001':
      return 'bg-purple-600 text-white'
    case 'gdpr':
      return 'bg-green-600 text-white'
    case 'custom':
      return 'bg-gray-600 text-white'
    default:
      return 'bg-gray-600 text-white'
  }
}

/**
 * Format compliance score
 */
export function formatComplianceScore(score: number): string {
  if (score >= 95) return `${score.toFixed(1)}% (Excellent)`
  if (score >= 80) return `${score.toFixed(1)}% (Good)`
  if (score >= 60) return `${score.toFixed(1)}% (Needs Improvement)`
  return `${score.toFixed(1)}% (Critical)`
}

/**
 * Get compliance score color
 */
export function getComplianceScoreColor(score: number): string {
  if (score >= 95) return 'text-green-600'
  if (score >= 80) return 'text-blue-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Get evidence type icon
 */
export function getEvidenceIcon(evidenceType: string): string {
  switch (evidenceType) {
    case 'screenshot':
      return '📸'
    case 'document':
      return '📄'
    case 'approval':
      return '✅'
    case 'log_export':
      return '📊'
    case 'email':
      return '📧'
    default:
      return '📎'
  }
}

/**
 * Get review status color
 */
export function getReviewStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 bg-green-50'
    case 'in_progress':
      return 'text-blue-600 bg-blue-50'
    case 'overdue':
      return 'text-red-600 bg-red-50'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'cancelled':
      return 'text-gray-600 bg-gray-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

/**
 * Calculate risk score color
 */
export function getRiskScoreColor(score: number): string {
  if (score >= 75) return 'text-red-600'
  if (score >= 50) return 'text-orange-600'
  if (score >= 25) return 'text-yellow-600'
  return 'text-green-600'
}

/**
 * Format time ago (fallback if date-fns not available)
 */
export function formatTimeAgo(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`
  return `${Math.floor(seconds / 31536000)}y ago`
}
