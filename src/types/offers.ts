/**
 * Type definitions for Offers to Customers module
 */

/**
 * User roles enum - normalized to uppercase for consistency
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  HR = 'HR',
  PARTNER = 'PARTNER',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR'
}

/**
 * Role permissions for offers module
 */
export interface OfferPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canShare: boolean
  canTrack: boolean
  canViewAnalytics: boolean
  canManageAll: boolean
  canApprove: boolean
  canExport: boolean
  showDrafts: boolean
  showScheduled: boolean
  showRecommendations?: boolean
  showPerformanceStats?: boolean
  canViewPersonalAnalytics?: boolean
  canViewTeamStats?: boolean
  prioritySupport?: boolean
}

/**
 * Role-based permissions configuration
 */
export const OFFER_ROLE_PERMISSIONS: Record<UserRole, OfferPermissions> = {
  [UserRole.SUPER_ADMIN]: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canShare: true,
    canTrack: true,
    canViewAnalytics: true,
    canManageAll: true,
    canApprove: true,
    canExport: true,
    showDrafts: true,
    showScheduled: true
  },
  [UserRole.ADMIN]: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canShare: true,
    canTrack: true,
    canViewAnalytics: true,
    canManageAll: false,
    canApprove: true,
    canExport: true,
    showDrafts: true,
    showScheduled: true
  },
  [UserRole.EMPLOYEE]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canShare: true,
    canTrack: true,
    canViewAnalytics: false,
    canManageAll: false,
    canApprove: false,
    canExport: false,
    showDrafts: false,
    showScheduled: false
  },
  [UserRole.HR]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canShare: true,
    canTrack: true,
    canViewAnalytics: true,
    canManageAll: false,
    canApprove: false,
    canExport: true,
    showDrafts: false,
    showScheduled: false
  },
  [UserRole.PARTNER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canShare: true,
    canTrack: true,
    canViewAnalytics: false,
    canManageAll: false,
    canApprove: false,
    canExport: false,
    showDrafts: false,
    showScheduled: false
  },
  [UserRole.CUSTOMER]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canShare: false,
    canTrack: false,
    canViewAnalytics: false,
    canManageAll: false,
    canApprove: false,
    canExport: false,
    showDrafts: false,
    showScheduled: false
  },
  [UserRole.VENDOR]: {
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canShare: false,
    canTrack: false,
    canViewAnalytics: false,
    canManageAll: false,
    canApprove: false,
    canExport: false,
    showDrafts: false,
    showScheduled: false
  }
}

/**
 * Sub-role enhancements for specific employee types
 */
export const SUB_ROLE_ENHANCEMENTS: Record<string, Partial<OfferPermissions>> = {
  CRO: {
    canTrack: true,
    canViewPersonalAnalytics: true,
    showRecommendations: true,
    showPerformanceStats: true,
    prioritySupport: true
  },
  BDM: {
    canTrack: true,
    canViewPersonalAnalytics: true,
    showRecommendations: true
  },
  BDE: {
    canTrack: true,
    showRecommendations: true
  },
  BUSINESS_PARTNER: {
    canTrack: true,
    showRecommendations: true,
    canViewTeamStats: true
  },
  CHANNEL_PARTNER: {
    canTrack: true,
    showRecommendations: true
  }
}

/**
 * Helper function to normalize role string to UserRole enum
 */
export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return UserRole.CUSTOMER

  const upperRole = role.toUpperCase().trim()

  // Map common variants
  const roleMap: Record<string, UserRole> = {
    'SUPER_ADMIN': UserRole.SUPER_ADMIN,
    'SUPERADMIN': UserRole.SUPER_ADMIN,
    'ADMIN': UserRole.ADMIN,
    'EMPLOYEE': UserRole.EMPLOYEE,
    'HR': UserRole.HR,
    'PARTNER': UserRole.PARTNER,
    'CUSTOMER': UserRole.CUSTOMER,
    'VENDOR': UserRole.VENDOR
  }

  return roleMap[upperRole] || UserRole.CUSTOMER
}

/**
 * Get permissions for a user based on role and sub-role
 */
export function getOfferPermissions(
  role: string | undefined | null,
  subRole?: string | undefined | null
): OfferPermissions {
  const normalizedRole = normalizeRole(role)
  const basePermissions = { ...OFFER_ROLE_PERMISSIONS[normalizedRole] }

  // Apply sub-role enhancements if applicable
  if (subRole) {
    const upperSubRole = subRole.toUpperCase().trim()
    const enhancements = SUB_ROLE_ENHANCEMENTS[upperSubRole]
    if (enhancements) {
      return { ...basePermissions, ...enhancements }
    }
  }

  return basePermissions
}

/**
 * Check if user is an employee type (includes HR)
 */
export function isEmployeeType(role: string | undefined | null): boolean {
  if (!role) return false
  const upperRole = role.toUpperCase().trim()
  return upperRole === 'EMPLOYEE' || upperRole === 'HR'
}

