/**
 * Enterprise Support Ticket System - Type Definitions
 * Version: 3.0 - Fortune 500 Standard
 *
 * Comprehensive type definitions for the unified support ticket system
 * across Employee, Customer, and Partner portals.
 */

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export enum TicketStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PENDING_REQUESTER = 'pending_requester',
  PENDING_INTERNAL = 'pending_internal',
  PENDING_THIRD_PARTY = 'pending_third_party',
  ON_HOLD = 'on_hold',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  CANCELLED = 'cancelled'
}

export enum TicketPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum TicketSource {
  EMPLOYEE = 'EMPLOYEE',
  CUSTOMER = 'CUSTOMER',
  PARTNER = 'PARTNER'
}

export enum PartnerSubRole {
  BUSINESS_ASSOCIATE = 'ba',
  BUSINESS_PARTNER = 'bp',
  CHANNEL_PARTNER = 'cp'
}

export enum EmployeeTicketCategory {
  HR_GENERAL = 'hr_general',
  PAYROLL = 'payroll',
  LEAVE_REQUEST = 'leave_request',
  BENEFITS = 'benefits',
  HARASSMENT = 'harassment',
  TECHNICAL = 'technical',
  FACILITIES = 'facilities',
  IT_SUPPORT = 'it_support',
  TRAINING = 'training',
  POLICY_QUERY = 'policy_query',
  GRIEVANCE = 'grievance',
  OTHER = 'other'
}

export enum CustomerTicketCategory {
  LOAN_APPLICATION = 'loan_application',
  LOAN_DISBURSEMENT = 'loan_disbursement',
  EMI_PAYMENT = 'emi_payment',
  ACCOUNT_ACCESS = 'account_access',
  DOCUMENT_UPLOAD = 'document_upload',
  LOAN_STATUS = 'loan_status',
  INTEREST_RATE = 'interest_rate',
  PREPAYMENT = 'prepayment',
  FORECLOSURE = 'foreclosure',
  CUSTOMER_SERVICE = 'customer_service',
  TECHNICAL_ISSUE = 'technical_issue',
  COMPLAINT = 'complaint',
  GENERAL_INQUIRY = 'general_inquiry'
}

export enum PartnerTicketCategory {
  PAYOUT_COMMISSION = 'payout_commission',
  SALES_SUPPORT = 'sales_support',
  TECHNICAL = 'technical',
  ACCOUNT_MANAGEMENT = 'account_management',
  TRAINING_RESOURCES = 'training_resources',
  COMPLIANCE_LEGAL = 'compliance_legal',
  CUSTOMER_ISSUES = 'customer_issues',
  PARTNERSHIP_MANAGEMENT = 'partnership_management',
  LEAD_MANAGEMENT = 'lead_management',
  INCENTIVE_CONTEST = 'incentive_contest',
  GENERAL = 'general'
}

export enum Department {
  HR = 'hr',
  FINANCE = 'finance',
  ACCOUNTS = 'accounts',
  IT = 'it',
  TECHNICAL_SUPPORT = 'technical_support',
  CUSTOMER_SUPPORT = 'customer_support',
  PARTNER_SUPPORT = 'partner_support',
  COMPLIANCE = 'compliance',
  LEGAL = 'legal',
  OPERATIONS = 'operations',
  MANAGEMENT = 'management',
  SUPER_ADMIN = 'super_admin'
}

export enum SLAStatus {
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  BREACHED = 'breached',
  PAUSED = 'paused'
}

export enum EscalationLevel {
  NONE = 0,
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
  LEVEL_5 = 5
}

export enum TicketRelationshipType {
  PARENT_CHILD = 'parent_child',
  DUPLICATE = 'duplicate',
  RELATED = 'related',
  CAUSED_BY = 'caused_by',
  BLOCKS = 'blocks',
  SPLIT_FROM = 'split_from',
  MERGED_INTO = 'merged_into'
}

export enum MessageType {
  TEXT = 'text',
  INTERNAL_NOTE = 'internal_note',
  SYSTEM = 'system',
  RESOLUTION = 'resolution',
  ESCALATION = 'escalation',
  AUTO_RESPONSE = 'auto_response'
}

