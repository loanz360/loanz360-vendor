/**
 * Unified Ticket System Types
 * Shared types across all portals and ticket sources
 */

// ========================
// CORE TICKET TYPES
// ========================

export type TicketSource = 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TicketStatus =
  | 'new'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending_customer'
  | 'pending_partner'
  | 'pending_internal'
  | 'on_hold'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'escalated'

export type RequesterType = 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER'

// ========================
// UNIFIED TICKET
// ========================

export interface UnifiedTicket {
  // Identity
  id: string
  ticket_source: TicketSource
  unified_ticket_id: string
  ticket_number: string

  // Content
  subject: string
  description: string
  category: string
  priority: TicketPriority
  status: TicketStatus

  // Requester
  requester_id: string
  requester_type: RequesterType
  requester_name: string
  requester_email: string
  requester_phone?: string | null
  requester_avatar?: string | null

  // Assignment
  assigned_to_id?: string | null
  assigned_to_name?: string | null
  assigned_department?: string | null

  // Flags
  is_anonymous: boolean
  is_confidential: boolean
  requires_urgent_attention?: boolean

  // Escalation
  escalation_level: number
  is_escalated?: boolean
  escalated_at?: string | null
  escalated_to_id?: string | null
  escalation_reason?: string | null

  // SLA
  sla_deadline?: string | null
  sla_breached: boolean
  sla_policy_id?: string | null

  // Timestamps
  first_response_at?: string | null
  resolved_at?: string | null
  closed_at?: string | null
  created_at: string
  updated_at: string

  // Metrics
  response_time_hours?: number | null
  resolution_time_hours?: number | null
  reopened_count: number

  // Satisfaction
  satisfaction_rating?: number | null
  satisfaction_feedback?: string | null

  // Counts (optional, from joins)
  message_count?: number
  unread_count?: number
  attachment_count?: number
}

// ========================
// TICKET MESSAGE
// ========================

export type MessageType = 'text' | 'file' | 'system' | 'internal_note'
export type SenderType = 'employee' | 'customer' | 'partner' | 'super_admin' | 'system'

export interface TicketMessage {
  id: string
  ticket_id: string

  // Sender
  sender_id: string
  sender_type: SenderType
  sender_name: string
  sender_role?: string
  sender_avatar?: string

  // Content
  message: string
  message_type: MessageType

  // Threading
  parent_message_id?: string | null

  // State
  is_internal: boolean
  is_edited: boolean
  is_deleted: boolean
  edited_at?: string | null

  // Read tracking
  is_read_by_requester?: boolean
  is_read_by_agent?: boolean

  // Timestamps
  created_at: string
  updated_at?: string
}

// ========================
// TICKET ATTACHMENT
// ========================

export interface TicketAttachment {
  id: string
  ticket_id: string
  message_id?: string | null

  // File info
  file_name: string
  file_url: string
  file_type: string
  file_size: number

  // Uploader
  uploaded_by: string
  uploaded_by_type: SenderType
  uploaded_by_name?: string

  // Preview
  thumbnail_url?: string
  preview_available?: boolean

  created_at: string
}

// ========================
// ACTIVITY LOG
// ========================

export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'reassigned'
  | 'replied'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'department_routed'
  | 'viewed'
  | 'attachment_added'
  | 'internal_note_added'
  | 'satisfaction_rated'
  | 'sla_warning'
  | 'sla_breach'
  | 'tag_added'
  | 'tag_removed'
  | 'watcher_added'

export interface TicketActivity {
  id: string
  ticket_id: string

  // Action
  action_type: ActivityType
  action_by: string
  action_by_type: SenderType
  action_by_name: string

  // Change details
  field_changed?: string
  old_value?: string
  new_value?: string
  description?: string

  created_at: string
}

// ========================
// SLA & ESCALATION
// ========================

export interface SLAPolicy {
  id: string
  policy_name: string
  policy_code: string
  description?: string

  ticket_sources: TicketSource[]
  categories?: string[]
  priorities: TicketPriority[]

  first_response_minutes: number
  resolution_minutes: number

  escalation_enabled: boolean
  escalation_after_minutes?: number
  max_escalation_level: number

  use_business_hours: boolean
  business_hours_start: string
  business_hours_end: string
  business_days: number[]
  exclude_holidays: boolean

  is_active: boolean
  is_default: boolean
}

export interface EscalationLevel {
  level: number
  to_role: string
  to_user_ids?: string[]
  after_minutes: number
  notification_channels: string[]
}

export interface EscalationMatrix {
  id: string
  matrix_name: string
  matrix_code: string

  ticket_sources: TicketSource[]
  departments?: string[]
  categories?: string[]

  levels: EscalationLevel[]

  is_active: boolean
}

