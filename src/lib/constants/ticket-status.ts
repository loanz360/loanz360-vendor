// ============================================================================
// ENTERPRISE TICKET STATUS CONSTANTS
// Centralized status definitions for all ticket types
// ============================================================================

// ============================================================================
// TICKET STATUS
// ============================================================================

export const TICKET_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  ON_HOLD: 'on_hold',
  WAITING_CUSTOMER: 'waiting_customer',
  WAITING_INTERNAL: 'waiting_internal',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  MERGED: 'merged',
  ESCALATED: 'escalated'
} as const

export type TicketStatusType = typeof TICKET_STATUS[keyof typeof TICKET_STATUS]

// Status groups for filtering and reporting
export const STATUS_GROUPS = {
  ACTIVE: [
    TICKET_STATUS.OPEN,
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.WAITING_CUSTOMER,
    TICKET_STATUS.WAITING_INTERNAL,
    TICKET_STATUS.REOPENED,
    TICKET_STATUS.ESCALATED
  ],
  ON_HOLD: [
    TICKET_STATUS.ON_HOLD
  ],
  RESOLVED: [
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.CLOSED,
    TICKET_STATUS.MERGED
  ]
} as const

// Status display configuration
export const STATUS_CONFIG: Record<TicketStatusType, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: string
  description: string
}> = {
  [TICKET_STATUS.OPEN]: {
    label: 'Open',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/20',
    icon: 'clock',
    description: 'Ticket is open and awaiting assignment'
  },
  [TICKET_STATUS.IN_PROGRESS]: {
    label: 'In Progress',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20',
    icon: 'play',
    description: 'Actively being worked on'
  },
  [TICKET_STATUS.PENDING]: {
    label: 'Pending',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/20',
    icon: 'hourglass',
    description: 'Waiting for additional information'
  },
  [TICKET_STATUS.ON_HOLD]: {
    label: 'On Hold',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    borderColor: 'border-gray-400/20',
    icon: 'pause',
    description: 'Temporarily paused'
  },
  [TICKET_STATUS.WAITING_CUSTOMER]: {
    label: 'Waiting on Customer',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/20',
    icon: 'user-clock',
    description: 'Waiting for customer response'
  },
  [TICKET_STATUS.WAITING_INTERNAL]: {
    label: 'Waiting Internal',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    borderColor: 'border-indigo-400/20',
    icon: 'building',
    description: 'Waiting for internal team response'
  },
  [TICKET_STATUS.RESOLVED]: {
    label: 'Resolved',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
    icon: 'check-circle',
    description: 'Issue has been resolved'
  },
  [TICKET_STATUS.CLOSED]: {
    label: 'Closed',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    icon: 'x-circle',
    description: 'Ticket is closed'
  },
  [TICKET_STATUS.REOPENED]: {
    label: 'Reopened',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/20',
    icon: 'rotate-ccw',
    description: 'Previously resolved ticket has been reopened'
  },
  [TICKET_STATUS.MERGED]: {
    label: 'Merged',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/20',
    icon: 'git-merge',
    description: 'Merged into another ticket'
  },
  [TICKET_STATUS.ESCALATED]: {
    label: 'Escalated',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/20',
    icon: 'arrow-up-circle',
    description: 'Escalated to higher support tier'
  }
}

// ============================================================================
// TICKET PRIORITY
// ============================================================================

export const TICKET_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
  CRITICAL: 'critical'
} as const

export type TicketPriorityType = typeof TICKET_PRIORITY[keyof typeof TICKET_PRIORITY]

export const PRIORITY_CONFIG: Record<TicketPriorityType, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  weight: number
  slaMultiplier: number
}> = {
  [TICKET_PRIORITY.LOW]: {
    label: 'Low',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/20',
    weight: 1,
    slaMultiplier: 2.0
  },
  [TICKET_PRIORITY.MEDIUM]: {
    label: 'Medium',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/20',
    weight: 2,
    slaMultiplier: 1.0
  },
  [TICKET_PRIORITY.HIGH]: {
    label: 'High',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/20',
    weight: 3,
    slaMultiplier: 0.5
  },
  [TICKET_PRIORITY.URGENT]: {
    label: 'Urgent',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/20',
    weight: 4,
    slaMultiplier: 0.25
  },
  [TICKET_PRIORITY.CRITICAL]: {
    label: 'Critical',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    weight: 5,
    slaMultiplier: 0.125
  }
}

