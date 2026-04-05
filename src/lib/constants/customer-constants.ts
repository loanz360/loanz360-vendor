/**
 * Customer Management Constants
 * Fortune 500 Grade: Single source of truth for all customer-related enums and mappings
 *
 * This file contains all constants used across the customer management module
 * to ensure consistency and prevent duplication.
 */

// =============================================
// CUSTOMER CATEGORIES
// =============================================

export const CUSTOMER_CATEGORIES = {
  INDIVIDUAL: 'INDIVIDUAL',
  SALARIED: 'SALARIED',
  PROPRIETOR: 'PROPRIETOR',
  PARTNERSHIP: 'PARTNERSHIP',
  PRIVATE_LIMITED_COMPANY: 'PRIVATE_LIMITED_COMPANY',
  PUBLIC_LIMITED_COMPANY: 'PUBLIC_LIMITED_COMPANY',
  LLP: 'LLP',
  HUF: 'HUF',
  DOCTOR: 'DOCTOR',
  LAWYER: 'LAWYER',
  PURE_RENTAL: 'PURE_RENTAL',
  AGRICULTURE: 'AGRICULTURE',
  NRI: 'NRI',
  CHARTERED_ACCOUNTANT: 'CHARTERED_ACCOUNTANT',
  COMPANY_SECRETARY: 'COMPANY_SECRETARY',
} as const

export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[keyof typeof CUSTOMER_CATEGORIES]

export const CUSTOMER_CATEGORY_VALUES = Object.values(CUSTOMER_CATEGORIES)

export const CUSTOMER_CATEGORY_DISPLAY_NAMES: Record<CustomerCategory, string> = {
  INDIVIDUAL: 'Individuals',
  SALARIED: 'Salaried',
  PROPRIETOR: 'Proprietor',
  PARTNERSHIP: 'Partnerships',
  PRIVATE_LIMITED_COMPANY: 'Private Limited Company',
  PUBLIC_LIMITED_COMPANY: 'Public Limited Company',
  LLP: 'LLP',
  HUF: 'HUF',
  DOCTOR: 'Doctors',
  LAWYER: 'Lawyers',
  PURE_RENTAL: 'Pure Rental',
  AGRICULTURE: 'Agricultural',
  NRI: 'NRI',
  CHARTERED_ACCOUNTANT: 'Chartered Accountants',
  COMPANY_SECRETARY: 'Company Secretaries',
}

// =============================================
// USER STATUSES
// =============================================

export const USER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES]

export const USER_STATUS_VALUES = Object.values(USER_STATUSES)

export const USER_STATUS_DISPLAY_NAMES: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  PENDING_VERIFICATION: 'Pending Verification',
}

export const USER_STATUS_COLORS: Record<UserStatus, { bg: string; text: string; border: string }> = {
  ACTIVE: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  INACTIVE: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
  SUSPENDED: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  PENDING_VERIFICATION: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
}

// =============================================
// KYC STATUSES
// =============================================

export const KYC_STATUSES = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const

export type KYCStatus = (typeof KYC_STATUSES)[keyof typeof KYC_STATUSES]

export const KYC_STATUS_VALUES = Object.values(KYC_STATUSES)

export const KYC_STATUS_DISPLAY_NAMES: Record<KYCStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
}

export const KYC_STATUS_COLORS: Record<KYCStatus, { bg: string; text: string; border: string }> = {
  PENDING: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  UNDER_REVIEW: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  APPROVED: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  REJECTED: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  EXPIRED: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
}

// =============================================
// ACTIVITY TYPES
// =============================================

export const ACTIVITY_TYPES = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  FAILED_LOGIN: 'FAILED_LOGIN',

  // Profile
  REGISTRATION: 'REGISTRATION',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  PROFILE_VIEW: 'PROFILE_VIEW',

  // Loan
  LOAN_APPLICATION: 'LOAN_APPLICATION',
  LOAN_APPLICATION_SUBMIT: 'LOAN_APPLICATION_SUBMIT',
  LOAN_APPLICATION_UPDATE: 'LOAN_APPLICATION_UPDATE',
  LOAN_APPROVED: 'LOAN_APPROVED',
  LOAN_REJECTED: 'LOAN_REJECTED',
  LOAN_DISBURSED: 'LOAN_DISBURSED',

  // Documents
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_DOWNLOAD: 'DOCUMENT_DOWNLOAD',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',
  DOCUMENT_VIEW: 'DOCUMENT_VIEW',

  // Support
  SUPPORT_TICKET: 'SUPPORT_TICKET',
  SUPPORT_TICKET_CREATE: 'SUPPORT_TICKET_CREATE',
  SUPPORT_TICKET_UPDATE: 'SUPPORT_TICKET_UPDATE',
  SUPPORT_TICKET_CLOSE: 'SUPPORT_TICKET_CLOSE',

  // Payment
  PAYMENT: 'PAYMENT',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EMI_PAYMENT: 'EMI_PAYMENT',

  // Communication
  EMAIL_SENT: 'EMAIL_SENT',
  SMS_SENT: 'SMS_SENT',
  WHATSAPP_SENT: 'WHATSAPP_SENT',

  // KYC
  KYC_SUBMIT: 'KYC_SUBMIT',
  KYC_UPDATE: 'KYC_UPDATE',
  KYC_APPROVED: 'KYC_APPROVED',
  KYC_REJECTED: 'KYC_REJECTED',
} as const

export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES]

export const ACTIVITY_CATEGORIES = {
  PROFILE: 'PROFILE',
  LOAN: 'LOAN',
  DOCUMENT: 'DOCUMENT',
  SUPPORT: 'SUPPORT',
  COMMUNICATION: 'COMMUNICATION',
  AUTHENTICATION: 'AUTHENTICATION',
  PAYMENT: 'PAYMENT',
  KYC: 'KYC',
} as const

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[keyof typeof ACTIVITY_CATEGORIES]

