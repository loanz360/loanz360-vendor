/**
 * Universal Loan Application Form Module (ULAFM) - TypeScript Types
 * Version: 1.0.0
 *
 * Role-agnostic, traceable loan application system types
 */

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

export type SenderType =
  | 'EMPLOYEE'
  | 'PARTNER'
  | 'BUSINESS_ASSOCIATE'
  | 'CHANNEL_PARTNER'
  | 'CUSTOMER'
  | 'AGENT'
  | 'AFFILIATE'
  | 'SYSTEM'

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'DROPPED'
  | 'EXPIRED'

export type TokenUsageType =
  | 'LINK_CLICK'
  | 'FORM_VIEW'
  | 'FORM_SUBMIT'
  | 'FORM_COMPLETE'

export type AttributionModel =
  | 'FIRST_TOUCH'
  | 'LAST_TOUCH'
  | 'LINEAR'
  | 'TIME_DECAY'

export type SourceMedium =
  | 'WHATSAPP'
  | 'EMAIL'
  | 'SMS'
  | 'QR_CODE'
  | 'SOCIAL_MEDIA'
  | 'WEBSITE'
  | 'DIRECT'
  | 'REFERRAL'
  | 'ORGANIC'

export type LoanType =
  | 'PERSONAL_LOAN'
  | 'BUSINESS_LOAN'
  | 'MORTGAGE_LOAN'
  | 'HOME_LOAN'
  | 'NEW_CAR_LOAN'
  | 'USED_CAR_LOAN'
  | 'REFINANCE'
  | 'BALANCE_TRANSFER'
  | 'TOP_UP_VEHICLE_LOAN'
  | 'WORKING_CAPITAL'
  | 'OVERDRAFT'
  | 'CASH_CREDIT'

export type DeviceType = 'MOBILE' | 'TABLET' | 'DESKTOP'

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'file'

// =====================================================
// LOAN TYPE OPTIONS
// =====================================================

export const LOAN_TYPE_OPTIONS: { value: LoanType; label: string }[] = [
  { value: 'PERSONAL_LOAN', label: 'Personal Loan' },
  { value: 'BUSINESS_LOAN', label: 'Business Loan' },
  { value: 'MORTGAGE_LOAN', label: 'Mortgage Loan' },
  { value: 'HOME_LOAN', label: 'Home Loan' },
  { value: 'NEW_CAR_LOAN', label: 'New Car Loan' },
  { value: 'USED_CAR_LOAN', label: 'Used Car Purchase Loan' },
  { value: 'REFINANCE', label: 'Refinance' },
  { value: 'BALANCE_TRANSFER', label: 'Balance Transfer' },
  { value: 'TOP_UP_VEHICLE_LOAN', label: 'Top-up on Existing Vehicle Loan' },
  { value: 'WORKING_CAPITAL', label: 'Working Capital' },
  { value: 'OVERDRAFT', label: 'OD (Overdraft)' },
  { value: 'CASH_CREDIT', label: 'CC (Cash Credit)' },
]

// =====================================================
// REFERRAL TOKEN TYPES
// =====================================================

export interface SenderHierarchy {
  manager_id?: string
  manager_name?: string
  team_id?: string
  team_name?: string
  branch_id?: string
  branch_name?: string
  region_id?: string
  region_name?: string
  department_id?: string
  department_name?: string
}

export interface ULAFReferralToken {
  id: string
  token: string
  short_code?: string

  // Sender Information
  sender_id: string
  sender_type: SenderType
  sender_subrole?: string
  sender_name?: string
  sender_email?: string
  sender_mobile?: string
  sender_hierarchy?: SenderHierarchy

  // Campaign tracking
  campaign_id?: string
  campaign_name?: string
  source?: SourceMedium
  medium?: string

  // Token configuration
  is_active: boolean
  expires_at?: string
  max_uses?: number
  current_uses: number

  // Security
  ip_whitelist?: string[]
  domain_whitelist?: string[]

  // Metadata
  metadata?: Record<string, unknown>

  // Timestamps
  created_at: string
  updated_at: string
  deactivated_at?: string
  deactivation_reason?: string
}

export interface CreateTokenRequest {
  sender_type: SenderType
  sender_subrole?: string
  sender_name?: string
  sender_email?: string
  sender_mobile?: string
  sender_hierarchy?: SenderHierarchy

