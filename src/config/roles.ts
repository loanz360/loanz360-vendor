/**
 * Centralized Role Definitions
 * Single source of truth for all role types across the application
 */

// ─── Employee Sub-Roles ───────────────────────────────────────────────

export interface RoleDefinition {
  key: string
  label: string
  category: string
  description?: string
}

export const EMPLOYEE_SUB_ROLE_CATEGORIES = [
  'Sales',
  'Channel Partners',
  'Finance & Accounts',
  'Support',
  'Compliance & Training',
  'Operations & Admin',
  'HR',
] as const

export type EmployeeSubRoleCategory = typeof EMPLOYEE_SUB_ROLE_CATEGORIES[number]

export const EMPLOYEE_SUB_ROLES: RoleDefinition[] = [
  // Sales
  { key: 'CRO', label: 'CRO (Customer Relationship Officer)', category: 'Sales', description: 'Handles customer relationships and loan processing' },
  { key: 'CRO_MANAGER', label: 'CRO Manager', category: 'Sales', description: 'Manages a team of CROs' },
  { key: 'CRO_TEAM_LEADER', label: 'CRO Team Leader', category: 'Sales', description: 'Leads a CRO team' },
  { key: 'CRO_STATE_MANAGER', label: 'CRO State Manager', category: 'Sales', description: 'Manages CROs across a state' },
  { key: 'SENIOR_CRO', label: 'Senior CRO', category: 'Sales', description: 'Experienced CRO handling complex cases' },
  { key: 'TELECALLER', label: 'Telecaller', category: 'Sales', description: 'Handles phone-based customer outreach' },
  { key: 'TELECALLER_MANAGER', label: 'Telecaller Manager', category: 'Sales', description: 'Manages telecalling team' },
  { key: 'SALES_EXECUTIVE', label: 'Sales Executive', category: 'Sales', description: 'Handles direct sales' },
  { key: 'SALES_MANAGER', label: 'Sales Manager', category: 'Sales', description: 'Manages sales team' },
  { key: 'DIGITAL_SALES', label: 'Digital Sales', category: 'Sales', description: 'Handles online/digital sales channels' },
  { key: 'FIELD_SALES', label: 'Field Sales', category: 'Sales', description: 'Handles on-field sales activities' },
  { key: 'FIELD_SALES_MANAGER', label: 'Field Sales Manager', category: 'Sales', description: 'Manages field sales team' },

  // Channel Partners
  { key: 'PARTNERSHIP_MANAGER', label: 'Partnership Manager', category: 'Channel Partners', description: 'Manages partner relationships' },
  { key: 'CHANNEL_MANAGER', label: 'Channel Manager', category: 'Channel Partners', description: 'Manages distribution channels' },
  { key: 'PAYOUT_SPECIALIST', label: 'Payout Specialist', category: 'Channel Partners', description: 'Handles partner payout processing' },

  // Finance & Accounts
  { key: 'ACCOUNTANT', label: 'Accountant', category: 'Finance & Accounts', description: 'Handles financial records' },
  { key: 'FINANCE_MANAGER', label: 'Finance Manager', category: 'Finance & Accounts', description: 'Manages financial operations' },
  { key: 'AUDITOR', label: 'Auditor', category: 'Finance & Accounts', description: 'Handles internal auditing' },
  { key: 'BILLING_EXECUTIVE', label: 'Billing Executive', category: 'Finance & Accounts', description: 'Manages billing and invoicing' },

  // Support
  { key: 'CUSTOMER_SUPPORT', label: 'Customer Support', category: 'Support', description: 'Handles customer queries' },
  { key: 'CUSTOMER_SUPPORT_MANAGER', label: 'Customer Support Manager', category: 'Support', description: 'Manages customer support team' },
  { key: 'PARTNER_SUPPORT', label: 'Partner Support', category: 'Support', description: 'Handles partner queries' },
  { key: 'PARTNER_SUPPORT_MANAGER', label: 'Partner Support Manager', category: 'Support', description: 'Manages partner support team' },
  { key: 'TECHNICAL_SUPPORT', label: 'Technical Support', category: 'Support', description: 'Handles technical issues' },
  { key: 'TECHNICAL_SUPPORT_MANAGER', label: 'Technical Support Manager', category: 'Support', description: 'Manages technical support team' },

  // Compliance & Training
  { key: 'COMPLIANCE_OFFICER', label: 'Compliance Officer', category: 'Compliance & Training', description: 'Ensures regulatory compliance' },
  { key: 'TRAINING_DEVELOPMENT_EXECUTIVE', label: 'Training & Development Executive', category: 'Compliance & Training', description: 'Handles employee training programs' },

  // Operations & Admin
  { key: 'OPERATIONS_MANAGER', label: 'Operations Manager', category: 'Operations & Admin', description: 'Manages daily operations' },
  { key: 'OPERATIONS_EXECUTIVE', label: 'Operations Executive', category: 'Operations & Admin', description: 'Handles operational tasks' },
  { key: 'DATA_ENTRY_OPERATOR', label: 'Data Entry Operator', category: 'Operations & Admin', description: 'Handles data entry tasks' },
  { key: 'IT_ADMIN', label: 'IT Admin', category: 'Operations & Admin', description: 'Manages IT infrastructure' },

  // HR
  { key: 'HR_EXECUTIVE', label: 'HR Executive', category: 'HR', description: 'Handles HR operations' },
  { key: 'HR_MANAGER', label: 'HR Manager', category: 'HR', description: 'Manages HR department' },
]