// ========================
// CANNED RESPONSES
// ========================

export interface CannedResponse {
  id: string
  title: string
  category: string
  department?: string
  response_text: string

  is_active: boolean
  usage_count: number
  last_used_at?: string

  created_by: string
  created_at: string
}

// ========================
// TAGS
// ========================

export type TagType = 'system' | 'custom' | 'ai' | 'automation'

export interface TicketTag {
  id: string
  tag_name: string
  tag_slug: string
  tag_color: string
  description?: string
  tag_type: TagType
  is_active: boolean
  usage_count: number
}

export interface TicketTagAssignment {
  id: string
  ticket_id: string
  ticket_type: TicketSource
  tag_id: string
  tag?: TicketTag
  assigned_by?: string
  assigned_by_type?: string
  confidence_score?: number
  created_at: string
}

// ========================
// WATCHERS
// ========================

export interface TicketWatcher {
  id: string
  ticket_id: string
  ticket_type: TicketSource
  watcher_id: string
  watcher_type: SenderType
  watcher_name?: string

  notify_on_update: boolean
  notify_on_message: boolean
  notify_on_status_change: boolean
  notify_on_assignment: boolean

  added_by?: string
  added_reason?: string

  created_at: string
}

// ========================
// RELATIONSHIPS
// ========================

export type RelationshipType =
  | 'parent_child'
  | 'duplicate'
  | 'related'
  | 'caused_by'
  | 'blocks'
  | 'split_from'
  | 'merged_into'

export interface TicketRelationship {
  id: string
  source_ticket_id: string
  source_ticket_type: TicketSource
  related_ticket_id: string
  related_ticket_type: TicketSource
  relationship_type: RelationshipType
  notes?: string
  created_by: string
  created_at: string
}

// ========================
// KNOWLEDGE BASE
// ========================

export interface KBCategory {
  id: string
  category_name: string
  category_slug: string
  description?: string
  icon?: string
  parent_id?: string
  display_order: number
  is_public: boolean
  visible_to_roles?: string[]
  is_active: boolean
  article_count: number
}

export interface KBArticle {
  id: string
  article_number: string
  title: string
  slug: string
  summary?: string
  content: string
  content_format: 'markdown' | 'html' | 'rich_text'

  category_id?: string
  category?: KBCategory
  tags?: string[]
  keywords?: string[]

  is_public: boolean
  visible_to_roles?: string[]
  visible_to_ticket_sources?: TicketSource[]

  status: 'draft' | 'review' | 'published' | 'archived'
  published_at?: string

  view_count: number
  helpful_count: number
  not_helpful_count: number

  created_by: string
  created_at: string
  updated_at: string
}

// ========================
// AI PREDICTIONS
// ========================

export interface TicketAIPrediction {
  id: string
  ticket_id: string
  ticket_type: TicketSource

  predicted_category?: string
  category_confidence?: number

  predicted_priority?: TicketPriority
  priority_confidence?: number

  predicted_department?: string
  department_confidence?: number

  sentiment_score?: number
  sentiment_label?: 'negative' | 'neutral' | 'positive'

  urgency_score?: number

  similar_ticket_ids?: string[]
  duplicate_ticket_id?: string
  duplicate_confidence?: number

  suggested_response_ids?: string[]
  suggested_article_ids?: string[]

  predicted_resolution_hours?: number
  escalation_probability?: number

  model_version?: string
  prediction_timestamp: string

  was_category_correct?: boolean
  was_priority_correct?: boolean
  feedback_given_at?: string
}

// ========================
// AUTOMATION
// ========================

export type TriggerEvent =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'priority_changed'
  | 'assigned'
  | 'message_added'
  | 'sla_warning'
  | 'sla_breach'
  | 'time_based'

export type ActionType =
  | 'assign_to'
  | 'route_to_department'
  | 'set_priority'
  | 'set_status'
  | 'add_tag'
  | 'remove_tag'
  | 'add_watcher'
  | 'send_notification'
  | 'send_email'
  | 'send_sms'
  | 'escalate'
  | 'add_internal_note'
  | 'run_webhook'

export interface AutomationCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'greater_than' | 'less_than'
  value: unknown}

export interface AutomationAction {
  type: ActionType
  value?: unknown  template?: string
  channel?: string
}

export interface AutomationRule {
  id: string
  rule_name: string
  rule_code: string
  description?: string

  trigger_event: TriggerEvent
  ticket_sources: TicketSource[]

  conditions: {
    all?: AutomationCondition[]
    any?: AutomationCondition[]
  }

  actions: AutomationAction[]

  execution_order: number
  stop_processing: boolean

  schedule_cron?: string
  last_executed_at?: string

  is_active: boolean
  execution_count: number