  campaign_id?: string
  campaign_name?: string
  source?: SourceMedium
  medium?: string

  expires_at?: string
  max_uses?: number

  metadata?: Record<string, unknown>
}

export interface CreateTokenResponse {
  success: boolean
  token?: ULAFReferralToken
  share_url?: string
  short_url?: string
  qr_code_url?: string
  error?: string
}

export interface ValidateTokenResponse {
  is_valid: boolean
  token_id?: string
  sender_id?: string
  sender_type?: SenderType
  sender_subrole?: string
  sender_name?: string
  sender_hierarchy?: SenderHierarchy
  campaign_id?: string
  error_message?: string
}

// =====================================================
// APPLICATION TYPES
// =====================================================

export interface ClientLocation {
  country?: string
  region?: string
  city?: string
  coordinates?: {
    latitude: number
    longitude: number
  }
}

export interface ULAFApplication {
  id: string
  application_id: string

  // Customer Details
  customer_full_name: string
  customer_mobile: string
  customer_email?: string

  // Loan Requirements
  loan_type: LoanType
  loan_amount?: number
  loan_purpose?: string

  // Additional fields (extensible)
  additional_fields?: Record<string, unknown>

  // Status
  status: ApplicationStatus
  status_reason?: string

  // Verification
  mobile_verified: boolean
  mobile_verified_at?: string
  email_verified: boolean
  email_verified_at?: string

  // Customer account
  customer_id?: string

  // Lead conversion
  lead_id?: string
  converted_at?: string

  // Client Information
  client_ip?: string
  client_user_agent?: string
  client_device_type?: DeviceType
  client_browser?: string
  client_os?: string
  client_location?: ClientLocation

  // Consent
  terms_accepted: boolean
  terms_accepted_at?: string
  privacy_accepted: boolean
  privacy_accepted_at?: string
  marketing_consent: boolean

  // Metadata
  metadata?: Record<string, unknown>

  // Timestamps
  created_at: string
  updated_at: string
  submitted_at: string
}

export interface ULAFApplicationSource {
  id: string
  application_id: string

  // Source token
  token_id?: string
  token_value?: string

  // Sender attribution
  sender_id: string
  sender_type: SenderType
  sender_subrole?: string
  sender_name?: string
  sender_email?: string
  sender_mobile?: string
  sender_hierarchy_snapshot?: SenderHierarchy

  // Campaign
  campaign_id?: string
  campaign_name?: string
  source?: string
  medium?: string

  // UTM parameters
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string

  // Landing page
  landing_page_url?: string
  referrer_url?: string

  // Attribution
  attribution_weight: number
  attribution_model: AttributionModel

  created_at: string
}

export interface ULAFStatusHistory {
  id: string
  application_id: string
  from_status?: ApplicationStatus
  to_status: ApplicationStatus
  change_reason?: string
  changed_by_id?: string
  changed_by_type?: string
  changed_by_name?: string
  change_metadata?: Record<string, unknown>
  created_at: string
}

// =====================================================
// FORM CONFIGURATION TYPES
// =====================================================

export interface FormFieldConfig {
  name: string
  type: FieldType
  label: string
  required: boolean
  placeholder?: string
  validation?: string
  min?: number
  max?: number
  options?: { value: string; label: string }[]
  default_value?: unknown
  help_text?: string
  conditional?: {
    field: string
    value: unknown
  }
}

export interface FormTheme {
  primary_color?: string
  secondary_color?: string
  background_color?: string
  text_color?: string
  font_family?: string
  border_radius?: string
  logo_url?: string
}

export interface ULAFFormConfig {
  id: string
  config_key: string
  config_name: string
  allowed_sender_types?: SenderType[]

  fields_config: FormFieldConfig[]
  loan_types: { value: LoanType; label: string }[]
  validation_rules?: Record<string, unknown>

  theme?: FormTheme
  header_text?: string
  subheader_text?: string
  submit_button_text: string
  success_message?: string

  require_mobile_otp: boolean
  require_email_verification: boolean
  require_terms_acceptance: boolean
  allow_marketing_consent: boolean