export const ACTIVITY_CATEGORY_DISPLAY_NAMES: Record<ActivityCategory, string> = {
  PROFILE: 'Profile',
  LOAN: 'Loan',
  DOCUMENT: 'Document',
  SUPPORT: 'Support',
  COMMUNICATION: 'Communication',
  AUTHENTICATION: 'Authentication',
  PAYMENT: 'Payment',
  KYC: 'KYC',
}

// =============================================
// TIMEFRAME OPTIONS
// =============================================

export const TIMEFRAMES = {
  SEVEN_DAYS: '7d',
  THIRTY_DAYS: '30d',
  NINETY_DAYS: '90d',
} as const

export type Timeframe = (typeof TIMEFRAMES)[keyof typeof TIMEFRAMES]

export const TIMEFRAME_VALUES = Object.values(TIMEFRAMES)

export const TIMEFRAME_DISPLAY_NAMES: Record<Timeframe, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
}

// =============================================
// PAGINATION CONSTANTS
// =============================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const

// =============================================
// CUSTOMER TAGS (For Segmentation)
// =============================================

export const CUSTOMER_TAGS = {
  VIP: 'VIP',
  HIGH_VALUE: 'HIGH_VALUE',
  RISKY: 'RISKY',
  FREQUENT_BORROWER: 'FREQUENT_BORROWER',
  NEW_CUSTOMER: 'NEW_CUSTOMER',
  CHURNED: 'CHURNED',
  AT_RISK: 'AT_RISK',
  EXCELLENT_PAYER: 'EXCELLENT_PAYER',
  LATE_PAYER: 'LATE_PAYER',
  NPA: 'NPA',
} as const

export type CustomerTag = (typeof CUSTOMER_TAGS)[keyof typeof CUSTOMER_TAGS]

export const CUSTOMER_TAG_DISPLAY_NAMES: Record<CustomerTag, string> = {
  VIP: 'VIP Customer',
  HIGH_VALUE: 'High Value',
  RISKY: 'Risky',
  FREQUENT_BORROWER: 'Frequent Borrower',
  NEW_CUSTOMER: 'New Customer',
  CHURNED: 'Churned',
  AT_RISK: 'At Risk',
  EXCELLENT_PAYER: 'Excellent Payer',
  LATE_PAYER: 'Late Payer',
  NPA: 'NPA',
}

export const CUSTOMER_TAG_COLORS: Record<CustomerTag, { bg: string; text: string; border: string }> = {
  VIP: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
  },
  HIGH_VALUE: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  RISKY: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  FREQUENT_BORROWER: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  NEW_CUSTOMER: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  CHURNED: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
  AT_RISK: {
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  EXCELLENT_PAYER: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  LATE_PAYER: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  NPA: {
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
  },
}

// =============================================
// CUSTOMER TIERS
// =============================================

export const CUSTOMER_TIERS = {
  PLATINUM: 'PLATINUM',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  BRONZE: 'BRONZE',
} as const

export type CustomerTier = (typeof CUSTOMER_TIERS)[keyof typeof CUSTOMER_TIERS]

export const CUSTOMER_TIER_DISPLAY_NAMES: Record<CustomerTier, string> = {
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
}

export const CUSTOMER_TIER_COLORS: Record<CustomerTier, { bg: string; text: string; border: string }> = {
  PLATINUM: {
    bg: 'bg-gray-300/20',
    text: 'text-gray-200',
    border: 'border-gray-300/30',
  },
  GOLD: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  SILVER: {
    bg: 'bg-gray-400/20',
    text: 'text-gray-300',
    border: 'border-gray-400/30',
  },
  BRONZE: {
    bg: 'bg-orange-700/20',
    text: 'text-orange-600',
    border: 'border-orange-700/30',
  },
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get display name for customer category
 */
export function getCustomerCategoryDisplayName(category: string): string {
  return CUSTOMER_CATEGORY_DISPLAY_NAMES[category as CustomerCategory] || category
}

/**
 * Get display name for user status
 */
export function getUserStatusDisplayName(status: string): string {
  return USER_STATUS_DISPLAY_NAMES[status as UserStatus] || status
}

/**
 * Get display name for KYC status
 */
export function getKYCStatusDisplayName(status: string): string {
  return KYC_STATUS_DISPLAY_NAMES[status as KYCStatus] || status
}

/**
 * Get color configuration for user status
 */
export function getUserStatusColors(status: string) {
  return USER_STATUS_COLORS[status as UserStatus] || USER_STATUS_COLORS.PENDING_VERIFICATION
}

/**
 * Get color configuration for KYC status
 */
export function getKYCStatusColors(status: string) {
  return KYC_STATUS_COLORS[status as KYCStatus] || KYC_STATUS_COLORS.PENDING
}

/**
 * Validate customer category
 */
export function isValidCustomerCategory(category: string): boolean {
  return CUSTOMER_CATEGORY_VALUES.includes(category as CustomerCategory)
}

/**
 * Validate user status
 */
export function isValidUserStatus(status: string): boolean {
  return USER_STATUS_VALUES.includes(status as UserStatus)
}

/**
 * Validate KYC status
 */
export function isValidKYCStatus(status: string): boolean {
  return KYC_STATUS_VALUES.includes(status as KYCStatus)
}

/**
 * Validate timeframe
 */
export function isValidTimeframe(timeframe: string): boolean {
  return TIMEFRAME_VALUES.includes(timeframe as Timeframe)
}