// ============================================================================
// TICKET CATEGORIES
// ============================================================================

export const TICKET_CATEGORIES = {
  // Employee Ticket Categories
  EMPLOYEE: {
    HR: 'hr',
    FINANCE: 'finance',
    IT_SUPPORT: 'it_support',
    PAYROLL: 'payroll',
    LEAVE: 'leave',
    BENEFITS: 'benefits',
    COMPLIANCE: 'compliance',
    GENERAL: 'general'
  },
  // Customer Ticket Categories
  CUSTOMER: {
    ACCOUNT: 'account',
    BILLING: 'billing',
    LOAN: 'loan',
    TECHNICAL: 'technical',
    COMPLAINT: 'complaint',
    FEEDBACK: 'feedback',
    DOCUMENTATION: 'documentation',
    GENERAL: 'general'
  },
  // Partner Ticket Categories
  PARTNER: {
    ONBOARDING: 'onboarding',
    COMMISSION: 'commission',
    TECHNICAL: 'technical',
    TRAINING: 'training',
    COMPLIANCE: 'compliance',
    ACCOUNT: 'account',
    SUPPORT: 'support',
    GENERAL: 'general'
  }
} as const

// ============================================================================
// DEPARTMENTS
// ============================================================================

export const DEPARTMENTS = {
  HR: 'hr',
  FINANCE: 'finance',
  IT: 'it',
  OPERATIONS: 'operations',
  COMPLIANCE: 'compliance',
  SALES: 'sales',
  CUSTOMER_SERVICE: 'customer_service',
  PARTNER_SUCCESS: 'partner_success',
  MANAGEMENT: 'management',
  SUPER_ADMIN: 'super_admin'
} as const

export type DepartmentType = typeof DEPARTMENTS[keyof typeof DEPARTMENTS]

export const DEPARTMENT_CONFIG: Record<DepartmentType, {
  label: string
  description: string
  categories: string[]
}> = {
  [DEPARTMENTS.HR]: {
    label: 'Human Resources',
    description: 'Employee relations, benefits, leave management',
    categories: ['hr', 'leave', 'benefits', 'payroll']
  },
  [DEPARTMENTS.FINANCE]: {
    label: 'Finance & Accounts',
    description: 'Billing, payments, commissions, reimbursements',
    categories: ['finance', 'billing', 'commission', 'payroll']
  },
  [DEPARTMENTS.IT]: {
    label: 'IT Support',
    description: 'Technical issues, system access, software',
    categories: ['it_support', 'technical']
  },
  [DEPARTMENTS.OPERATIONS]: {
    label: 'Operations',
    description: 'General operations and process issues',
    categories: ['general', 'compliance']
  },
  [DEPARTMENTS.COMPLIANCE]: {
    label: 'Compliance',
    description: 'Regulatory and compliance matters',
    categories: ['compliance', 'documentation']
  },
  [DEPARTMENTS.SALES]: {
    label: 'Sales',
    description: 'Sales inquiries and support',
    categories: ['account', 'loan']
  },
  [DEPARTMENTS.CUSTOMER_SERVICE]: {
    label: 'Customer Service',
    description: 'Customer support and inquiries',
    categories: ['account', 'complaint', 'feedback', 'general']
  },
  [DEPARTMENTS.PARTNER_SUCCESS]: {
    label: 'Partner Success',
    description: 'Partner onboarding and support',
    categories: ['onboarding', 'training', 'support']
  },
  [DEPARTMENTS.MANAGEMENT]: {
    label: 'Management',
    description: 'Escalated issues requiring management attention',
    categories: []
  },
  [DEPARTMENTS.SUPER_ADMIN]: {
    label: 'Super Admin',
    description: 'System-wide administration',
    categories: []
  }
}

// ============================================================================
// TICKET SOURCE
// ============================================================================

export const TICKET_SOURCE = {
  EMPLOYEE: 'employee',
  CUSTOMER: 'customer',
  PARTNER: 'partner',
  SYSTEM: 'system',
  EMAIL: 'email',
  PHONE: 'phone',
  CHAT: 'chat'
} as const

export type TicketSourceType = typeof TICKET_SOURCE[keyof typeof TICKET_SOURCE]

// ============================================================================
// SLA STATUS
// ============================================================================