  is_active: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface SubmitApplicationRequest {
  // Token for attribution
  token?: string

  // Customer details
  customer_full_name: string
  customer_mobile: string
  customer_email?: string

  // Loan details
  loan_type: LoanType
  loan_amount?: number
  loan_purpose?: string

  // Additional fields
  additional_fields?: Record<string, unknown>

  // Consent
  terms_accepted: boolean
  privacy_accepted?: boolean
  marketing_consent?: boolean

  // UTM parameters (optional)
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

export interface SubmitApplicationResponse {
  success: boolean
  application_id?: string
  application?: ULAFApplication
  message?: string
  next_steps?: {
    verify_mobile?: boolean
    verify_email?: boolean
    upload_documents?: boolean
    track_url?: string
  }
  error?: string
  validation_errors?: Record<string, string[]>
}

export interface GetApplicationsRequest {
  page?: number
  limit?: number
  status?: ApplicationStatus
  loan_type?: LoanType
  date_from?: string
  date_to?: string
  search?: string
  sender_id?: string
  sender_type?: SenderType
}

export interface GetApplicationsResponse {
  success: boolean
  data?: ULAFApplication[]
  sources?: Record<string, ULAFApplicationSource>
  pagination?: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
  error?: string
}

export interface GetSenderStatsRequest {
  sender_id: string
  date_from?: string
  date_to?: string
}

export interface SenderStats {
  total_tokens_created: number
  active_tokens: number
  total_applications: number
  applications_submitted: number
  applications_approved: number
  applications_rejected: number
  applications_converted: number
  conversion_rate: number
}

export interface GetSenderStatsResponse {
  success: boolean
  stats?: SenderStats
  error?: string
}

// =====================================================
// TOKEN USAGE LOG TYPES
// =====================================================

export interface ULAFTokenUsageLog {
  id: string
  token_id?: string
  token_value?: string
  usage_type: TokenUsageType
  application_id?: string
  client_ip?: string
  client_user_agent?: string
  client_device_type?: DeviceType
  session_id?: string
  created_at: string
}

export interface LogTokenUsageRequest {
  token_id?: string
  token_value?: string
  usage_type: TokenUsageType
  application_id?: string
  session_id?: string
}

// =====================================================
// ANALYTICS TYPES
// =====================================================

export interface SenderFunnelData {
  sender_id: string
  sender_type: SenderType
  sender_subrole?: string
  sender_name?: string
  application_date: string
  total_applications: number
  submitted: number
  in_review: number
  approved: number
  rejected: number
  converted: number
  conversion_rate: number
}

export interface TokenPerformanceData {
  token_id: string
  short_code?: string
  sender_id: string
  sender_type: SenderType
  sender_name?: string
  campaign_id?: string
  source?: string
  is_active: boolean
  token_created_at: string
  link_clicks: number
  form_views: number
  form_submits: number
  applications: number
  conversions: number
  click_to_application_rate: number
}

// =====================================================
// SHARE LINK TYPES
// =====================================================

export interface GenerateShareLinkRequest {
  sender_type: SenderType
  sender_subrole?: string
  campaign_id?: string
  campaign_name?: string
  source?: SourceMedium
  expires_in_days?: number
  max_uses?: number
}

export interface ShareLinkData {
  full_url: string
  short_url: string
  short_code: string
  qr_code_data_url?: string
  expires_at?: string
  token: ULAFReferralToken
}

export interface GenerateShareLinkResponse {
  success: boolean
  data?: ShareLinkData
  error?: string
}

// =====================================================
// COMPONENT PROPS TYPES
// =====================================================

export interface UniversalLoanFormProps {
  token?: string
  config_key?: string
  onSuccess?: (application: ULAFApplication) => void
  onError?: (error: string) => void
  className?: string
  showHeader?: boolean
  showBenefits?: boolean
  theme?: Partial<FormTheme>
}

export interface ShareLoanFormButtonProps {
  sender_type: SenderType
  sender_subrole?: string
  campaign_id?: string
  campaign_name?: string
  source?: SourceMedium
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onShareSuccess?: (data: ShareLinkData) => void
  onShareError?: (error: string) => void
}

export interface ApplicationListProps {
  sender_id?: string
  show_source?: boolean
  show_actions?: boolean
  page_size?: number
  className?: string
}

export interface ApplicationDetailProps {
  application_id: string
  show_history?: boolean
  show_source?: boolean
  className?: string
}
