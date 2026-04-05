// Application Constants
export const APP_CONFIG = {
  name: 'LOANZ 360',
  version: '1.0.0',
  description: 'Comprehensive Financial Services Platform',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
  bannerDimensions: { width: 1200, height: 300 },
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  apiTimeout: 30000, // 30 seconds
} as const

// Theme Colors (Financial App - Dark Theme)
export const THEME_COLORS = {
  background: '#000000',
  primary: '#FF6700',
  card: '#2E2E2E',
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
    muted: '#6B7280',
  },
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  border: '#374151',
} as const

// User Roles and Permissions
export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PARTNER: 'PARTNER',
  EMPLOYEE: 'EMPLOYEE',
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
} as const

export const EMPLOYEE_ROLES = {
  CRO: 'CRO',
  CUSTOMER_RELATIONSHIP_MANAGER: 'CUSTOMER_RELATIONSHIP_MANAGER',
  BUSINESS_DEVELOPMENT_MANAGER: 'BUSINESS_DEVELOPMENT_MANAGER',
  ACCOUNTS_TEAM: 'ACCOUNTS_TEAM',
  FINANCE_TEAM: 'FINANCE_TEAM',
  CHANNEL_PARTNER_MANAGER: 'CHANNEL_PARTNER_MANAGER',
  CHANNEL_PARTNER_EXECUTIVE: 'CHANNEL_PARTNER_EXECUTIVE',
  DIGITAL_SALES: 'DIGITAL_SALES',
  HR_TEAM: 'HR_TEAM',
  ADMIN: 'ADMIN',
} as const

export const PARTNER_TYPES = {
  BUSINESS_ASSOCIATE: 'BUSINESS_ASSOCIATE',
  BUSINESS_PARTNER: 'BUSINESS_PARTNER',
  CHANNEL_PARTNER: 'CHANNEL_PARTNER',
} as const

export const CUSTOMER_CATEGORIES = {
  INDIVIDUAL: 'INDIVIDUAL',
  SALARIED: 'SALARIED',
  PROPRIETOR: 'PROPRIETOR',
  PARTNERSHIP: 'PARTNERSHIP',
  PRIVATE_LIMITED_COMPANY: 'PRIVATE_LIMITED_COMPANY',
  PUBLIC_LIMITED_COMPANY: 'PUBLIC_LIMITED_COMPANY',
  LLP: 'LLP',
  DOCTOR: 'DOCTOR',
  LAWYER: 'LAWYER',
  PURE_RENTAL: 'PURE_RENTAL',
  AGRICULTURE: 'AGRICULTURE',
  NRI: 'NRI',
  CHARTERED_ACCOUNTANT: 'CHARTERED_ACCOUNTANT',
  COMPANY_SECRETARY: 'COMPANY_SECRETARY',
  HUF: 'HUF',
} as const

// Application Status Types
export const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DISBURSED: 'DISBURSED',
  CLOSED: 'CLOSED',
} as const

export const PAYOUT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const

export const KYC_STATUS = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const

// Loan Types
export const LOAN_TYPES = {
  HOME_LOAN: 'HOME_LOAN',
  PERSONAL_LOAN: 'PERSONAL_LOAN',
  BUSINESS_LOAN: 'BUSINESS_LOAN',
  CAR_LOAN: 'CAR_LOAN',
  EDUCATION_LOAN: 'EDUCATION_LOAN',
  GOLD_LOAN: 'GOLD_LOAN',
  PROPERTY_LOAN: 'PROPERTY_LOAN',
  OTHERS: 'OTHERS',
} as const

// Navigation Menu Items for Different Roles
export const SUPER_ADMIN_MENU = [
  'Dashboard',
  'User Management',
  'Partner Management',
  'Customer Management',
  'Payout Management',
  'Banner Management',
  'Incentive Management',
  'Contest Management',
  'Admin Management',
  'Property Management',
  'Vendor Management',
  'Knowledge Base',
] as const