export const SLA_STATUS = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  BREACHED: 'breached',
  PAUSED: 'paused',
  MET: 'met',
  NOT_APPLICABLE: 'not_applicable'
} as const

export type SLAStatusType = typeof SLA_STATUS[keyof typeof SLA_STATUS]

export const SLA_STATUS_CONFIG: Record<SLAStatusType, {
  label: string
  color: string
  bgColor: string
  description: string
}> = {
  [SLA_STATUS.ON_TRACK]: {
    label: 'On Track',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    description: 'Within SLA timeline'
  },
  [SLA_STATUS.AT_RISK]: {
    label: 'At Risk',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    description: 'SLA deadline approaching'
  },
  [SLA_STATUS.BREACHED]: {
    label: 'Breached',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    description: 'SLA has been breached'
  },
  [SLA_STATUS.PAUSED]: {
    label: 'Paused',
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    description: 'SLA timer is paused'
  },
  [SLA_STATUS.MET]: {
    label: 'Met',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    description: 'SLA was met successfully'
  },
  [SLA_STATUS.NOT_APPLICABLE]: {
    label: 'N/A',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    description: 'SLA not applicable'
  }
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

// Valid status transitions for each status
export const STATUS_TRANSITIONS: Record<TicketStatusType, TicketStatusType[]> = {
  [TICKET_STATUS.OPEN]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.ON_HOLD,
    TICKET_STATUS.CLOSED,
    TICKET_STATUS.MERGED,
    TICKET_STATUS.ESCALATED
  ],
  [TICKET_STATUS.IN_PROGRESS]: [
    TICKET_STATUS.PENDING,
    TICKET_STATUS.ON_HOLD,
    TICKET_STATUS.WAITING_CUSTOMER,
    TICKET_STATUS.WAITING_INTERNAL,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.ESCALATED
  ],
  [TICKET_STATUS.PENDING]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.ON_HOLD,
    TICKET_STATUS.WAITING_CUSTOMER,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.CLOSED
  ],
  [TICKET_STATUS.ON_HOLD]: [
    TICKET_STATUS.OPEN,
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.CLOSED
  ],
  [TICKET_STATUS.WAITING_CUSTOMER]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.CLOSED
  ],
  [TICKET_STATUS.WAITING_INTERNAL]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.RESOLVED
  ],
  [TICKET_STATUS.RESOLVED]: [
    TICKET_STATUS.REOPENED,
    TICKET_STATUS.CLOSED
  ],
  [TICKET_STATUS.CLOSED]: [
    TICKET_STATUS.REOPENED
  ],
  [TICKET_STATUS.REOPENED]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.PENDING,
    TICKET_STATUS.ON_HOLD,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.CLOSED
  ],
  [TICKET_STATUS.MERGED]: [],  // No transitions from merged
  [TICKET_STATUS.ESCALATED]: [
    TICKET_STATUS.IN_PROGRESS,
    TICKET_STATUS.RESOLVED,
    TICKET_STATUS.CLOSED
  ]
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  currentStatus: TicketStatusType,
  newStatus: TicketStatusType
): boolean {
  return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false
}

/**
 * Get all valid next statuses for a given status
 */
export function getValidNextStatuses(currentStatus: TicketStatusType): TicketStatusType[] {
  return STATUS_TRANSITIONS[currentStatus] ?? []
}

/**
 * Get status configuration
 */
export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as TicketStatusType] || STATUS_CONFIG[TICKET_STATUS.OPEN]
}

/**
 * Get priority configuration
 */
export function getPriorityConfig(priority: string) {
  return PRIORITY_CONFIG[priority as TicketPriorityType] || PRIORITY_CONFIG[TICKET_PRIORITY.MEDIUM]
}

/**
 * Get SLA status configuration
 */
export function getSLAStatusConfig(slaStatus: string) {
  return SLA_STATUS_CONFIG[slaStatus as SLAStatusType] || SLA_STATUS_CONFIG[SLA_STATUS.NOT_APPLICABLE]
}

/**
 * Check if a ticket status is considered active (not resolved/closed)
 */
export function isActiveStatus(status: string): boolean {
  return STATUS_GROUPS.ACTIVE.includes(status as TicketStatusType) ||
         STATUS_GROUPS.ON_HOLD.includes(status as TicketStatusType)
}

/**
 * Check if a ticket status is considered resolved
 */
export function isResolvedStatus(status: string): boolean {
  return STATUS_GROUPS.RESOLVED.includes(status as TicketStatusType)
}

