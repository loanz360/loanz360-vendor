/**
 * ULAP Lead Module Types
 * Centralized type definitions for the reusable ULAP Lead Module
 */

// Module context types - determines which portal is using the module
export type ULAPModuleContext =
  | 'BA'                    // Business Associate
  | 'BP'                    // Business Partner
  | 'CRO'                   // Customer Relationship Officer
  | 'DSE'                   // Direct Sales Executive
  | 'DIGITAL_SALES'         // Digital Sales
  | 'TELECALLER'            // Telecaller
  | 'FIELD_SALES'           // Field Sales
  | 'BDE'                   // Business Development Executive
  | 'CUSTOMER_SELF'         // Customer self-apply (My Applications)
  | 'CUSTOMER_REFERRAL'     // Customer referral

// Source types for lead attribution
export type ULAPSourceType =
  | 'ULAP_BA'
  | 'ULAP_BP'
  | 'ULAP_CRO'
  | 'ULAP_DSE'
  | 'ULAP_DIGITAL_SALES'
  | 'ULAP_TELECALLER'
  | 'ULAP_FIELD_SALES'
  | 'ULAP_BDE'
  | 'ULAP_CUSTOMER'
  | 'ULAP_CUSTOMER_REFERRAL'

// Module configuration interface
export interface ULAPModuleConfig {
  // Feature flags
  showSubmitLead: boolean
  showShareLink: boolean
  showLeadStatus: boolean

  // Source tracking
  sourceType: ULAPSourceType

  // Labels (customizable per context)
  labels: {
    moduleTitle: string
    submitTabLabel: string
    shareTabLabel: string
    statusTabLabel: string
    submitButtonLabel: string
    successMessage: string
  }

  // Share link settings
  shareLinkExpiry: number // days (default: 30)

  // Tab configuration
  defaultTab: 'submit' | 'share' | 'status'
}

// Module props
export interface ULAPLeadModuleProps {
  context: ULAPModuleContext
  className?: string
  defaultTab?: 'submit' | 'share' | 'status'
  onLeadSubmitted?: (leadId: string, leadNumber: string) => void
  onLinkGenerated?: (link: string) => void
}

// User context from session
export interface ULAPUserContext {
  userId: string
  userName: string
  userEmail?: string
  userMobile?: string
  userRole: string
  userSubrole?: string
  partnerId?: string      // For BA/BP
  partnerName?: string    // For BA/BP
  employeeId?: string     // For employees
  customerId?: string     // For customers
}

// Lead submission data
export interface ULAPLeadSubmission {
  // Customer information
  customer_name: string
  customer_mobile: string
  customer_email?: string
  customer_city?: string
  customer_state?: string
  customer_pincode?: string

  // Loan information
  loan_type: string
  loan_category_id?: string
  loan_subcategory_id?: string
  required_loan_amount?: number

  // Source attribution (auto-filled by module)
  source_type: ULAPSourceType
  source_user_id: string
  source_user_name: string
  source_partner_id?: string
  source_partner_name?: string
  trace_token?: string

  // Additional fields from dynamic form
  collected_data?: Record<string, unknown>
}

// Share link data
export interface ULAPShareLink {
  id: string
  short_code: string
  full_url: string
  trace_token: string // Encoded, hidden from user
  created_at: string
  expires_at: string
  is_active: boolean
  open_count: number
  conversion_count: number
  created_by_id: string
  created_by_name: string
  source_type: ULAPSourceType
}

// Lead status item (for status tab)
export interface ULAPLeadStatusItem {
  id: string
  lead_id: string
  lead_number: string
  customer_name: string
  customer_mobile: string
  loan_type: string
  loan_amount?: number
  lead_status: string
  form_status: string
  created_at: string
  updated_at: string
  phase2_completed: boolean
  assigned_bde_name?: string
}

// API response types
export interface ULAPSubmitResponse {
  success: boolean
  lead_id?: string
  lead_number?: string
  phase2_url?: string
  error?: string
}

export interface ULAPLeadsResponse {
  leads: ULAPLeadStatusItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ULAPShareLinkResponse {
  success: boolean
  link?: ULAPShareLink
  error?: string
}

// Filter options for status tab
export interface ULAPLeadFilters {
  status?: string
  loan_type?: string
  date_from?: string
  date_to?: string
  search?: string
}
