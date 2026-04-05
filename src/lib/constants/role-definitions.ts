/**
 * Role Definitions
 * This file contains all sub-role definitions for Partners, Employees, and Customers
 * These can be managed dynamically by Super Admin through the admin panel
 */

export interface RoleDefinition {
  key: string
  name: string
  type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'
  description: string
  isActive: boolean
  displayOrder: number
  permissions?: Record<string, boolean>
}

/**
 * Partner Sub-Roles
 */
export const PARTNER_SUB_ROLES: RoleDefinition[] = [
  {
    key: 'BUSINESS_ASSOCIATE',
    name: 'Business Associate',
    type: 'PARTNER',
    description: 'Independent business associate working with LOANZ 360',
    isActive: true,
    displayOrder: 1
  },
  {
    key: 'BUSINESS_PARTNER',
    name: 'Business Partner',
    type: 'PARTNER',
    description: 'Strategic business partner with higher commission rates',
    isActive: true,
    displayOrder: 2
  },
  {
    key: 'CHANNEL_PARTNER',
    name: 'Channel Partner',
    type: 'PARTNER',
    description: 'Channel partner managing multiple associates',
    isActive: true,
    displayOrder: 3
  }
]

/**
 * Employee Sub-Roles
 */
export const EMPLOYEE_SUB_ROLES: RoleDefinition[] = [
  {
    key: 'CRO',
    name: 'Customer Relationship Officer',
    type: 'EMPLOYEE',
    description: 'Manages customer relationships and support',
    isActive: true,
    displayOrder: 10
  },
  {
    key: 'CRO_TEAM_LEADER',
    name: 'CRO Team Leader',
    type: 'EMPLOYEE',
    description: 'Manages a team of CROs - supervisory role',
    isActive: true,
    displayOrder: 11
  },
  {
    key: 'CRO_STATE_MANAGER',
    name: 'CRO State Manager',
    type: 'EMPLOYEE',
    description: 'Manages CRO Team Leaders across a state',
    isActive: true,
    displayOrder: 12
  },
  {
    key: 'BUSINESS_DEVELOPMENT_EXECUTIVE',
    name: 'Business Development Executive',
    type: 'EMPLOYEE',
    description: 'Focuses on new business acquisition',
    isActive: true,
    displayOrder: 11
  },
  {
    key: 'BUSINESS_DEVELOPMENT_MANAGER',
    name: 'Business Development Manager',
    type: 'EMPLOYEE',
    description: 'Manages business development team',
    isActive: true,
    displayOrder: 12
  },
  {
    key: 'DIGITAL_SALES',
    name: 'Digital Sales',
    type: 'EMPLOYEE',
    description: 'Handles online and digital sales channels',
    isActive: true,
    displayOrder: 13
  },
  {
    key: 'CHANNEL_PARTNER_EXECUTIVE',
    name: 'Channel Partner Executive',
    type: 'EMPLOYEE',
    description: 'Manages channel partner relationships and operations',
    isActive: true,
    displayOrder: 14
  },
  {
    key: 'CHANNEL_PARTNER_MANAGER',
    name: 'Channel Partner Manager',
    type: 'EMPLOYEE',
    description: 'Manages channel partner team and strategies',
    isActive: true,
    displayOrder: 15
  },
  {
    key: 'FINANCE_EXECUTIVE',
    name: 'Finance Executive',
    type: 'EMPLOYEE',
    description: 'Handles financial operations',
    isActive: true,
    displayOrder: 16
  },
  {
    key: 'ACCOUNTS_EXECUTIVE',
    name: 'Accounts Executive',
    type: 'EMPLOYEE',
    description: 'Manages accounting tasks',
    isActive: true,
    displayOrder: 17
  },
  {
    key: 'ACCOUNTS_MANAGER',
    name: 'Accounts Manager',
    type: 'EMPLOYEE',
    description: 'Oversees accounting department',
    isActive: true,
    displayOrder: 18
  },
  {
    key: 'DIRECT_SALES_EXECUTIVE',
    name: 'Direct Sales Executive',
    type: 'EMPLOYEE',
    description: 'Direct customer sales',
    isActive: true,
    displayOrder: 19
  },
  {
    key: 'DIRECT_SALES_MANAGER',
    name: 'Direct Sales Manager',
    type: 'EMPLOYEE',
    description: 'Manages direct sales team',
    isActive: true,
    displayOrder: 20
  },
  {
    key: 'TELE_SALES',
    name: 'Tele Sales',
    type: 'EMPLOYEE',
    description: 'Tele sales representative handling phone-based sales',
    isActive: true,
    displayOrder: 21
  }
]

