/**
 * Real-Time Activity Feed Types
 * Enterprise-grade type definitions for activity monitoring
 */

// =====================================================
// EVENT CATEGORIES & TYPES
// =====================================================

export type EventCategory = 'user' | 'business' | 'technical' | 'security'

export type UserEventType =
  | 'login'
  | 'logout'
  | 'failed_login'
  | 'password_change'
  | 'password_reset'
  | 'profile_update'
  | 'role_change'
  | 'permission_change'
  | 'account_activation'
  | 'account_deactivation'
  | 'session_expired'
  | 'force_logout'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'api_key_generated'
  | 'api_key_revoked'

export type BusinessEventType =
  | 'lead_created'
  | 'lead_updated'
  | 'lead_deleted'
  | 'lead_converted'
  | 'lead_assigned'
  | 'customer_created'
  | 'customer_updated'
  | 'partner_created'
  | 'partner_updated'
  | 'partner_approved'
  | 'partner_rejected'
  | 'payout_processed'
  | 'payout_approved'
  | 'payout_rejected'
  | 'document_uploaded'
  | 'document_downloaded'
  | 'document_deleted'
  | 'workflow_approval'
  | 'workflow_rejection'
  | 'bulk_import'
  | 'bulk_export'
  | 'bulk_delete'
  | 'configuration_change'
  | 'contest_created'
  | 'contest_evaluated'
  | 'notification_sent'
  | 'email_sent'
  | 'sms_sent'

export type TechnicalEventType =
  | 'api_error'
  | 'api_timeout'
  | 'api_rate_limit'
  | 'database_error'
  | 'database_slow_query'
  | 'server_error'
  | 'validation_error'
  | 'integration_failure'
  | 'webhook_failure'
  | 'cron_job_started'
  | 'cron_job_completed'
  | 'cron_job_failed'
  | 'background_job_started'
  | 'background_job_completed'
  | 'background_job_failed'
  | 'cache_miss'
  | 'cache_expired'
  | 'memory_warning'
  | 'disk_warning'
  | 'service_started'
  | 'service_stopped'
  | 'deployment_started'
  | 'deployment_completed'

export type SecurityEventType =
  | 'unauthorized_access'
  | 'brute_force_attempt'
  | 'suspicious_login'
  | 'ip_blocked'
  | 'geo_anomaly'
  | 'token_misuse'
  | 'token_expired'
  | 'data_exfiltration_attempt'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt'
  | 'rate_limit_exceeded'
  | 'privilege_escalation'
  | 'data_tampering'
  | 'sensitive_data_access'
  | 'audit_log_access'
  | 'security_config_change'
  | 'firewall_block'
  | 'malware_detected'
  | 'vulnerability_scan'

export type EventType = UserEventType | BusinessEventType | TechnicalEventType | SecurityEventType

// =====================================================
// SEVERITY LEVELS
// =====================================================

export type SeverityLevel = 'info' | 'warning' | 'error' | 'critical'

export const SEVERITY_CONFIG: Record<SeverityLevel, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  priority: number
}> = {
  info: {
    label: 'Info',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: 'Info',
    priority: 0
  },
  warning: {
    label: 'Warning',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: 'AlertTriangle',
    priority: 1
  },
  error: {
    label: 'Error',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: 'XCircle',
    priority: 2
  },
  critical: {
    label: 'Critical',
    color: 'text-red-500',
    bgColor: 'bg-red-600/20',
    borderColor: 'border-red-600/50',
    icon: 'AlertOctagon',
    priority: 3
  }
}

// =====================================================
// ACTIVITY STATUS
// =====================================================

export type ActivityStatus = 'active' | 'acknowledged' | 'resolved' | 'archived'

export const STATUS_CONFIG: Record<ActivityStatus, {
  label: string
  color: string
  bgColor: string
}> = {
  active: {
    label: 'Active',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  },
  acknowledged: {
    label: 'Acknowledged',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10'
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10'
  }
}

// =====================================================
// ACTOR TYPES
// =====================================================

export type ActorType =
  | 'superadmin'
  | 'admin'
  | 'employee'
  | 'partner'
  | 'customer'
  | 'vendor'
  | 'system'
  | 'unknown'