export enum ActivityActionType {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNED = 'assigned',
  REASSIGNED = 'reassigned',
  ESCALATED = 'escalated',
  DE_ESCALATED = 'de_escalated',
  MESSAGE_ADDED = 'message_added',
  INTERNAL_NOTE_ADDED = 'internal_note_added',
  ATTACHMENT_ADDED = 'attachment_added',
  ATTACHMENT_REMOVED = 'attachment_removed',
  SLA_BREACHED = 'sla_breached',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  MERGED = 'merged',
  SPLIT = 'split',
  LINKED = 'linked',
  UNLINKED = 'unlinked',
  TAGGED = 'tagged',
  UNTAGGED = 'untagged'
}

export enum NotificationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  SLACK = 'slack',
  TEAMS = 'teams',
  WEBHOOK = 'webhook'
}

// ============================================================
// BASE INTERFACES
// ============================================================

export interface BaseTicket {
  id: string
  ticket_number: string
  subject: string
  description: string
  priority: TicketPriority | string
  status: TicketStatus | string
  created_at: string
  updated_at: string
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  sla_deadline: string | null
  sla_breached: boolean
  sla_status: SLAStatus | string
  response_time_hours: number | null
  resolution_time_hours: number | null
  is_escalated: boolean
  escalation_level: EscalationLevel | number
  escalated_at: string | null
  is_confidential: boolean
  requires_urgent_attention: boolean
  reopened_count: number
  message_count: number
  tags: string[]
}

export interface EmployeeTicket extends BaseTicket {
  source: TicketSource.EMPLOYEE
  category: EmployeeTicketCategory | string
  subcategory: string | null
  employee_id: string
  employee_name: string
  employee_email: string
  employee_department: string | null
  is_anonymous: boolean
  assigned_to: Department | string | null
  assigned_user_id: string | null
  assigned_user_name: string | null
}

export interface CustomerTicket extends BaseTicket {
  source: TicketSource.CUSTOMER
  category: CustomerTicketCategory | string
  subcategory: string | null
  customer_id: string
  customer_sub_role: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  has_loan_reference: boolean
  loan_application_id: string | null
  routed_to_department: Department | string | null
  assigned_to_customer_support_id: string | null
  routed_to_employee_id: string | null
  customer_support_status: string
  satisfaction_rating: number | null
  satisfaction_feedback: string | null
}

export interface PartnerTicket extends BaseTicket {
  source: TicketSource.PARTNER
  category: PartnerTicketCategory | string
  subcategory: string | null
  partner_id: string
  partner_sub_role: PartnerSubRole | string
  partner_name: string
  partner_email: string
  routed_to_department: Department | string | null
  assigned_to_partner_support_id: string | null
  routed_to_employee_id: string | null
  partner_support_status: string
}

export interface UnifiedTicket {
  id: string
  source: TicketSource | string
  unified_ticket_id: string
  ticket_number: string
  subject: string
  description: string
  category: string
  subcategory: string | null
  priority: TicketPriority | string
  status: TicketStatus | string
  requester_id: string
  requester_type: TicketSource | string
  requester_name: string
  requester_email: string
  requester_phone: string | null
  assigned_to_id: string | null
  assigned_to_name: string | null
  assigned_department: Department | string | null
  is_anonymous: boolean
  is_confidential: boolean
  requires_urgent_attention: boolean
  is_escalated: boolean
  escalation_level: EscalationLevel | number
  sla_deadline: string | null
  sla_breached: boolean
  sla_status: SLAStatus | string
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  response_time_hours: number | null
  resolution_time_hours: number | null
  reopened_count: number
  message_count: number
  created_at: string
  updated_at: string
  tags: string[]
}

// ============================================================
// MESSAGE & ACTIVITY INTERFACES
// ============================================================

export interface TicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  sender_type: 'employee' | 'customer' | 'partner' | 'system' | 'ai'
  sender_name: string
  sender_role: string | null
  sender_avatar_url: string | null
  message: string
  message_type: MessageType | string
  parent_message_id: string | null
  is_internal: boolean
  is_read_by_requester: boolean
  is_read_by_assignee: boolean
  ai_suggested: boolean
  ai_confidence_score: number | null
  created_at: string
  edited_at: string | null
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  message_id: string | null
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  thumbnail_url: string | null
  uploaded_by: string
  uploaded_by_type: 'employee' | 'customer' | 'partner' | 'system'
  uploaded_by_name: string
  is_scanned: boolean
  is_safe: boolean
  scan_result: string | null
  created_at: string
}

export interface TicketActivityLog {
  id: string
  ticket_id: string
  action_type: ActivityActionType | string
  description: string
  action_by: string
  action_by_type: 'employee' | 'customer' | 'partner' | 'system' | 'automation'
  action_by_name: string
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  metadata: Record<string, any> | null
  created_at: string
}

