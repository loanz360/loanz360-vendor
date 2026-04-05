/**
 * Department to Sub-Role Mapping
 * Ensures department assignments align with employee sub-roles
 */

export interface DepartmentMapping {
  subRole: string
  allowedDepartments: string[]
  defaultDepartment: string
}

export const DEPARTMENT_ROLE_MAPPING: Record<string, DepartmentMapping> = {
  'CRO': {
    subRole: 'Customer Relationship Officer',
    allowedDepartments: ['Sales', 'Customer Support', 'Operations'],
    defaultDepartment: 'Customer Support'
  },
  'BUSINESS_DEVELOPMENT_EXECUTIVE': {
    subRole: 'Business Development Executive',
    allowedDepartments: ['Business Development', 'Sales'],
    defaultDepartment: 'Business Development'
  },
  'BUSINESS_DEVELOPMENT_MANAGER': {
    subRole: 'Business Development Manager',
    allowedDepartments: ['Business Development', 'Sales'],
    defaultDepartment: 'Business Development'
  },
  'DIGITAL_SALES': {
    subRole: 'Digital Sales',
    allowedDepartments: ['Digital Sales', 'Sales', 'Marketing'],
    defaultDepartment: 'Digital Sales'
  },
  'CHANNEL_PARTNER_EXECUTIVE': {
    subRole: 'Channel Partner Executive',
    allowedDepartments: ['Channel Partners', 'Sales', 'Operations'],
    defaultDepartment: 'Channel Partners'
  },
  'CHANNEL_PARTNER_MANAGER': {
    subRole: 'Channel Partner Manager',
    allowedDepartments: ['Channel Partners', 'Sales', 'Operations'],
    defaultDepartment: 'Channel Partners'
  },
  'FINANCE_EXECUTIVE': {
    subRole: 'Finance Executive',
    allowedDepartments: ['Finance', 'Accounts'],
    defaultDepartment: 'Finance'
  },
  'ACCOUNTS_EXECUTIVE': {
    subRole: 'Accounts Executive',
    allowedDepartments: ['Accounts', 'Finance'],
    defaultDepartment: 'Accounts'
  },
  'ACCOUNTS_MANAGER': {
    subRole: 'Accounts Manager',
    allowedDepartments: ['Accounts', 'Finance'],
    defaultDepartment: 'Accounts'
  },
  'DIRECT_SALES_EXECUTIVE': {
    subRole: 'Direct Sales Executive',
    allowedDepartments: ['Sales', 'Direct Sales'],
    defaultDepartment: 'Sales'
  },
  'DIRECT_SALES_MANAGER': {
    subRole: 'Direct Sales Manager',
    allowedDepartments: ['Sales', 'Direct Sales'],
    defaultDepartment: 'Sales'
  },
  'TELE_SALES': {
    subRole: 'Tele Sales',
    allowedDepartments: ['Sales', 'Direct Sales'],
    defaultDepartment: 'Sales'
  }
}

/**
 * Get allowed departments for a sub-role
 */
export function getAllowedDepartments(subRole: string): string[] {
  const mapping = DEPARTMENT_ROLE_MAPPING[subRole]
  return mapping?.allowedDepartments || ['Sales', 'Operations', 'Credit', 'Processing', 'Accounts', 'Finance']
}

/**
 * Get default department for a sub-role
 */
export function getDefaultDepartment(subRole: string): string {
  const mapping = DEPARTMENT_ROLE_MAPPING[subRole]
  return mapping?.defaultDepartment || ''
}

/**
 * Validate if department is allowed for sub-role
 */
export function isDepartmentValidForRole(department: string, subRole: string): boolean {
  const allowedDepts = getAllowedDepartments(subRole)
  return allowedDepts.includes(department)
}