export const ACTOR_TYPE_CONFIG: Record<ActorType, {
  label: string
  color: string
  icon: string
}> = {
  superadmin: { label: 'Super Admin', color: 'text-purple-400', icon: 'Crown' },
  admin: { label: 'Admin', color: 'text-blue-400', icon: 'Shield' },
  employee: { label: 'Employee', color: 'text-green-400', icon: 'User' },
  partner: { label: 'Partner', color: 'text-orange-400', icon: 'Handshake' },
  customer: { label: 'Customer', color: 'text-cyan-400', icon: 'UserCheck' },
  vendor: { label: 'Vendor', color: 'text-yellow-400', icon: 'Store' },
  system: { label: 'System', color: 'text-gray-400', icon: 'Server' },
  unknown: { label: 'Unknown', color: 'text-red-400', icon: 'HelpCircle' }
}

// =====================================================
// SOURCE TYPES
// =====================================================

export type SourceType = 'ui' | 'api' | 'background_job' | 'system' | 'webhook' | 'cron'

export const SOURCE_CONFIG: Record<SourceType, {
  label: string
  icon: string
}> = {
  ui: { label: 'UI', icon: 'Monitor' },
  api: { label: 'API', icon: 'Code' },
  background_job: { label: 'Background Job', icon: 'Clock' },
  system: { label: 'System', icon: 'Server' },
  webhook: { label: 'Webhook', icon: 'Webhook' },
  cron: { label: 'Scheduled', icon: 'Calendar' }
}

// =====================================================
// MODULE TYPES
// =====================================================

export const MODULES = [
  'auth',
  'leads',
  'customers',
  'partners',
  'employees',
  'payouts',
  'cae',
  'hr',
  'notifications',
  'banners',
  'contests',
  'support',
  'documents',
  'reports',
  'analytics',
  'settings',
  'admin',
  'api',
  'integrations'
] as const

export type ModuleType = typeof MODULES[number]

// =====================================================
// CATEGORY CONFIGURATION
// =====================================================

export const CATEGORY_CONFIG: Record<EventCategory, {
  label: string
  description: string
  color: string
  bgColor: string
  icon: string
  events: readonly string[]
}> = {
  user: {
    label: 'User Activities',
    description: 'User authentication, profile, and account events',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    icon: 'Users',
    events: [
      'login', 'logout', 'failed_login', 'password_change', 'password_reset',
      'profile_update', 'role_change', 'permission_change', 'account_activation',
      'account_deactivation', 'session_expired', 'force_logout'
    ]
  },
  business: {
    label: 'Business Operations',
    description: 'Core business workflows and data operations',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    icon: 'Briefcase',
    events: [
      'lead_created', 'lead_updated', 'lead_deleted', 'lead_converted',
      'customer_created', 'partner_created', 'payout_processed', 'workflow_approval',
      'bulk_import', 'bulk_export', 'document_uploaded', 'document_downloaded'
    ]
  },
  technical: {
    label: 'Technical Events',
    description: 'System, API, and infrastructure events',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    icon: 'Server',
    events: [
      'api_error', 'api_timeout', 'database_error', 'server_error',
      'validation_error', 'cron_job_started', 'cron_job_completed',
      'cron_job_failed', 'background_job_failed', 'integration_failure'
    ]
  },
  security: {
    label: 'Security Events',
    description: 'Security threats, attacks, and compliance events',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    icon: 'ShieldAlert',
    events: [
      'unauthorized_access', 'brute_force_attempt', 'suspicious_login',
      'ip_blocked', 'geo_anomaly', 'token_misuse', 'data_tampering',
      'sql_injection_attempt', 'xss_attempt', 'privilege_escalation'
    ]
  }
}

// =====================================================
// MAIN ACTIVITY INTERFACE
// =====================================================

export interface RealtimeActivity {
  id: string

  // Classification
  event_category: EventCategory
  event_type: string
  event_subtype?: string
  severity_level: SeverityLevel
  status: ActivityStatus

  // Actor
  actor_id?: string
  actor_type: ActorType
  actor_name?: string
  actor_email?: string
  actor_role?: string
  actor_department?: string

  // Entity
  entity_type?: string
  entity_id?: string
  entity_name?: string

  // Source
  module?: ModuleType | string
  source: SourceType
  source_service?: string

  // Content
  title: string
  description?: string

  // Changes
  changes_before?: Record<string, unknown>
  changes_after?: Record<string, unknown>
  changed_fields?: string[]

  // Technical context
  request_id?: string
  session_id?: string
  correlation_id?: string

  // Network
  ip_address?: string
  user_agent?: string
  device_type?: string
  browser?: string
  os?: string

  // Geolocation
  country?: string
  region?: string
  city?: string
  timezone?: string

  // Security
  is_suspicious: boolean
  is_security_event: boolean
  threat_level: number
  security_tags?: string[]

  // Performance
  response_time_ms?: number
  error_code?: string
  error_message?: string