// ============================================================
// SLA INTERFACES
// ============================================================

export interface SLARule {
  id: string
  name: string
  description: string
  ticket_source: TicketSource | string | null
  category: string | null
  priority: TicketPriority | string
  first_response_hours: number
  resolution_hours: number
  use_business_hours: boolean
  business_hours_start: string
  business_hours_end: string
  business_days: number[]
  escalate_on_breach: boolean
  escalation_level: EscalationLevel | number
  notify_at_risk_percentage: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SLACalculation {
  deadline: string
  status: SLAStatus | string
  time_remaining_hours: number
  time_elapsed_hours: number
  percentage_used: number
  is_business_hours_active: boolean
  next_business_hours_start: string | null
}

// ============================================================
// ANALYTICS INTERFACES
// ============================================================

export interface TicketCounts {
  total: number
  new: number
  assigned: number
  in_progress: number
  pending_requester: number
  pending_internal: number
  on_hold: number
  escalated: number
  resolved: number
  closed: number
  reopened: number
  urgent: number
  high: number
  medium: number
  low: number
  by_source: {
    employee: number
    customer: number
    partner: number
  }
  sla_on_track: number
  sla_at_risk: number
  sla_breached: number
  unassigned: number
  requires_urgent_attention: number
}

export interface SupportAnalytics {
  period_start: string
  period_end: string
  tickets_created: number
  tickets_resolved: number
  tickets_closed: number
  tickets_reopened: number
  avg_first_response_time: number
  avg_resolution_time: number
  median_resolution_time: number
  sla_compliance_rate: number
  first_response_sla_rate: number
  resolution_sla_rate: number
  first_contact_resolution_rate: number
  reopen_rate: number
  escalation_rate: number
  avg_satisfaction_rating: number
  nps_score: number
  tickets_per_agent: number
  avg_tickets_per_agent_per_day: number
}

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  agent_department: Department | string
  tickets_assigned: number
  tickets_resolved: number
  tickets_closed: number
  avg_first_response_time: number
  avg_resolution_time: number
  sla_compliance_rate: number
  first_contact_resolution_rate: number
  reopen_rate: number
  avg_satisfaction_rating: number
  satisfaction_count: number
  performance_score: number
  rank: number
}

// ============================================================
// WORKFLOW & AUTOMATION INTERFACES
// ============================================================