/**
 * Get department for a category
 */
export function getDepartmentForCategory(
  category: string,
  ticketSource: TicketSourceType
): DepartmentType {
  for (const [dept, config] of Object.entries(DEPARTMENT_CONFIG)) {
    if (config.categories.includes(category)) {
      return dept as DepartmentType
    }
  }

  // Default departments based on ticket source
  switch (ticketSource) {
    case TICKET_SOURCE.EMPLOYEE:
      return DEPARTMENTS.HR
    case TICKET_SOURCE.CUSTOMER:
      return DEPARTMENTS.CUSTOMER_SERVICE
    case TICKET_SOURCE.PARTNER:
      return DEPARTMENTS.PARTNER_SUCCESS
    default:
      return DEPARTMENTS.OPERATIONS
  }
}

/**
 * Normalize status value (handle various input formats)
 */
export function normalizeStatus(status: string): TicketStatusType {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_')

  // Map common variations
  const statusMap: Record<string, TicketStatusType> = {
    'new': TICKET_STATUS.OPEN,
    'inprogress': TICKET_STATUS.IN_PROGRESS,
    'in_progress': TICKET_STATUS.IN_PROGRESS,
    'onhold': TICKET_STATUS.ON_HOLD,
    'on_hold': TICKET_STATUS.ON_HOLD,
    'waiting': TICKET_STATUS.WAITING_CUSTOMER,
    'waiting_customer': TICKET_STATUS.WAITING_CUSTOMER,
    'waiting_on_customer': TICKET_STATUS.WAITING_CUSTOMER,
    'awaiting_customer': TICKET_STATUS.WAITING_CUSTOMER,
    'done': TICKET_STATUS.RESOLVED,
    'complete': TICKET_STATUS.CLOSED,
    'completed': TICKET_STATUS.CLOSED
  }

  return statusMap[normalized] || (normalized as TicketStatusType) || TICKET_STATUS.OPEN
}

/**
 * Normalize priority value
 */
export function normalizePriority(priority: string): TicketPriorityType {
  const normalized = priority.toLowerCase()

  const priorityMap: Record<string, TicketPriorityType> = {
    'p1': TICKET_PRIORITY.CRITICAL,
    'p2': TICKET_PRIORITY.URGENT,
    'p3': TICKET_PRIORITY.HIGH,
    'p4': TICKET_PRIORITY.MEDIUM,
    'p5': TICKET_PRIORITY.LOW,
    'highest': TICKET_PRIORITY.CRITICAL,
    'lowest': TICKET_PRIORITY.LOW
  }

  return priorityMap[normalized] || (normalized as TicketPriorityType) || TICKET_PRIORITY.MEDIUM
}

// ============================================================================
// FILTER OPTIONS FOR UI
// ============================================================================

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: TICKET_STATUS.OPEN, label: 'Open' },
  { value: TICKET_STATUS.IN_PROGRESS, label: 'In Progress' },
  { value: TICKET_STATUS.PENDING, label: 'Pending' },
  { value: TICKET_STATUS.ON_HOLD, label: 'On Hold' },
  { value: TICKET_STATUS.WAITING_CUSTOMER, label: 'Waiting on Customer' },
  { value: TICKET_STATUS.RESOLVED, label: 'Resolved' },
  { value: TICKET_STATUS.CLOSED, label: 'Closed' },
  { value: TICKET_STATUS.REOPENED, label: 'Reopened' },
  { value: TICKET_STATUS.ESCALATED, label: 'Escalated' }
]

export const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: TICKET_PRIORITY.CRITICAL, label: 'Critical' },
  { value: TICKET_PRIORITY.URGENT, label: 'Urgent' },
  { value: TICKET_PRIORITY.HIGH, label: 'High' },
  { value: TICKET_PRIORITY.MEDIUM, label: 'Medium' },
  { value: TICKET_PRIORITY.LOW, label: 'Low' }
]

export const SLA_FILTER_OPTIONS = [
  { value: 'all', label: 'All SLA Status' },
  { value: SLA_STATUS.ON_TRACK, label: 'On Track' },
  { value: SLA_STATUS.AT_RISK, label: 'At Risk' },
  { value: SLA_STATUS.BREACHED, label: 'Breached' },
  { value: SLA_STATUS.PAUSED, label: 'Paused' }
]
