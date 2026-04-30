/**
 * Chatbot System TypeScript Types
 * Complete type definitions for the chatbot management system
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export type ChatbotStatus = 'draft' | 'active' | 'paused' | 'archived'

export type AssignmentMode = 'round_robin' | 'location_based' | 'load_balanced' | 'manual' | 'specific_employee'

export type NodeType =
  | 'start'
  | 'message'
  | 'question'
  | 'condition'
  | 'action'
  | 'end'
  | 'text_input'
  | 'email_input'
  | 'phone_input'
  | 'number_input'
  | 'single_choice'
  | 'multiple_choice'
  | 'date_input'
  | 'file_upload'
  | 'rating_input'
  | 'location_input'

export type SessionStatus = 'active' | 'completed' | 'abandoned' | 'transferred'

export type MessageSenderType = 'bot' | 'visitor' | 'system'

export type MessageType =
  | 'text'
  | 'question'
  | 'response'
  | 'file'
  | 'system'
  | 'typing'
  | 'options'
  | 'error'
  | 'welcome'
  | 'thank_you'

export type OnlineLeadStatus =
  | 'new'
  | 'contacted'
  | 'follow_up'
  | 'qualified'
  | 'not_interested'
  | 'converted'
  | 'dropped'
  | 'duplicate'

export type OnlineLeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'docs_pending'
  | 'ready_to_convert'

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent'

export type LeadQuality = 'unknown' | 'cold' | 'warm' | 'hot'

export type EmploymentType = 'salaried' | 'self_employed' | 'business' | 'professional' | 'retired' | 'student' | 'other'

export type BubblePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export type BubbleSize = 'small' | 'medium' | 'large'

// ============================================================================
// CHATBOT THEME
// ============================================================================

export interface ChatbotTheme {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  bubblePosition: BubblePosition
  bubbleSize: BubbleSize
  avatarUrl: string | null
  botName: string
  welcomeMessage: string
  typingIndicatorEnabled: boolean
  typingDelayMs: number
  fontFamily: string
}

// ============================================================================
// CHATBOT SETTINGS
// ============================================================================

export interface ChatbotSettings {
  proactiveEnabled: boolean
  proactiveDelaySeconds: number
  proactiveMessage: string
  preChatFormEnabled: boolean
  preChatFields: string[]
  showReferenceNumber: boolean
  thankYouMessage: string
  thankYouButtonText: string
  allowRestart: boolean
  multiLanguageEnabled: boolean
  defaultLanguage: string
  languages: string[]
  offlineMessage: string
  sessionTimeoutMinutes: number
}

// ============================================================================
// ASSIGNMENT RULES
// ============================================================================

export interface AssignmentRules {
  maxLeadsPerEmployee: number | null
  workingHoursOnly: boolean
  workingHoursStart: string
  workingHoursEnd: string
  fallbackEmployeeId: string | null
}

// ============================================================================
// CHATBOT
// ============================================================================

export interface Chatbot {
  id: string
  name: string
  description: string | null
  status: ChatbotStatus
  theme: ChatbotTheme
  settings: ChatbotSettings
  track_utm: boolean
  track_device: boolean
  track_location: boolean
  track_page_url: boolean
  track_referrer: boolean
  assignment_mode: AssignmentMode
  assignment_rules: AssignmentRules
  default_assignee_id: string | null
  embed_domains: string[]
  embed_code: string | null
  wordpress_plugin_key: string | null
  api_key: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  total_sessions: number
  total_completions: number
  total_leads: number
  completion_rate: number
}

export interface ChatbotCreateInput {
  name: string
  description?: string
  status?: ChatbotStatus
  theme?: Partial<ChatbotTheme>
  settings?: Partial<ChatbotSettings>
  assignment_mode?: AssignmentMode
  assignment_rules?: Partial<AssignmentRules>
  default_assignee_id?: string
  embed_domains?: string[]
}

export interface ChatbotUpdateInput extends Partial<ChatbotCreateInput> {
  id: string
}

// ============================================================================
// CHATBOT FLOW
// ============================================================================

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasData {
  nodes: FlowNodeData[]
  edges: FlowEdgeData[]
  viewport: CanvasViewport
}

export interface ChatbotFlow {
  id: string
  chatbot_id: string
  name: string
  description: string | null
  version: number
  is_published: boolean
  is_default: boolean
  canvas_data: CanvasData
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface ChatbotFlowCreateInput {
  chatbot_id: string
  name: string
  description?: string
  is_default?: boolean
}

// ============================================================================
// FLOW NODES
// ============================================================================

export interface ValidationRules {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  customError?: string
}

export interface ChoiceOption {
  id: string
  label: string
  value: string
  icon?: string
}

export interface ConditionalBranch {
  id: string
  label: string
  targetNodeId: string
  condition?: {
    field: string
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
    value: string | number | boolean
  }
}

// Base node content
export interface BaseNodeContent {
  type: NodeType
}

// Start node
export interface StartNodeContent extends BaseNodeContent {
  type: 'start'
  welcomeMessage?: string
}

// Message node
export interface MessageNodeContent extends BaseNodeContent {
  type: 'message'
  text: string
  delay?: number
  showTyping?: boolean
}

// Question node base
export interface QuestionNodeContent extends BaseNodeContent {
  question: string
  placeholder?: string
  required?: boolean
  validation?: ValidationRules
  fieldMapping?: string // Maps to online_leads field
  helpText?: string
}

// Text input
export interface TextInputNodeContent extends QuestionNodeContent {
  type: 'text_input'
  multiline?: boolean
  rows?: number
}

// Email input
export interface EmailInputNodeContent extends QuestionNodeContent {
  type: 'email_input'
}

// Phone input
export interface PhoneInputNodeContent extends QuestionNodeContent {
  type: 'phone_input'
  countryCode?: string
  allowInternational?: boolean
}

// Number input
export interface NumberInputNodeContent extends QuestionNodeContent {
  type: 'number_input'
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  format?: 'currency' | 'percentage' | 'plain'
}

// Single choice
export interface SingleChoiceNodeContent extends QuestionNodeContent {
  type: 'single_choice'
  options: ChoiceOption[]
  displayAs?: 'buttons' | 'dropdown' | 'cards'
}

// Multiple choice
export interface MultipleChoiceNodeContent extends QuestionNodeContent {
  type: 'multiple_choice'
  options: ChoiceOption[]
  minSelections?: number
  maxSelections?: number
}

// Date input
export interface DateInputNodeContent extends QuestionNodeContent {
  type: 'date_input'
  minDate?: string
  maxDate?: string
  disablePast?: boolean
  disableFuture?: boolean
}

// File upload
export interface FileUploadNodeContent extends QuestionNodeContent {
  type: 'file_upload'
  allowedTypes?: string[] // ['pdf', 'jpg', 'png', 'doc']
  maxSizeMB?: number
  multiple?: boolean
  maxFiles?: number
}

// Rating input
export interface RatingInputNodeContent extends QuestionNodeContent {
  type: 'rating_input'
  maxRating?: number
  icon?: 'star' | 'heart' | 'thumb'
  labels?: { [key: number]: string }
}

// Location input
export interface LocationInputNodeContent extends QuestionNodeContent {
  type: 'location_input'
  showCity?: boolean
  showState?: boolean
  showPincode?: boolean
  states?: string[]
}

// Condition node
export interface ConditionNodeContent extends BaseNodeContent {
  type: 'condition'
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: string | number | boolean
  branches: ConditionalBranch[]
}

// Action node
export interface ActionNodeContent extends BaseNodeContent {
  type: 'action'
  actionType: 'end_chat' | 'transfer' | 'api_call' | 'set_variable' | 'send_notification'
  config: Record<string, unknown>
}

// End node
export interface EndNodeContent extends BaseNodeContent {
  type: 'end'
  thankYouMessage?: string
  showReferenceNumber?: boolean
  redirectUrl?: string
  allowRestart?: boolean
}

// Union type for all node content
export type NodeContent =
  | StartNodeContent
  | MessageNodeContent
  | TextInputNodeContent
  | EmailInputNodeContent
  | PhoneInputNodeContent
  | NumberInputNodeContent
  | SingleChoiceNodeContent
  | MultipleChoiceNodeContent
  | DateInputNodeContent
  | FileUploadNodeContent
  | RatingInputNodeContent
  | LocationInputNodeContent
  | ConditionNodeContent
  | ActionNodeContent
  | EndNodeContent

// Flow node for canvas
export interface FlowNodeData {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: NodeContent
  width?: number
  height?: number
}

// Database node record
export interface ChatbotNode {
  id: string
  flow_id: string
  node_id: string
  node_type: NodeType
  position_x: number
  position_y: number
  width: number
  height: number
  content: NodeContent
  next_node_id: string | null
  conditional_next: ConditionalBranch[]
  display_order: number
  created_at: string
  updated_at: string
}

// Flow edge for canvas
export interface FlowEdgeData {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  type?: string
}

// Database edge record
export interface ChatbotEdge {
  id: string
  flow_id: string
  edge_id: string
  source_node_id: string
  target_node_id: string
  source_handle: string
  target_handle: string
  label: string | null
  edge_type: string
  created_at: string
}

// ============================================================================
// CHAT SESSION
// ============================================================================

export interface ChatSession {
  id: string
  chatbot_id: string | null
  flow_id: string | null
  session_token: string
  visitor_id: string | null
  status: SessionStatus
  current_node_id: string | null
  progress_percentage: number
  visitor_data: Record<string, unknown>
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer_url: string | null
  landing_page_url: string | null
  device_type: string | null
  browser: string | null
  browser_version: string | null
  os: string | null
  os_version: string | null
  screen_resolution: string | null
  ip_address: string | null
  geo_country: string | null
  geo_country_code: string | null
  geo_city: string | null
  geo_region: string | null
  geo_postal_code: string | null
  geo_latitude: number | null
  geo_longitude: number | null
  started_at: string
  completed_at: string | null
  last_activity_at: string
  total_duration_seconds: number | null
  is_converted: boolean
  online_lead_id: string | null
  reference_number: string | null
}

export interface ChatSessionCreateInput {
  chatbot_id: string
  visitor_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  referrer_url?: string
  landing_page_url?: string
  device_type?: string
  browser?: string
  os?: string
  ip_address?: string
}

// ============================================================================
// CHAT MESSAGE
// ============================================================================

export interface ChatMessage {
  id: string
  session_id: string
  sender_type: MessageSenderType
  message_type: MessageType
  content: string | null
  node_id: string | null
  field_name: string | null
  response_value: unknown; file_url: string | null
  file_name: string | null
  file_size: number | null
  file_type: string | null
  metadata: Record<string, unknown>
  sent_at: string
}

export interface ChatMessageCreateInput {
  session_id: string
  sender_type: MessageSenderType
  message_type: MessageType
  content?: string
  node_id?: string
  field_name?: string
  response_value?: unknown; file_url?: string
  file_name?: string
  file_size?: number
  file_type?: string
}

// ============================================================================
// ONLINE LEAD
// ============================================================================

export interface OnlineLead {
  id: string
  reference_number: string
  chat_session_id: string | null
  chatbot_id: string | null
  customer_name: string
  phone: string
  alternate_phone: string | null
  email: string | null
  city: string | null
  state: string | null
  pincode: string | null
  address: string | null
  country: string
  loan_type: string | null
  loan_amount: number | null
  loan_purpose: string | null
  loan_tenure_months: number | null
  employment_type: EmploymentType | null
  monthly_income: number | null
  annual_income: number | null
  company_name: string | null
  business_name: string | null
  business_type: string | null
  years_in_business: number | null
  credit_score: number | null
  custom_fields: Record<string, unknown>
  status: OnlineLeadStatus
  stage: OnlineLeadStage
  priority: LeadPriority
  lead_score: number
  lead_quality: LeadQuality
  assigned_to: string | null
  assigned_to_name: string | null
  assigned_at: string | null
  assignment_method: string | null
  source: string
  source_details: Record<string, unknown>
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  landing_page_url: string | null
  referrer_url: string | null
  device_type: string | null
  browser: string | null
  geo_city: string | null
  geo_state: string | null
  next_follow_up_date: string | null
  next_follow_up_time: string | null
  follow_up_notes: string | null
  last_contact_date: string | null
  last_contact_outcome: string | null
  call_count: number
  last_called_at: string | null
  total_call_duration: number
  successful_calls: number
  notes_timeline: OnlineLeadNote[]
  documents: OnlineLeadDocument[]
  is_converted: boolean
  converted_deal_id: string | null
  converted_at: string | null
  converted_by: string | null
  converted_by_name: string | null
  is_dropped: boolean
  dropped_at: string | null
  dropped_by: string | null
  drop_reason: string | null
  drop_notes: string | null
  created_at: string
  updated_at: string
  is_duplicate: boolean
  duplicate_of: string | null
  duplicate_detected_at: string | null
}

export interface OnlineLeadNote {
  id: string
  type: 'ai_transcript' | 'manual_note' | 'system_event'
  timestamp: string
  content?: string
  call_duration?: number
  transcript?: string
  ai_summary?: string
  ai_rating?: number
  sentiment?: 'positive' | 'neutral' | 'negative'
  interest_level?: 'high' | 'medium' | 'low' | 'none'
  key_points?: string[]
  positive_points?: string[]
  improvement_points?: string[]
  is_editable: boolean
  created_by: string
  created_by_name: string
  created_at: string
  event?: string
  details?: Record<string, unknown>
}

export interface OnlineLeadDocument {
  id: string
  name: string
  url: string
  type: string
  size: number
  category?: string
  uploaded_by: string
  uploaded_by_name: string
  uploaded_at: string
}

export interface OnlineLeadCreateInput {
  chat_session_id?: string
  chatbot_id?: string
  customer_name: string
  phone: string
  alternate_phone?: string
  email?: string
  city?: string
  state?: string
  pincode?: string
  address?: string
  loan_type?: string
  loan_amount?: number
  loan_purpose?: string
  employment_type?: EmploymentType
  monthly_income?: number
  business_name?: string
  business_type?: string
  custom_fields?: Record<string, unknown>
  source?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  landing_page_url?: string
  device_type?: string
}

export interface OnlineLeadUpdateInput {
  status?: OnlineLeadStatus
  stage?: OnlineLeadStage
  priority?: LeadPriority
  assigned_to?: string
  next_follow_up_date?: string
  next_follow_up_time?: string
  follow_up_notes?: string
  notes_timeline?: OnlineLeadNote[]
  documents?: OnlineLeadDocument[]
}

// ============================================================================
// LEAD ASSIGNMENT QUEUE
// ============================================================================

export interface LeadAssignmentQueue {
  id: string
  chatbot_id: string
  employee_id: string
  employee_name: string | null
  position: number
  is_active: boolean
  leads_assigned: number
  leads_converted: number
  last_assigned_at: string | null
  max_leads_per_day: number | null
  max_active_leads: number | null
  current_active_leads: number
  available_from: string
  available_until: string
  available_days: number[]
  created_at: string
  updated_at: string
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface ChatbotAnalyticsDaily {
  id: string
  chatbot_id: string
  date: string
  total_sessions: number
  unique_visitors: number
  completed_sessions: number
  abandoned_sessions: number
  avg_session_duration_seconds: number
  avg_messages_per_session: number
  total_leads: number
  qualified_leads: number
  converted_to_deal: number
  conversion_rate: number
  total_messages_sent: number
  total_responses_received: number
  proactive_triggers: number
  proactive_engaged: number
  source_breakdown: Record<string, number>
  loan_type_breakdown: Record<string, number>
  device_breakdown: Record<string, number>
  location_breakdown: Record<string, number>
  node_dropoff_stats: Record<string, { reached: number; dropped: number }>
  hourly_distribution: Record<string, number>
  created_at: string
  updated_at: string
}

export interface ChatbotNodeAnalytics {
  id: string
  chatbot_id: string
  flow_id: string
  node_id: string
  date: string
  times_reached: number
  times_completed: number
  times_dropped: number
  avg_time_spent_seconds: number
  response_distribution: Record<string, number>
  created_at: string
}

export interface DigitalSalesPerformance {
  id: string
  employee_id: string
  employee_name: string | null
  date: string
  leads_assigned: number
  leads_contacted: number
  leads_qualified: number
  leads_converted: number
  leads_dropped: number
  leads_pending: number
  calls_made: number
  calls_connected: number
  calls_missed: number
  total_call_duration: number
  avg_call_duration: number
  avg_first_response_minutes: number | null
  avg_ai_rating: number | null
  total_notes_added: number
  conversion_rate: number
  total_loan_amount_converted: number
  created_at: string
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  has_more: boolean
}

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

export const FIELD_MAPPINGS: Record<string, string> = {
  customer_name: 'Customer Name',
  phone: 'Phone Number',
  alternate_phone: 'Alternate Phone',
  email: 'Email',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  address: 'Address',
  loan_type: 'Loan Type',
  loan_amount: 'Loan Amount',
  loan_purpose: 'Loan Purpose',
  loan_tenure_months: 'Loan Tenure (Months)',
  employment_type: 'Employment Type',
  monthly_income: 'Monthly Income',
  annual_income: 'Annual Income',
  company_name: 'Company Name',
  business_name: 'Business Name',
  business_type: 'Business Type',
  years_in_business: 'Years in Business',
  credit_score: 'Credit Score',
}

export const LOAN_TYPES = [
  'Home Loan',
  'Personal Loan',
  'Business Loan',
  'Working Capital Loan',
  'Loan Against Property',
  'Car Loan',
  'Two Wheeler Loan',
  'Education Loan',
  'Gold Loan',
  'MSME Loan',
  'Machinery Loan',
  'Project Finance',
  'Other',
]

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'salaried', label: 'Salaried' },
  { value: 'self_employed', label: 'Self Employed' },
  { value: 'business', label: 'Business Owner' },
  { value: 'professional', label: 'Professional' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
  { value: 'other', label: 'Other' },
]

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
]