/**
 * Customer Sub-Roles
 */
export const CUSTOMER_SUB_ROLES: RoleDefinition[] = [
  {
    key: 'INDIVIDUAL',
    name: 'Individual',
    type: 'CUSTOMER',
    description: 'Individual customer',
    isActive: true,
    displayOrder: 30
  },
  {
    key: 'SALARIED',
    name: 'Salaried',
    type: 'CUSTOMER',
    description: 'Salaried employee customer',
    isActive: true,
    displayOrder: 31
  },
  {
    key: 'PROPRIETOR',
    name: 'Proprietor',
    type: 'CUSTOMER',
    description: 'Sole proprietorship business owner',
    isActive: true,
    displayOrder: 32
  },
  {
    key: 'PARTNERSHIP',
    name: 'Partnership',
    type: 'CUSTOMER',
    description: 'Partnership firm',
    isActive: true,
    displayOrder: 33
  },
  {
    key: 'PRIVATE_LIMITED_COMPANY',
    name: 'Private Limited Company',
    type: 'CUSTOMER',
    description: 'Private limited company',
    isActive: true,
    displayOrder: 34
  },
  {
    key: 'PUBLIC_LIMITED_COMPANY',
    name: 'Public Limited Company',
    type: 'CUSTOMER',
    description: 'Public limited company',
    isActive: true,
    displayOrder: 35
  },
  {
    key: 'LLP',
    name: 'LLP (Limited Liability Partnership)',
    type: 'CUSTOMER',
    description: 'Limited liability partnership',
    isActive: true,
    displayOrder: 36
  },
  {
    key: 'DOCTOR',
    name: 'Doctor',
    type: 'CUSTOMER',
    description: 'Medical professional',
    isActive: true,
    displayOrder: 37
  },
  {
    key: 'LAWYER',
    name: 'Lawyer',
    type: 'CUSTOMER',
    description: 'Legal professional',
    isActive: true,
    displayOrder: 38
  },
  {
    key: 'PURE_RENTAL',
    name: 'Pure Rental',
    type: 'CUSTOMER',
    description: 'Income from rental properties',
    isActive: true,
    displayOrder: 39
  },
  {
    key: 'AGRICULTURE',
    name: 'Agriculture',
    type: 'CUSTOMER',
    description: 'Agricultural business',
    isActive: true,
    displayOrder: 40
  },
  {
    key: 'NRI',
    name: 'NRI',
    type: 'CUSTOMER',
    description: 'Non-Resident Indian',
    isActive: true,
    displayOrder: 41
  },
  {
    key: 'CHARTERED_ACCOUNTANT',
    name: 'Chartered Accountant',
    type: 'CUSTOMER',
    description: 'Certified accounting professional',
    isActive: true,
    displayOrder: 42
  },
  {
    key: 'COMPANY_SECRETARY',
    name: 'Company Secretary',
    type: 'CUSTOMER',
    description: 'Company secretarial professional',
    isActive: true,
    displayOrder: 43
  },
  {
    key: 'HUF',
    name: 'HUF (Hindu Undivided Family)',
    type: 'CUSTOMER',
    description: 'Hindu undivided family entity',
    isActive: true,
    displayOrder: 44
  }
]

/**
 * Get all role definitions
 */
export const getAllRoleDefinitions = (): RoleDefinition[] => {
  return [...PARTNER_SUB_ROLES, ...EMPLOYEE_SUB_ROLES, ...CUSTOMER_SUB_ROLES]
}

/**
 * Get role definitions by type
 */
export const getRoleDefinitionsByType = (type: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'): RoleDefinition[] => {
  switch (type) {
    case 'PARTNER':
      return PARTNER_SUB_ROLES
    case 'EMPLOYEE':
      return EMPLOYEE_SUB_ROLES
    case 'CUSTOMER':
      return CUSTOMER_SUB_ROLES
    default:
      return []
  }
}

/**
 * Get role definition by key
 */
export const getRoleDefinitionByKey = (key: string): RoleDefinition | undefined => {
  return getAllRoleDefinitions().find(role => role.key === key)
}

/**
 * Get role display name by key
 */
export const getRoleDisplayName = (key: string): string => {
  const role = getRoleDefinitionByKey(key)
  return role?.name || key
}

/**
 * Check if a sub-role key is valid
 */
export const isValidSubRole = (key: string, type?: 'PARTNER' | 'EMPLOYEE' | 'CUSTOMER'): boolean => {
  if (!type) {
    return getAllRoleDefinitions().some(role => role.key === key && role.isActive)
  }
  return getRoleDefinitionsByType(type).some(role => role.key === key && role.isActive)
}