export interface CannedResponse {
  id: string
  name: string
  shortcut: string
  subject_template: string | null
  body_template: string
  ticket_source: TicketSource | string | null
  categories: string[]
  variables: string[]
  usage_count: number
  last_used_at: string | null
  is_public: boolean
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AutoAssignmentRule {
  id: string
  name: string
  description: string
  conditions: AssignmentCondition[]
  match_type: 'all' | 'any'
  assign_to_department: Department | string | null
  assign_to_user_id: string | null
  round_robin_group: string | null
  priority_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssignmentCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in'
  value: string | string[]
}

export interface EscalationRule {
  id: string
  name: string
  description: string
  trigger_type: 'sla_breach' | 'time_elapsed' | 'no_response' | 'reopen_count' | 'manual'
  trigger_value: number
  applies_to_priorities: (TicketPriority | string)[]
  applies_to_categories: string[]
  escalate_to_level: EscalationLevel | number
  notify_users: string[]
  notify_departments: (Department | string)[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================
// API REQUEST/RESPONSE INTERFACES
// ============================================================

export interface CreateTicketRequest {
  subject: string
  description: string
  category: string
  priority: TicketPriority | string
  is_confidential?: boolean
  requires_urgent_attention?: boolean
  is_anonymous?: boolean
  loan_application_id?: string
  tags?: string[]
  attachments?: File[]
}

export interface UpdateTicketRequest {
  subject?: string
  description?: string
  category?: string
  priority?: TicketPriority | string
  status?: TicketStatus | string
  is_confidential?: boolean
  requires_urgent_attention?: boolean
  assigned_to_department?: Department | string
  assigned_to_user_id?: string
  tags?: string[]
}

export interface AddMessageRequest {
  message: string
  message_type?: MessageType | string
  is_internal?: boolean
  parent_message_id?: string
  attachments?: File[]
}

export interface TicketFilters {
  source?: TicketSource | string | (TicketSource | string)[]
  status?: TicketStatus | string | (TicketStatus | string)[]
  priority?: TicketPriority | string | (TicketPriority | string)[]
  category?: string | string[]
  department?: Department | string | (Department | string)[]
  assigned_to?: string
  unassigned?: boolean
  sla_status?: SLAStatus | string | (SLAStatus | string)[]
  is_escalated?: boolean
  is_confidential?: boolean
  requires_urgent_attention?: boolean
  search?: string
  tags?: string[]
  date_from?: string
  date_to?: string
  created_by?: string
}

export interface PaginationOptions {
  page: number
  limit: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_more: boolean
  }
}

export interface BulkOperationRequest {
  ticket_ids: string[]
  operation: 'assign' | 'change_status' | 'change_priority' | 'add_tags' | 'remove_tags' | 'merge' | 'close'
  params: {
    assigned_to_department?: Department | string
    assigned_to_user_id?: string
    status?: TicketStatus | string
    priority?: TicketPriority | string
    tags?: string[]
    merge_into_ticket_id?: string
    resolution_message?: string
  }
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  warnings?: string[]
}

// ============================================================
// REAL-TIME INTERFACES
// ============================================================

export interface TicketRealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  ticket_id: string
  source: TicketSource | string
  old_record?: Partial<UnifiedTicket>
  new_record?: Partial<UnifiedTicket>
  timestamp: string
}

export interface RealtimeSubscriptionOptions {
  sources?: (TicketSource | string)[]
  statuses?: (TicketStatus | string)[]
  departments?: (Department | string)[]
  user_id?: string
}

// ============================================================
// NOTIFICATION INTERFACES
// ============================================================

export interface NotificationTemplate {
  id: string
  name: string
  event_type: ActivityActionType | string
  email_subject?: string
  email_body?: string
  sms_body?: string
  push_title?: string
  push_body?: string
  in_app_title?: string
  in_app_body?: string
  slack_message?: string
  teams_message?: string
  available_variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  user_id: string
  channels: {
    [key in NotificationChannel]: boolean
  }
  events: {
    [key in ActivityActionType]?: NotificationChannel[]
  }
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  quiet_hours_timezone: string
  digest_enabled: boolean
  digest_frequency: 'daily' | 'weekly'
  digest_time: string
}

// ============================================================
// AI FEATURES INTERFACES
// ============================================================

export interface AISuggestion {
  id: string
  ticket_id: string
  suggestion_type: 'category' | 'priority' | 'response' | 'assignment' | 'resolution'
  suggested_value: string
  confidence_score: number
  reasoning: string
  source_knowledge_base_ids?: string[]
  source_similar_ticket_ids?: string[]
  is_accepted: boolean | null
  accepted_at: string | null
  rejected_reason: string | null
  created_at: string
}

export interface SentimentAnalysis {
  ticket_id: string
  message_id?: string
  overall_sentiment: 'positive' | 'neutral' | 'negative'
  sentiment_score: number
  emotions: {
    anger: number
    frustration: number
    satisfaction: number
    urgency: number
    confusion: number
  }
  key_phrases: string[]
  entities: { text: string; type: string }[]
  analyzed_at: string
}

// ============================================================
// UTILITY TYPES
// ============================================================

export type Ticket = EmployeeTicket | CustomerTicket | PartnerTicket
export type TicketCategory = EmployeeTicketCategory | CustomerTicketCategory | PartnerTicketCategory

// Status labels for display
export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_requester: 'Awaiting Response',
  pending_internal: 'Pending Internal',
  pending_third_party: 'Pending Third Party',
  on_hold: 'On Hold',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
  cancelled: 'Cancelled'
}

// Priority labels for display
export const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

// SLA default hours by priority
export const DEFAULT_SLA_HOURS: Record<string, { first_response: number; resolution: number }> = {
  urgent: { first_response: 1, resolution: 4 },
  high: { first_response: 2, resolution: 8 },
  medium: { first_response: 4, resolution: 24 },
  low: { first_response: 8, resolution: 48 }
}

// Department labels
export const DEPARTMENT_LABELS: Record<string, string> = {
  hr: 'Human Resources',
  finance: 'Finance',
  accounts: 'Accounts',
  it: 'IT',
  technical_support: 'Technical Support',
  customer_support: 'Customer Support',
  partner_support: 'Partner Support',
  compliance: 'Compliance',
  legal: 'Legal',
  operations: 'Operations',
  management: 'Management',
  super_admin: 'Super Admin'
}
