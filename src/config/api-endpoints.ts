/**
 * Centralized SuperAdmin API Endpoints
 * All API routes used by the SuperAdmin portal
 */

export const SUPERADMIN_API = {
  AUTH: {
    LOGIN: '/api/superadmin/auth',
    SIMPLE_LOGIN: '/api/superadmin/auth/simple-login',
    LOGOUT: '/api/superadmin/auth/logout',
    FORGOT_PASSWORD: '/api/superadmin/auth/forgot-password',
    RESET_PASSWORD: '/api/superadmin/auth/reset-password',
    EMERGENCY_RESET: '/api/superadmin/auth/emergency-reset',
    VERIFY_SESSION: '/api/auth/verify-session',
  },
  TWO_FA: {
    SETUP: '/api/superadmin/2fa/setup',
    ENABLE: '/api/superadmin/2fa/enable',
    VERIFY: '/api/superadmin/2fa/verify',
    DISABLE: '/api/superadmin/2fa/disable',
    REGENERATE_BACKUP: '/api/superadmin/2fa/regenerate-backup-codes',
  },
  DASHBOARD: '/api/superadmin/dashboard',
  PROFILE: '/api/superadmin/profile',
  EMPLOYEE_MANAGEMENT: '/api/superadmin/employee-management',
  CUSTOMER_MANAGEMENT: {
    BASE: '/api/superadmin/customer-management/customers',
    ANALYTICS: '/api/superadmin/customer-management/analytics',
  },
  PARTNER_MANAGEMENT: {
    BASE: '/api/superadmin/partner-management/partners',
    ANALYTICS: '/api/superadmin/partner-management/analytics',
  },
  ADMIN_MANAGEMENT: {
    BASE: '/api/admin-management',
    MODULES: '/api/admin-management/modules',
  },
  PAYOUTS: {
    BATCHES: '/api/superadmin/payouts/batches',
    STATS: '/api/superadmin/payouts/stats',
    ANALYTICS: '/api/superadmin/payouts/analytics',
  },
  LEADS: {
    UNIFIED_CRM: '/api/superadmin/unified-crm/leads',
    ANALYTICS: '/api/superadmin/leads-analytics',
    TIMELINE: '/api/superadmin/lead-timeline',
    REVENUE_FORECAST: '/api/superadmin/revenue-forecast',
    COHORT_ANALYSIS: '/api/superadmin/cohort-analysis',
  },
  REALTIME_FEED: '/api/superadmin/realtime-feed',
  BANNERS: '/api/banners',
  NOTIFICATION: '/api/superadmin/notification-center',
  FEATURE_FLAGS: '/api/superadmin/feature-flags',
  SMS_TEMPLATES: '/api/superadmin/sms-templates',
  EMAIL_TEMPLATES: '/api/superadmin/email-templates',
  ULI_HUB: {
    BASE: '/api/superadmin/uli-hub',
    HEALTH: '/api/superadmin/uli-hub/health',
    ANALYTICS: '/api/superadmin/uli-hub/analytics',
  },
  ULAP: {
    FORM_CONFIGS: '/api/superadmin/ulap/form-configurations',
    CATEGORIES: '/api/superadmin/ulap/categories',
    BANKS: '/api/superadmin/ulap/banks',
    RATES: '/api/superadmin/ulap/rates',
  },
  CONTESTS: '/api/superadmin/contests',
  ACTIVITIES: '/api/superadmin/activities',
  CRO: {
    LIST: '/api/superadmin/cros',
    REASSIGN: '/api/superadmin/cro-reassign',
    PERFORMANCE: '/api/superadmin/cro-performance',
    CALL_ANALYTICS: '/api/superadmin/cro-call-analytics',
  },
} as const
