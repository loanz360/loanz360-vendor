/**
 * Compliance & Audit System Types
 * TypeScript types for enterprise compliance tracking
 */

import { z } from 'zod'

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const ComplianceFrameworks = {
  SOC2: 'soc2',
  ISO27001: 'iso27001',
  GDPR: 'gdpr',
  CUSTOM: 'custom',
} as const

export const SensitivityLevels = {
  PUBLIC: 'public',
  INTERNAL: 'internal',
  CONFIDENTIAL: 'confidential',
  RESTRICTED: 'restricted',
} as const

export const AuditSeverities = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const

export const ViolationStatuses = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  FALSE_POSITIVE: 'false_positive',
  ACCEPTED_RISK: 'accepted_risk',
} as const

export const ReviewTypes = {
  QUARTERLY_CERTIFICATION: 'quarterly_certification',
  ROLE_ATTESTATION: 'role_attestation',
  PRIVILEGE_REVIEW: 'privilege_review',
  TERMINATION_REVIEW: 'termination_review',
} as const

export const EvidenceTypes = {
  SCREENSHOT: 'screenshot',
  DOCUMENT: 'document',
  APPROVAL: 'approval',
  LOG_EXPORT: 'log_export',
  EMAIL: 'email',
} as const

export const ReportFormats = {
  PDF: 'pdf',
  EXCEL: 'excel',
  CSV: 'csv',
  JSON: 'json',
} as const

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogEntry {
  id: string
  sequence_number: number
  previous_hash: string | null
  current_hash: string

  // Who, What, When, Where
  admin_id: string | null
  admin_email: string
  admin_role: string | null
  action: string
  resource_type: string | null
  resource_id: string | null

  // Context
  ip_address: string | null
  user_agent: string | null
  session_id: string | null
  request_id: string | null
  request_headers: Record<string, unknown>

  // Changes
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  changes: Record<string, unknown> | null

  // Classification
  sensitivity_level: keyof typeof SensitivityLevels
  compliance_frameworks: string[]
  policy_violations: string[]

  // Metadata
  severity: keyof typeof AuditSeverities
  status: 'success' | 'failure' | 'blocked'
  error_message: string | null
  evidence_ids: string[]

  // Archival
  is_archived: boolean
  archived_at: string | null
  archive_location: string | null

  created_at: string
}

export interface LogAuditEventParams {
  adminId: string
  adminEmail: string
  adminRole: string
  action: string
  resourceType?: string
  resourceId?: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  severity?: keyof typeof AuditSeverities
  status?: 'success' | 'failure' | 'blocked'
  frameworks?: string[]
  sensitivityLevel?: keyof typeof SensitivityLevels
}

// ============================================================================
// POLICY TYPES
// ============================================================================

export interface CompliancePolicy {
  id: string
  policy_code: string
  framework: keyof typeof ComplianceFrameworks
  category: string

  title: string
  description: string | null
  requirement: string

  // Enforcement
  is_enforced: boolean
  enforcement_type: 'preventive' | 'detective' | 'corrective'
  severity: 'low' | 'medium' | 'high' | 'critical'

  // Auto-checks
  auto_check_enabled: boolean
  check_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | null
  check_function: string | null
  last_check_at: string | null
  next_check_at: string | null

  // Evidence
  requires_evidence: boolean
  evidence_types: string[]

