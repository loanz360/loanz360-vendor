/**
 * LOANZ 360 Design System Constants
 * Single source of truth for all colors, spacing, and branding
 */

// Brand Colors
export const BRAND = {
  primary: '#FF6700',        // Orange
  primaryHover: '#e65c00',
  primaryLight: '#FF6700/10',
  primaryBorder: '#FF6700/30',
  dark: '#171717',           // Ash Gray
  font: 'Poppins',
} as const

// Consistent card color scheme for stats/analytics across all modules
export const CARD_COLORS = {
  // Primary metrics
  primary: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: 'text-orange-500',
    gradient: 'from-orange-500/20 to-orange-500/5',
  },
  // Success/positive metrics
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: 'text-emerald-500',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  // Info/neutral metrics
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: 'text-blue-500',
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  // Warning metrics
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: 'text-amber-500',
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
  // Danger/negative metrics
  danger: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: 'text-red-500',
    gradient: 'from-red-500/20 to-red-500/5',
  },
  // Purple/special metrics
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: 'text-purple-500',
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
  // Cyan/teal metrics
  teal: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    icon: 'text-teal-500',
    gradient: 'from-teal-500/20 to-teal-500/5',
  },
} as const

export type CardColorKey = keyof typeof CARD_COLORS

// Consistent status colors used across all modules
export const STATUS_COLORS = {
  // Attendance statuses
  present: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  absent: 'bg-red-500/10 text-red-400 border-red-500/30',
  late: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  half_day: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  leave: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  holiday: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  weekend: 'bg-gray-500/10 text-gray-400 border-gray-500/30',

  // Approval statuses
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/30',

  // Document/review statuses
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  under_review: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',

  // Notification priorities
  urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  low: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
} as const

export type StatusKey = keyof typeof STATUS_COLORS

// Get status color with fallback
export function getStatusColor(status: string): string {
  const normalized = status.toLowerCase().replace(/[\s-]/g, '_') as StatusKey
  return STATUS_COLORS[normalized] || STATUS_COLORS.pending
}

// Common page sizes for pagination
export const PAGE_SIZES = [10, 20, 50, 100] as const

// File upload constraints
export const FILE_LIMITS = {
  maxFileSize: 5 * 1024 * 1024,       // 5MB
  maxFileSizeLabel: '5MB',
  maxTotalSize: 100 * 1024 * 1024,     // 100MB
  maxFileCount: 10,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedDocTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  allowedAllTypes: [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ],
} as const

// Company contact information - single source of truth
export const COMPANY_INFO = {
  name: 'Loanz360',
  supportEmail: 'support@loanz360.com',
  supportPhone: '1800-123-4567',
  website: 'https://www.loanz360.com',
  address: 'Financial District, India',
} as const

// API timeout values
export const API_TIMEOUTS = {
  default: 10000,    // 10s
  upload: 60000,     // 60s
  export: 30000,     // 30s
  search: 5000,      // 5s
} as const

// Toast duration values
export const TOAST_DURATION = {
  short: 3000,
  default: 5000,
  long: 8000,
  persistent: Infinity,
} as const