export interface Offer {
  id: string
  offer_title: string
  rolled_out_by: string // Bank or NBFC name
  description: string
  offer_image_url: string | null
  image_source?: 'upload' | 'ai-generated'
  ai_prompt?: string | null
  states_applicable: string[] | null // Array of state names
  start_date: string // ISO date string
  end_date: string // ISO date string
  status: 'active' | 'expired' | 'draft' | 'scheduled'
  scheduled_publish_at?: string | null // ISO timestamp for scheduled publishing
  timezone?: string // Timezone for scheduled publishing (e.g., 'Asia/Kolkata')
  auto_publish_enabled?: boolean // Whether auto-publishing is enabled
  created_by: string // User ID
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export interface CreateOfferRequest {
  offer_title: string
  rolled_out_by: string
  description: string
  offer_image_url?: string
  image_source?: 'upload' | 'ai-generated'
  ai_prompt?: string
  states_applicable: string[]
  start_date: string // YYYY-MM-DD format
  end_date: string // YYYY-MM-DD format
  scheduled_publish_at?: string | null // ISO timestamp for scheduled publishing
  timezone?: string // Timezone (default: 'Asia/Kolkata')
  auto_publish_enabled?: boolean // Whether to auto-publish at scheduled time
}

export interface UpdateOfferRequest extends Partial<CreateOfferRequest> {
  id: string
  status?: 'active' | 'expired' | 'draft' | 'scheduled'
}

export interface OfferView {
  id: string
  offer_id: string
  user_id: string
  viewed_at: string // ISO timestamp
}

export interface OfferFilters {
  status?: 'active' | 'expired' | 'draft' | 'scheduled'
  state?: string
  bank?: string
  search?: string
}

export interface OfferAnalytics {
  total_offers: number
  active_offers: number
  expired_offers: number
  draft_offers: number
  scheduled_offers: number
  total_views: number
  offers_by_bank: Array<{
    bank: string
    count: number
  }>
  recent_views: OfferView[]
}

// Indian States list for dropdown
export const INDIAN_STATES = [
  'All India',
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
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
] as const

export type IndianState = typeof INDIAN_STATES[number]

// Common banks/NBFCs for dropdown
export const COMMON_BANKS_NBFCS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Yes Bank',
  'IDFC First Bank',
  'IndusInd Bank',
  'Bank of Baroda',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Indian Bank',
  'Central Bank of India',
  'IDBI Bank',
  'Bajaj Finserv',
  'Tata Capital',
  'Mahindra Finance',
  'L&T Finance',
  'Shriram Finance',
  'Muthoot Finance',
  'Fullerton India',
  'IIFL Finance',
  'Aditya Birla Finance',
  'HDB Financial Services',
  'Other'
] as const

export type BankNBFC = typeof COMMON_BANKS_NBFCS[number]

// Common Indian timezones
export const INDIAN_TIMEZONES = [
  'Asia/Kolkata',  // IST (UTC+5:30) - Most of India
  'Asia/Calcutta', // IST (Alternative name)
  'Asia/Kathmandu', // NPT (UTC+5:45) - Nepal
  'Asia/Dhaka',    // BST (UTC+6:00) - Bangladesh
  'Asia/Colombo',  // SLST (UTC+5:30) - Sri Lanka
] as const

export type IndianTimezone = typeof INDIAN_TIMEZONES[number]

// Offer Templates
// Template data additional fields type
export type TemplateDataValue = string | number | boolean | string[] | null | undefined

export interface OfferTemplate {
  id: string
  template_name: string
  template_description: string | null
  category: 'home_loan' | 'personal_loan' | 'business_loan' | 'credit_card' | 'auto_loan' | 'education_loan' | 'generic'
  template_data: {
    offer_title: string
    description: string
    duration_days: number
    states_applicable: string[]
    // Additional template-specific fields
    interest_rate?: string
    processing_fee?: string
    min_amount?: number
    max_amount?: number
    tenure_options?: string[]
    eligibility_criteria?: string
    documents_required?: string[]
    [key: string]: TemplateDataValue | string[]
  }
  is_active: boolean
  is_system_template: boolean
  usage_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  last_used_at: string | null
}

export interface CreateOfferFromTemplateRequest {
  template_id: string
  bank_name: string
  overrides?: {
    offer_title?: string
    description?: string
    duration_days?: number
    states_applicable?: string[]
    interest_rate?: string
    processing_fee?: string
    min_amount?: number
    max_amount?: number
    tenure_options?: string[]
    eligibility_criteria?: string
    documents_required?: string[]
    [key: string]: TemplateDataValue | string[]
  }
}

export const OFFER_CATEGORIES = [
  { value: 'home_loan', label: 'Home Loan', emoji: '🏠' },
  { value: 'personal_loan', label: 'Personal Loan', emoji: '💰' },
  { value: 'business_loan', label: 'Business Loan', emoji: '💼' },
  { value: 'auto_loan', label: 'Auto Loan', emoji: '🚗' },
  { value: 'credit_card', label: 'Credit Card', emoji: '💳' },
  { value: 'education_loan', label: 'Education Loan', emoji: '🎓' },
  { value: 'generic', label: 'Generic', emoji: '📢' },
] as const

export type OfferCategory = typeof OFFER_CATEGORIES[number]['value']