  // Metadata
  owner_id: string | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export const PolicySchema = z.object({
  policy_code: z.string().min(1).max(100),
  framework: z.enum(['soc2', 'iso27001', 'gdpr', 'custom']),
  category: z.string().min(1),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  requirement: z.string().min(1),
  enforcement_type: z.enum(['preventive', 'detective', 'corrective']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  is_enforced: z.boolean().default(true),
  auto_check_enabled: z.boolean().default(false),
  requires_evidence: z.boolean().default(false),
})

// ============================================================================
// VIOLATION TYPES
// ============================================================================

export interface PolicyViolation {
  id: string
  policy_id: string
  audit_log_id: number | null

  // Details
  violation_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string

  // Context
  admin_id: string | null
  resource_type: string | null
  resource_id: string | null
  detected_at: string
  detection_method: 'auto_check' | 'manual_review' | 'user_report'

  // Resolution
  status: keyof typeof ViolationStatuses
  assigned_to: string | null
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by: string | null

  // Risk
  risk_score: number | null
  impact_level: string | null
  likelihood: string | null

  // Remediation
  remediation_required: boolean
  remediation_deadline: string | null
  remediation_actions: string[]

  created_at: string
  updated_at: string
}

export interface CreateViolationParams {
  policyId: string
  auditLogId?: number
  adminId?: string
  violationType: string
  description: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  autoAssign?: boolean
}

// ============================================================================
// EVIDENCE TYPES
// ============================================================================

export interface Evidence {
  id: string
  audit_log_id: number | null
  policy_id: string | null
  violation_id: string | null

  // Metadata
  evidence_type: keyof typeof EvidenceTypes
  file_name: string
  file_type: string | null
  file_size: number | null
  file_hash: string

  // Storage
  storage_path: string
  storage_provider: 's3' | 'azure' | 'gcs'
  encryption_key_id: string | null
  is_encrypted: boolean

  // Classification
  sensitivity_level: keyof typeof SensitivityLevels
  retention_until: string

  // Metadata
  description: string | null
  tags: string[]
  uploaded_by: string | null
  uploaded_at: string

  // Access tracking
  last_accessed_at: string | null
  last_accessed_by: string | null
  access_count: number

  // Archival
  is_archived: boolean
  archived_at: string | null
  archive_location: string | null
}

export interface UploadEvidenceParams {
  evidenceType: keyof typeof EvidenceTypes
  fileName: string
  fileType: string
  fileSize: number
  fileContent: File | Blob
  description?: string
  tags?: string[]
  auditLogId?: number
  policyId?: string
  violationId?: string
  sensitivityLevel?: keyof typeof SensitivityLevels
}

// ============================================================================
// ACCESS REVIEW TYPES
// ============================================================================

export interface AccessReview {
  id: string
  review_type: keyof typeof ReviewTypes
  review_period_start: string
  review_period_end: string

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'
  due_date: string

  // Scope
  admin_ids: string[]
  reviewer_id: string | null
  approver_id: string | null

  // Results
  total_admins: number
  reviewed_count: number
  approved_count: number
  revoked_count: number
  modified_count: number
  findings_count: number

  // Findings
  findings: ReviewFinding[]

  // Completion
  completed_at: string | null
  completion_notes: string | null
  sign_off_by: string | null
  sign_off_at: string | null

  // Automation
  is_automated: boolean
  reminder_sent_at: string | null
  escalation_sent_at: string | null

  created_at: string
  updated_at: string
}

export interface ReviewFinding {
  admin_id: string
  issue_type: string
  description: string
  action_taken: string
  severity: 'low' | 'medium' | 'high'
}

// ============================================================================
// REPORT TYPES
// ============================================================================

export interface ComplianceReport {
  id: string
  report_code: string
  report_type: string
  framework: string | null

  // Details
  title: string
  description: string | null

  // Period
  period_start: string
  period_end: string

  // Generation
  status: 'pending' | 'generating' | 'completed' | 'failed'
  generated_by: string | null
  generated_at: string | null
  generation_duration_ms: number | null

  // Results
  total_events: number
  compliant_events: number
  non_compliant_events: number
  compliance_score: number | null

  // Findings
  findings: ReportFinding[]
  recommendations: ReportRecommendation[]
  summary: Record<string, unknown> | null

  // Export
  export_format: keyof typeof ReportFormats
  export_path: string | null
  file_size: number | null
  file_hash: string | null

  // Metadata
  is_public: boolean
  shared_with: string[]
  downloaded_count: number
  last_downloaded_at: string | null

  created_at: string
  updated_at: string
}

export interface ReportFinding {
  issue_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affected_count: number
  examples: string[]
}

export interface ReportRecommendation {
  priority: 'low' | 'medium' | 'high'
  category: string
  recommendation: string
  expected_impact: string
}

export interface GenerateReportParams {
  reportType: string
  framework?: string
  periodStart: string
  periodEnd: string
  exportFormat?: keyof typeof ReportFormats
  includeEvidence?: boolean
}

// ============================================================================
// SCHEDULED REPORT TYPES
// ============================================================================

export interface ScheduledReport {
  id: string
  report_type: string
  framework: string | null

  // Schedule
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  schedule_cron: string | null
  schedule_day: number | null
  schedule_time: string
  next_run_at: string

  // Recipients
  recipient_emails: string[]
  recipient_admin_ids: string[]

  // Options
  export_format: keyof typeof ReportFormats
  include_evidence: boolean
  include_raw_data: boolean
  report_filters: Record<string, unknown>

  // Status
  is_active: boolean
  last_run_at: string | null
  last_run_status: 'success' | 'failed' | 'skipped' | null
  last_run_error: string | null
  run_count: number

  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface ComplianceDashboardStats {
  audit_summary: {
    total_events: number
    successful_events: number
    failed_events: number
    blocked_events: number
    violation_events: number
    active_admins: number
    critical_events: number
    events_last_24h: number
  }
  violation_summary: {
    total_violations: number
    open_violations: number
    investigating_violations: number
    critical_violations: number
    high_violations: number
    avg_risk_score: number
    violations_last_24h: number
  }
  review_summary: {
    total_reviews: number
    completed_reviews: number
    overdue_reviews: number
    pending_reviews: number
    total_findings: number
  }
  framework_compliance: Array<{
    framework: string
    total_policies: number
    active_policies: number
    enforced_policies: number
    enforcement_rate: number
  }>
  evidence_summary: {
    total_evidence: number
    total_storage_bytes: number
    recent_uploads: number
    evidence_types_count: number
  }
  report_summary: {
    total_reports: number
    completed_reports: number
    recent_reports: number
    avg_compliance_score: number
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ChainVerificationResult {
  is_valid: boolean
  total_checked: number
  invalid_records: number
  invalid_sequence_numbers: number[]
}

export interface AuditTrailEntry {
  sequence_number: number
  admin_email: string
  action: string
  changes: Record<string, unknown> | null
  created_at: string
}