/**
 * Get employee sub-roles grouped by category
 */
export function getEmployeeSubRolesByCategory(): Record<string, RoleDefinition[]> {
  return EMPLOYEE_SUB_ROLES.reduce((acc, role) => {
    if (!acc[role.category]) acc[role.category] = []
    acc[role.category].push(role)
    return acc
  }, {} as Record<string, RoleDefinition[]>)
}

/**
 * Get all employee sub-role keys as a flat array
 */
export function getEmployeeSubRoleKeys(): string[] {
  return EMPLOYEE_SUB_ROLES.map(r => r.key)
}

/**
 * Find an employee sub-role by key
 */
export function findEmployeeSubRole(key: string): RoleDefinition | undefined {
  return EMPLOYEE_SUB_ROLES.find(r => r.key === key)
}

// ─── Partner Sub-Roles ────────────────────────────────────────────────

export const PARTNER_SUB_ROLES: RoleDefinition[] = [
  { key: 'BUSINESS_ASSOCIATE', label: 'Business Associate (BA)', category: 'Partner', description: 'Individual loan agent' },
  { key: 'BUSINESS_PARTNER', label: 'Business Partner (BP)', category: 'Partner', description: 'Business entity partnering for loans' },
  { key: 'CHANNEL_PARTNER', label: 'Channel Partner (CP)', category: 'Partner', description: 'Distribution channel partner' },
  { key: 'CONNECTOR', label: 'Connector', category: 'Partner', description: 'Referral-only partner' },
  { key: 'DSA', label: 'DSA (Direct Selling Agent)', category: 'Partner', description: 'Direct selling agent for banks' },
  { key: 'SUB_DSA', label: 'Sub DSA', category: 'Partner', description: 'Agent under a DSA' },
]

// ─── Vendor Sub-Roles ─────────────────────────────────────────────────

export const VENDOR_SUB_ROLES: RoleDefinition[] = [
  { key: 'BANK', label: 'Bank', category: 'Financial Institution', description: 'Public/private sector bank' },
  { key: 'NBFC', label: 'NBFC', category: 'Financial Institution', description: 'Non-Banking Financial Company' },
  { key: 'HFC', label: 'HFC', category: 'Financial Institution', description: 'Housing Finance Company' },
  { key: 'MICROFINANCE', label: 'Microfinance', category: 'Financial Institution', description: 'Microfinance institution' },
  { key: 'INSURANCE', label: 'Insurance', category: 'Service Provider', description: 'Insurance provider' },
  { key: 'LEGAL', label: 'Legal', category: 'Service Provider', description: 'Legal services provider' },
  { key: 'VALUATION', label: 'Valuation', category: 'Service Provider', description: 'Property/asset valuation firm' },
  { key: 'TECHNICAL', label: 'Technical', category: 'Service Provider', description: 'Technical services provider' },
  { key: 'CREDIT_BUREAU', label: 'Credit Bureau', category: 'Service Provider', description: 'Credit scoring agency' },
]

// ─── Employee Status Options ──────────────────────────────────────────

export const EMPLOYEE_STATUS_OPTIONS = [
  { key: 'ACTIVE', label: 'Active', variant: 'success' as const },
  { key: 'INACTIVE', label: 'Inactive', variant: 'error' as const },
  { key: 'PROBATION', label: 'Probation', variant: 'warning' as const },
  { key: 'ON_LEAVE', label: 'On Leave', variant: 'warning' as const },
  { key: 'SUSPENDED', label: 'Suspended', variant: 'error' as const },
  { key: 'TERMINATED', label: 'Terminated', variant: 'error' as const },
  { key: 'RESIGNED', label: 'Resigned', variant: 'neutral' as const },
  { key: 'NOTICE_PERIOD', label: 'Notice Period', variant: 'warning' as const },
] as const

// ─── Department Options ───────────────────────────────────────────────

export const DEPARTMENT_OPTIONS = [
  'SALES',
  'OPERATIONS',
  'FINANCE',
  'ADMIN',
  'HR',
  'SUPPORT',
  'COMPLIANCE',
  'IT',
  'MARKETING',
  'LEGAL',
  'TRAINING',
] as const