  created_by: string
  created_at: string
}

// ========================
// ANALYTICS
// ========================

export interface TicketMetrics {
  total: number
  open: number
  resolved: number
  avg_resolution_hours: number
  avg_response_hours: number
  sla_compliance_rate: number
  customer_satisfaction: number
}

export interface TicketAnalytics {
  overview: TicketMetrics
  by_source: Record<TicketSource, { total: number; open: number; resolved: number }>
  by_priority: Record<TicketPriority, number>
  by_status: Record<string, number>
  by_category: Record<string, number>
  by_department: Record<string, number>
  trends: {
    daily: Array<{ date: string; created: number; resolved: number }>
    weekly: Array<{ week: string; created: number; resolved: number }>
  }
  sla: {
    total_tracked: number
    breached: number
    met: number
    at_risk: number
    compliance_rate: number
  }
  top_categories: Array<{ category: string; count: number }>
  agent_performance: Array<{
    agent_id: string
    agent_name?: string
    tickets_resolved: number
    avg_resolution_minutes: number
    sla_compliance_rate: number
    satisfaction_avg: number
  }>
}

// ========================
// FILTERS & SORTING
// ========================

export interface TicketFilters {
  sources?: TicketSource[]
  status?: TicketStatus[]
  priority?: TicketPriority[]
  category?: string[]
  department?: string[]
  assigned_to?: string
  requester_id?: string
  tags?: string[]
  search?: string
  date_from?: string
  date_to?: string
  sla_breached?: boolean
  escalated?: boolean
  unassigned?: boolean
  confidential?: boolean
}

export interface TicketSorting {
  field: keyof UnifiedTicket
  direction: 'asc' | 'desc'
}

export interface TicketPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

// ========================
// API RESPONSES
// ========================

export interface TicketListResponse {
  tickets: UnifiedTicket[]
  counts: {
    total: number
    by_source: Record<TicketSource, number>
    by_status: Record<string, number>
    by_priority: Record<TicketPriority, number>
    sla_breached: number
    unassigned: number
    urgent: number
  }
  pagination: TicketPagination
}

export interface TicketDetailResponse {
  ticket: UnifiedTicket
  messages: TicketMessage[]
  attachments: TicketAttachment[]
  activityLog: TicketActivity[]
  internalNotes?: TicketMessage[]
  relatedTickets: TicketRelationship[]
  tags: TicketTagAssignment[]
  watchers: TicketWatcher[]
  aiPredictions?: TicketAIPrediction
  suggestedArticles?: KBArticle[]
}

export interface TicketCreateRequest {
  subject: string
  description: string
  category: string
  priority?: TicketPriority
  is_confidential?: boolean
  requires_urgent_attention?: boolean
  attachments?: File[]
  loan_application_id?: string
  custom_fields?: Record<string, unknown>
}

export interface TicketUpdateRequest {
  status?: TicketStatus
  priority?: TicketPriority
  category?: string
  assigned_to_id?: string
  routed_to_department?: string
  escalation_level?: number
  is_confidential?: boolean
  resolution_notes?: string
  tags?: string[]
}

export interface MessageCreateRequest {
  message: string
  message_type?: MessageType
  is_internal?: boolean
  parent_message_id?: string
  attachments?: File[]
}

// ========================
// UI HELPERS
// ========================

export const PRIORITY_COLORS: Record<TicketPriority, { bg: string; text: string; border: string }> = {
  urgent: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' }
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  open: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  assigned: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  pending_customer: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  pending_partner: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  pending_internal: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  on_hold: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  resolved: { bg: 'bg-green-500/10', text: 'text-green-400' },
  closed: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
  reopened: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  escalated: { bg: 'bg-red-500/10', text: 'text-red-400' }
}

export const SOURCE_COLORS: Record<TicketSource, { bg: string; text: string }> = {
  EMPLOYEE: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  CUSTOMER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  PARTNER: { bg: 'bg-amber-500/10', text: 'text-amber-400' }
}

export const formatPriority = (priority: TicketPriority): string => {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

export const formatStatus = (status: string): string => {
  return status.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

export const formatSource = (source: TicketSource): string => {
  return source.charAt(0) + source.slice(1).toLowerCase()
}

export const getSLAStatus = (ticket: UnifiedTicket): 'ok' | 'warning' | 'breached' | 'na' => {
  if (!ticket.sla_deadline) return 'na'
  if (ticket.sla_breached) return 'breached'

  const deadline = new Date(ticket.sla_deadline)
  const now = new Date()
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursRemaining <= 0) return 'breached'
  if (hoursRemaining <= 2) return 'warning'
  return 'ok'
}

export const formatTimeAgo = (date: string | Date): string => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return past.toLocaleDateString()
}