  // Metadata
  metadata?: Record<string, unknown>
  tags?: string[]

  // Timestamps
  created_at: string
  updated_at?: string
  acknowledged_at?: string
  acknowledged_by?: string
  resolved_at?: string
  resolved_by?: string
  resolution_notes?: string
}

// =====================================================
// FILTER INTERFACES
// =====================================================

export interface ActivityFilters {
  categories?: EventCategory[]
  event_types?: string[]
  severity_levels?: SeverityLevel[]
  actor_types?: ActorType[]
  modules?: string[]
  sources?: SourceType[]
  status?: ActivityStatus[]
  start_date?: string
  end_date?: string
  search?: string
  security_only?: boolean
  suspicious_only?: boolean
  ip_address?: string
  actor_id?: string
}

export interface ActivityFeedOptions {
  limit?: number
  offset?: number
  filters?: ActivityFilters
  sort_by?: 'created_at' | 'severity_level' | 'event_category'
  sort_order?: 'asc' | 'desc'
}

// =====================================================
// STATISTICS INTERFACES
// =====================================================

export interface ActivityStatistics {
  total_events: number
  critical_events: number
  error_events: number
  warning_events: number
  info_events: number
  security_events: number
  suspicious_events: number
  unique_users: number
  events_by_category: Record<string, number>
  events_by_module: Record<string, number>
  events_by_hour: Array<{ hour: string; count: number }>
  top_event_types: Array<{ type: string; count: number }>
  top_actors: Array<{ actor: string; actor_type: string; count: number }>
}

// =====================================================
// ALERT INTERFACES
// =====================================================

export interface ActivityAlert {
  id: string
  name: string
  description?: string
  is_active: boolean
  trigger_conditions: {
    event_category?: EventCategory[]
    event_types?: string[]
    severity_level?: SeverityLevel[]
    threat_level_gte?: number
    actor_types?: ActorType[]
  }
  alert_severity: SeverityLevel
  notify_in_app: boolean
  notify_email: boolean
  notify_sms: boolean
  notify_webhook: boolean
  recipient_users?: string[]
  recipient_roles?: string[]
  webhook_url?: string
  cooldown_seconds: number
  max_alerts_per_hour: number
  escalation_enabled: boolean
  escalation_after_minutes?: number
  escalation_to_users?: string[]
  created_at: string
  updated_at: string
}

export interface AlertHistory {
  id: string
  alert_id: string
  activity_id: string
  alert_name: string
  alert_severity: SeverityLevel
  notification_channels: string[]
  notification_status: 'pending' | 'sent' | 'failed'
  notification_sent_at?: string
  acknowledged_at?: string
  acknowledged_by?: string
  escalated: boolean
  created_at: string
}

// =====================================================
// INCIDENT INTERFACES
// =====================================================

export type IncidentStatus =
  | 'open'
  | 'investigating'
  | 'mitigating'
  | 'resolved'
  | 'closed'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ActivityIncident {
  id: string
  title: string
  description?: string
  severity: IncidentSeverity
  status: IncidentStatus
  incident_type?: string
  affected_module?: string
  related_activity_ids?: string[]
  root_cause_activity_id?: string
  assigned_to?: string
  assigned_team?: string
  detected_at: string
  acknowledged_at?: string
  investigation_started_at?: string
  mitigated_at?: string
  resolved_at?: string
  closed_at?: string
  resolution_summary?: string
  root_cause_analysis?: string
  preventive_measures?: string
  impact_level?: string
  affected_users_count?: number
  affected_services?: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface IncidentComment {
  id: string
  incident_id: string
  comment_type: 'comment' | 'status_change' | 'assignment' | 'escalation'
  content: string
  old_status?: string
  new_status?: string
  author_id?: string
  author_name?: string
  created_at: string
}

// =====================================================
// BOOKMARK INTERFACE
// =====================================================

export interface ActivityBookmark {
  id: string
  activity_id: string
  user_id: string
  notes?: string
  tags?: string[]
  created_at: string
}

// =====================================================
// SSE EVENT TYPES
// =====================================================

export interface SSEActivityEvent {
  type: 'activity' | 'alert' | 'heartbeat' | 'stats_update' | 'connected'
  data?: RealtimeActivity | AlertHistory | ActivityStatistics
  timestamp: string
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ActivityFeedResponse {
  success: boolean
  activities: RealtimeActivity[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

export interface StatisticsResponse {
  success: boolean
  statistics: ActivityStatistics
  period: {
    start: string
    end: string
  }
}
