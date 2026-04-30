// TeleSales Auto Follow-up Sequences Types

// Follow-up Sequence Definition
export interface TSFollowupSequence {
  id: string
  name: string
  description: string | null
  trigger_type: TSFollowupTriggerType
  trigger_conditions: TSFollowupTriggerConditions
  steps: TSFollowupStep[]
  total_steps: number
  max_duration_days: number
  is_active: boolean
  is_default: boolean
  priority: number
  category: string
  stop_on_response: boolean
  stop_on_conversion: boolean
  stop_on_opt_out: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TSFollowupTriggerType = 'CALL_OUTCOME' | 'TIME_BASED' | 'STAGE_CHANGE' | 'MANUAL'

export interface TSFollowupTriggerConditions {
  outcomes?: string[]
  min_attempts?: number
  stages?: string[]
  days_since_last_contact?: number
}

export interface TSFollowupStep {
  step: number
  type: TSFollowupActionType
  delay_hours: number
  description: string
  template?: string
  config?: Record<string, unknown>
}

export type TSFollowupActionType = 'CALL' | 'SMS' | 'EMAIL' | 'WHATSAPP' | 'TASK'

// Follow-up Instance (active sequence for a lead)
export interface TSFollowupInstance {
  id: string
  sequence_id: string
  sales_executive_id: string
  lead_id: string | null
  customer_id: string | null
  phone_number: string | null
  contact_name: string | null
  trigger_call_id: string | null
  trigger_reason: string | null
  current_step: number
  total_steps: number
  status: TSFollowupInstanceStatus
  started_at: string
  next_action_at: string | null
  completed_at: string | null
  stopped_at: string | null
  stop_reason: string | null
  final_outcome: TSFollowupFinalOutcome | null
  total_attempts: number
  successful_contacts: number
  created_at: string
  updated_at: string
  // Joined data
  sequence?: TSFollowupSequence
  actions?: TSFollowupAction[]
}

export type TSFollowupInstanceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'EXPIRED'

export type TSFollowupFinalOutcome = 'CONVERTED' | 'NO_RESPONSE' | 'OPTED_OUT' | 'EXPIRED'

// Follow-up Action (individual action in sequence)
export interface TSFollowupAction {
  id: string
  instance_id: string
  sequence_id: string
  sales_executive_id: string
  step_number: number
  action_type: TSFollowupActionType
  action_config: TSFollowupStep
  scheduled_at: string
  executed_at: string | null
  status: TSFollowupActionStatus
  outcome: string | null
  outcome_notes: string | null
  related_call_id: string | null
  related_task_id: string | null
  related_reminder_id: string | null
  created_at: string
  updated_at: string
}

export type TSFollowupActionStatus = 'PENDING' | 'SCHEDULED' | 'EXECUTED' | 'SKIPPED' | 'FAILED'

// Follow-up Template
export interface TSFollowupTemplate {
  id: string
  name: string
  category: string
  message_template: string | null
  script_template: string | null
  available_variables: string[]
  channel: TSFollowupActionType
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// API Request/Response Types
export interface TSStartSequenceRequest {
  sequence_id: string
  lead_id?: string
  customer_id?: string
  phone_number: string
  contact_name: string
  trigger_reason?: string
}

export interface TSFollowupDashboardStats {
  active_sequences: number
  pending_actions: number
  completed_today: number
  conversion_rate: number
  sequences_by_status: Record<TSFollowupInstanceStatus, number>
  upcoming_actions: TSFollowupAction[]
}

// UI Helper Types
export const FOLLOWUP_ACTION_ICONS: Record<TSFollowupActionType, string> = {
  'CALL': 'phone',
  'SMS': 'message-square',
  'EMAIL': 'mail',
  'WHATSAPP': 'message-circle',
  'TASK': 'clipboard-list'
}

export const FOLLOWUP_STATUS_COLORS: Record<TSFollowupInstanceStatus, { bg: string; text: string }> = {
  'ACTIVE': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'PAUSED': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'COMPLETED': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'STOPPED': { bg: 'bg-red-500/20', text: 'text-red-400' },
  'EXPIRED': { bg: 'bg-gray-500/20', text: 'text-gray-400' }
}

export const FOLLOWUP_ACTION_STATUS_COLORS: Record<TSFollowupActionStatus, { bg: string; text: string }> = {
  'PENDING': { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  'SCHEDULED': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  'EXECUTED': { bg: 'bg-green-500/20', text: 'text-green-400' },
  'SKIPPED': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  'FAILED': { bg: 'bg-red-500/20', text: 'text-red-400' }
}