export const PARTNER_MENU = {
  BUSINESS_ASSOCIATE: [
    'Dashboard',
    'My Leads',
    'My Customers',
    'Payout Grid',
    'Payout Status',
    'Incentive Details',
    'Offers to Customers',
    'My Profile',
  ],
  BUSINESS_PARTNER: [
    'Dashboard',
    'Recruit BH',
    'My Leads',
    'My Customers',
    'Payout Grid',
    'Payout Status',
    'Incentive Details',
    'Offers to Customers',
    'MIT',
    'My Profile',
  ],
  CHANNEL_PARTNER: [
    'Dashboard',
    'My Applications',
    'Payout Status',
    'Payout Grid',
    'Offers to Customers',
    'My Profile',
  ],
} as const

export const EMPLOYEE_MENU = [
  'Dashboard',
  'HR Module',
  'My Profile',
] as const

export const CUSTOMER_MENU = [
  'Dashboard',
  'EMIs and Loans',
  'Apply Loan and Offer to the Customer',
  'My Profile',
  'Knowledge Base',
  'EMI Reminders',
] as const

// Notification Types
export const NOTIFICATION_TYPES = {
  APPLICATION_UPDATE: 'APPLICATION_UPDATE',
  PAYOUT_UPDATE: 'PAYOUT_UPDATE',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  PROMOTION: 'PROMOTION',
  REMINDER: 'REMINDER',
  WARNING: 'WARNING',
} as const

// File Upload Configuration
export const FILE_UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: {
    images: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    documents: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  buckets: {
    avatars: 'avatars',
    documents: 'documents',
    banners: 'banners',
    properties: 'properties',
  },
} as const

// API Routes
export const API_ROUTES = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    resetPassword: '/api/auth/reset-password',
  },
  users: {
    profile: '/api/users/profile',
    update: '/api/users/update',
    avatar: '/api/users/avatar',
  },
  dashboard: {
    analytics: '/api/dashboard/analytics',
    activity: '/api/dashboard/activity',
  },
  partners: {
    list: '/api/partners',
    create: '/api/partners',
    update: '/api/partners',
    performance: '/api/partners/performance',
  },
  customers: {
    list: '/api/customers',
    create: '/api/customers',
    update: '/api/customers',
    applications: '/api/customers/applications',
  },
  applications: {
    list: '/api/applications',
    create: '/api/applications',
    update: '/api/applications',
    upload: '/api/applications/upload',
  },
  payouts: {
    list: '/api/payouts',
    approve: '/api/payouts/approve',
    reject: '/api/payouts/reject',
    analytics: '/api/payouts/analytics',
  },
  notifications: {
    list: '/api/notifications',
    markRead: '/api/notifications/mark-read',
    send: '/api/notifications/send',
  },
} as const

// Database Table Names
export const TABLE_NAMES = {
  USERS: 'users',
  PROFILES: 'profiles',
  PARTNERS: 'partners',
  CUSTOMERS: 'customers',
  EMPLOYEES: 'employees',
  LOAN_APPLICATIONS: 'loan_applications',
  PAYOUTS: 'payouts',
  BANNERS: 'banners',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs',
} as const

// Validation Rules
export const VALIDATION_RULES = {
  password: {
    minLength: 12, // SECURITY: Increased from 8 to 12 for financial application security
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  mobile: {
    pattern: /^[6-9]\d{9}$/,
    length: 10,
  },
  pan: {
    pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  },
  aadhaar: {
    pattern: /^\d{12}$/,
    length: 12,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
} as const

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  SERVER_ERROR: 'Internal server error',
  NETWORK_ERROR: 'Network error occurred',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  INVALID_FILE_TYPE: 'Invalid file type',
  EXPIRED_SESSION: 'Your session has expired. Please login again',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profile updated successfully',
  APPLICATION_SUBMITTED: 'Application submitted successfully',
  PAYOUT_APPROVED: 'Payout approved successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  NOTIFICATION_SENT: 'Notification sent successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
} as const