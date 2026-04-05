/**
 * Business Entity Types and Related Constants
 *
 * This file defines entity types, member roles, and industry categories
 * for the Business Entity registration and management system.
 */

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface EntityType {
  key: string
  name: string
  description: string
  icon: string
  minMembers: number
  maxMembers: number | null  // null = unlimited
  memberRoles: string[]  // Allowed roles for this entity type
  requiredDocuments: string[]
  panPrefix?: string  // Some entities have specific PAN prefixes
}

export const ENTITY_TYPES: Record<string, EntityType> = {
  // 1. PROPRIETORSHIP
  PROPRIETORSHIP: {
    key: 'PROPRIETORSHIP',
    name: 'Sole Proprietorship',
    description: 'Single owner business with no separate legal entity',
    icon: 'User',
    minMembers: 1,
    maxMembers: 1,
    memberRoles: ['PROPRIETOR'],
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'SHOP_ACT', 'BANK_STATEMENT'],
    panPrefix: undefined  // Uses owner's personal PAN
  },

  // 2. PARTNERSHIP (Unregistered)
  PARTNERSHIP_UNREGISTERED: {
    key: 'PARTNERSHIP_UNREGISTERED',
    name: 'Partnership Firm (Unregistered)',
    description: 'Partnership business not registered with Registrar of Firms',
    icon: 'Users',
    minMembers: 2,
    maxMembers: 50,
    memberRoles: ['PARTNER', 'MANAGING_PARTNER', 'SLEEPING_PARTNER'],
    requiredDocuments: ['FIRM_PAN', 'GST_CERTIFICATE', 'PARTNERSHIP_DEED', 'BANK_STATEMENT', 'ITR'],
    panPrefix: 'A'
  },

  // 3. PARTNERSHIP (Registered)
  PARTNERSHIP_REGISTERED: {
    key: 'PARTNERSHIP_REGISTERED',
    name: 'Partnership Firm (Registered)',
    description: 'Partnership registered with Registrar of Firms',
    icon: 'Users',
    minMembers: 2,
    maxMembers: 50,
    memberRoles: ['PARTNER', 'MANAGING_PARTNER', 'SLEEPING_PARTNER'],
    requiredDocuments: ['FIRM_PAN', 'GST_CERTIFICATE', 'PARTNERSHIP_DEED', 'REGISTRATION_CERT', 'BANK_STATEMENT', 'ITR'],
    panPrefix: 'A'
  },

  // Legacy PARTNERSHIP key for backward compatibility
  PARTNERSHIP: {
    key: 'PARTNERSHIP',
    name: 'Partnership Firm',
    description: 'Traditional partnership with 2 or more partners',
    icon: 'Handshake',
    minMembers: 2,
    maxMembers: 20,
    memberRoles: ['PARTNER', 'MANAGING_PARTNER', 'SLEEPING_PARTNER'],
    requiredDocuments: ['FIRM_PAN', 'GST_CERTIFICATE', 'PARTNERSHIP_DEED', 'BANK_STATEMENT', 'ITR'],
    panPrefix: 'A'
  },

  // 4. LLP
  LLP: {
    key: 'LLP',
    name: 'Limited Liability Partnership',
    description: 'Partnership with limited liability, registered under LLP Act 2008',
    icon: 'Shield',
    minMembers: 2,
    maxMembers: null,  // Unlimited
    memberRoles: ['DESIGNATED_PARTNER', 'PARTNER'],
    requiredDocuments: ['LLP_PAN', 'GST_CERTIFICATE', 'LLP_AGREEMENT', 'INCORPORATION_CERT', 'ITR', 'BANK_STATEMENT'],
    panPrefix: 'A'
  },

  // 5. PRIVATE LIMITED
  PRIVATE_LIMITED: {
    key: 'PRIVATE_LIMITED',
    name: 'Private Limited Company',
    description: 'Company incorporated under Companies Act 2013 with limited liability',
    icon: 'Building2',
    minMembers: 2,
    maxMembers: 200,
    memberRoles: ['DIRECTOR', 'MANAGING_DIRECTOR', 'WHOLE_TIME_DIRECTOR', 'SHAREHOLDER', 'COMPANY_SECRETARY'],
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'],
    panPrefix: 'A'
  },

  // 6. PUBLIC LIMITED (Unlisted)
  PUBLIC_LIMITED_UNLISTED: {
    key: 'PUBLIC_LIMITED_UNLISTED',
    name: 'Public Limited Company (Unlisted)',
    description: 'Public company not listed on stock exchange',
    icon: 'Landmark',
    minMembers: 7,
    maxMembers: null,
    memberRoles: ['DIRECTOR', 'MANAGING_DIRECTOR', 'WHOLE_TIME_DIRECTOR', 'SHAREHOLDER', 'COMPANY_SECRETARY', 'CFO', 'CEO'],
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'],
    panPrefix: 'A'
  },

  // 7. PUBLIC LIMITED (Listed)
  PUBLIC_LIMITED_LISTED: {
    key: 'PUBLIC_LIMITED_LISTED',
    name: 'Public Limited Company (Listed)',
    description: 'Public company listed on stock exchange',
    icon: 'TrendingUp',
    minMembers: 7,
    maxMembers: null,
    memberRoles: ['DIRECTOR', 'MANAGING_DIRECTOR', 'WHOLE_TIME_DIRECTOR', 'SHAREHOLDER', 'COMPANY_SECRETARY', 'CFO', 'CEO'],
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS', 'SEBI_COMPLIANCE'],
    panPrefix: 'A'
  },

  // Legacy PUBLIC_LIMITED key for backward compatibility
  PUBLIC_LIMITED: {
    key: 'PUBLIC_LIMITED',
    name: 'Public Limited Company',
    description: 'Public company with shares listed or available to public',
    icon: 'TrendingUp',
    minMembers: 7,
    maxMembers: null,
    memberRoles: ['DIRECTOR', 'MANAGING_DIRECTOR', 'WHOLE_TIME_DIRECTOR', 'SHAREHOLDER', 'COMPANY_SECRETARY', 'CFO', 'CEO'],
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'],
    panPrefix: 'A'
  },

  // 8. OPC
  OPC: {
    key: 'OPC',
    name: 'One Person Company',
    description: 'Single member company with limited liability',
    icon: 'UserCheck',
    minMembers: 1,
    maxMembers: 1,
    memberRoles: ['DIRECTOR', 'NOMINEE'],
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'ITR'],
    panPrefix: 'A'
  },

  // 9. HUF
  HUF: {
    key: 'HUF',
    name: 'Hindu Undivided Family',
    description: 'Traditional Hindu family business structure',
    icon: 'Home',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['KARTA', 'COPARCENER', 'MEMBER'],
    requiredDocuments: ['HUF_PAN', 'HUF_DEED', 'ITR', 'BANK_STATEMENT'],
    panPrefix: 'H'
  },

  // 10. TRUST (Private)
  TRUST_PRIVATE: {
    key: 'TRUST_PRIVATE',
    name: 'Private Trust',
    description: 'Trust created for private/family benefit',
    icon: 'Heart',
    minMembers: 1,
    maxMembers: null,
    memberRoles: ['TRUSTEE', 'MANAGING_TRUSTEE', 'SETTLER', 'BENEFICIARY'],
    requiredDocuments: ['TRUST_PAN', 'TRUST_DEED', 'REGISTRATION_CERT', 'AUDITED_ACCOUNTS'],
    panPrefix: 'T'
  },

  // 11. TRUST (Charitable)
  TRUST_CHARITABLE: {
    key: 'TRUST_CHARITABLE',
    name: 'Charitable/Public Trust',
    description: 'Trust for charitable or public purposes',
    icon: 'HeartHandshake',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['TRUSTEE', 'MANAGING_TRUSTEE'],
    requiredDocuments: ['TRUST_PAN', 'TRUST_DEED', 'REGISTRATION_CERT', '12A_CERT', '80G_CERT', 'AUDITED_ACCOUNTS'],
    panPrefix: 'T'
  },

  // Legacy TRUST key for backward compatibility
  TRUST: {
    key: 'TRUST',
    name: 'Trust',
    description: 'Registered trust (charitable or private)',
    icon: 'Shield',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['TRUSTEE', 'MANAGING_TRUSTEE', 'SETTLER', 'BENEFICIARY'],
    requiredDocuments: ['TRUST_PAN', 'TRUST_DEED', 'REGISTRATION_CERT', 'AUDITED_ACCOUNTS'],
    panPrefix: 'T'
  },

  // 12. SOCIETY
  SOCIETY: {
    key: 'SOCIETY',
    name: 'Registered Society',
    description: 'Society registered under Societies Registration Act 1860',
    icon: 'Users',
    minMembers: 7,
    maxMembers: null,
    memberRoles: ['PRESIDENT', 'SECRETARY', 'TREASURER', 'MEMBER', 'GOVERNING_BODY_MEMBER'],
    requiredDocuments: ['SOCIETY_PAN', 'REGISTRATION_CERT', 'BYLAWS', 'AUDITED_ACCOUNTS'],
    panPrefix: 'A'
  },

  // 13. COOPERATIVE
  COOPERATIVE: {
    key: 'COOPERATIVE',
    name: 'Cooperative Society',
    description: 'Society registered under Cooperative Societies Act',
    icon: 'Handshake',
    minMembers: 10,
    maxMembers: null,
    memberRoles: ['CHAIRMAN', 'VICE_CHAIRMAN', 'SECRETARY', 'TREASURER', 'DIRECTOR', 'MEMBER'],
    requiredDocuments: ['COOP_PAN', 'REGISTRATION_CERT', 'BYLAWS', 'ANNUAL_REPORT', 'AUDITED_ACCOUNTS'],
    panPrefix: 'A'
  },

  // 14. SECTION 8 COMPANY
  SECTION_8: {
    key: 'SECTION_8',
    name: 'Section 8 Company',
    description: 'Non-profit company under Section 8 of Companies Act',
    icon: 'Gift',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['DIRECTOR', 'MANAGING_DIRECTOR', 'COMPANY_SECRETARY'],
    requiredDocuments: ['COMPANY_PAN', 'SECTION_8_LICENSE', 'MOA_AOA', 'INCORPORATION_CERT', '12A_CERT', '80G_CERT'],
    panPrefix: 'A'
  },

  // 15. PRODUCER COMPANY
  PRODUCER_COMPANY: {
    key: 'PRODUCER_COMPANY',
    name: 'Producer Company',
    description: 'Company of agricultural producers',
    icon: 'Wheat',
    minMembers: 10,
    maxMembers: null,
    memberRoles: ['CHAIRMAN', 'DIRECTOR', 'CEO', 'MEMBER'],
    requiredDocuments: ['COMPANY_PAN', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION'],
    panPrefix: 'A'
  },

  // 16. AOP
  AOP: {
    key: 'AOP',
    name: 'Association of Persons',
    description: 'Group of persons with common purpose',
    icon: 'Users',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['AUTHORIZED_MEMBER', 'MEMBER'],
    requiredDocuments: ['AOP_PAN', 'AOP_AGREEMENT', 'ALL_MEMBERS_PAN', 'BANK_STATEMENT'],
    panPrefix: 'A'
  },

  // 17. BOI
  BOI: {
    key: 'BOI',
    name: 'Body of Individuals',
    description: 'Group of individuals with common purpose',
    icon: 'Users',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['AUTHORIZED_MEMBER', 'MEMBER'],
    requiredDocuments: ['BOI_PAN', 'BOI_AGREEMENT', 'ALL_MEMBERS_PAN', 'BANK_STATEMENT'],
    panPrefix: 'A'
  },

  // 18. JV (Incorporated)
  JV_INCORPORATED: {
    key: 'JV_INCORPORATED',
    name: 'Joint Venture (Incorporated)',
    description: 'JV formed as separate company or LLP',
    icon: 'GitMerge',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['DIRECTOR', 'NOMINEE_DIRECTOR'],
    requiredDocuments: ['JV_AGREEMENT', 'INCORPORATION_CERT', 'MOA_AOA', 'BOARD_RESOLUTION', 'COMPANY_PAN'],
    panPrefix: 'A'
  },

  // 19. JV (Unincorporated)
  JV_UNINCORPORATED: {
    key: 'JV_UNINCORPORATED',
    name: 'Joint Venture (Unincorporated)',
    description: 'JV as contractual arrangement (AOP)',
    icon: 'GitMerge',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['LEAD_MEMBER', 'MEMBER'],
    requiredDocuments: ['JV_AGREEMENT', 'JV_PAN', 'ALL_MEMBERS_AUTHORIZATION', 'BANK_STATEMENT'],
    panPrefix: 'A'
  },

  // 20. CONSORTIUM
  CONSORTIUM: {
    key: 'CONSORTIUM',
    name: 'Consortium',
    description: 'Group of entities for specific project',
    icon: 'Network',
    minMembers: 2,
    maxMembers: null,
    memberRoles: ['LEAD_MEMBER', 'MEMBER'],
    requiredDocuments: ['CONSORTIUM_AGREEMENT', 'ALL_MEMBERS_BOARD_RESOLUTION', 'BANK_STATEMENT'],
    panPrefix: undefined
  }
}

// ============================================================================
// MEMBER ROLES
// ============================================================================

export interface MemberRole {
  key: string
  name: string
  description: string
  canBeSignatory: boolean
  canManageEntity: boolean
  entityTypes: string[]  // Which entity types can have this role
}

export const MEMBER_ROLES: Record<string, MemberRole> = {
  // Proprietorship
  PROPRIETOR: {
    key: 'PROPRIETOR',
    name: 'Proprietor / Owner',
    description: 'Sole owner of the proprietorship',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PROPRIETORSHIP']
  },

  // Partnership
  PARTNER: {
    key: 'PARTNER',
    name: 'Partner',
    description: 'General partner in the firm',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PARTNERSHIP', 'LLP']
  },
  MANAGING_PARTNER: {
    key: 'MANAGING_PARTNER',
    name: 'Managing Partner',
    description: 'Partner with management responsibilities',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PARTNERSHIP']
  },
  SLEEPING_PARTNER: {
    key: 'SLEEPING_PARTNER',
    name: 'Sleeping Partner',
    description: 'Partner who invests but does not manage',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['PARTNERSHIP']
  },
  DESIGNATED_PARTNER: {
    key: 'DESIGNATED_PARTNER',
    name: 'Designated Partner',
    description: 'Partner with designated responsibilities in LLP',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['LLP']
  },

  // Company
  DIRECTOR: {
    key: 'DIRECTOR',
    name: 'Director',
    description: 'Board member of the company',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OPC']
  },
  MANAGING_DIRECTOR: {
    key: 'MANAGING_DIRECTOR',
    name: 'Managing Director',
    description: 'Director with executive management powers',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED']
  },
  WHOLE_TIME_DIRECTOR: {
    key: 'WHOLE_TIME_DIRECTOR',
    name: 'Whole-time Director',
    description: 'Full-time director of the company',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED']
  },
  SHAREHOLDER: {
    key: 'SHAREHOLDER',
    name: 'Shareholder',
    description: 'Equity holder in the company',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED']
  },
  COMPANY_SECRETARY: {
    key: 'COMPANY_SECRETARY',
    name: 'Company Secretary',
    description: 'Statutory compliance officer',
    canBeSignatory: true,
    canManageEntity: false,
    entityTypes: ['PRIVATE_LIMITED', 'PUBLIC_LIMITED']
  },
  CEO: {
    key: 'CEO',
    name: 'Chief Executive Officer',
    description: 'Chief Executive Officer',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['PUBLIC_LIMITED']
  },
  CFO: {
    key: 'CFO',
    name: 'Chief Financial Officer',
    description: 'Chief Financial Officer',
    canBeSignatory: true,
    canManageEntity: false,
    entityTypes: ['PUBLIC_LIMITED']
  },
  NOMINEE: {
    key: 'NOMINEE',
    name: 'Nominee',
    description: 'Nominee director for OPC',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['OPC']
  },

  // HUF
  KARTA: {
    key: 'KARTA',
    name: 'Karta',
    description: 'Head of the Hindu Undivided Family',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['HUF']
  },
  COPARCENER: {
    key: 'COPARCENER',
    name: 'Coparcener',
    description: 'Joint heir in the HUF',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['HUF']
  },

  // Trust
  TRUSTEE: {
    key: 'TRUSTEE',
    name: 'Trustee',
    description: 'Person holding property for beneficiaries',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['TRUST']
  },
  MANAGING_TRUSTEE: {
    key: 'MANAGING_TRUSTEE',
    name: 'Managing Trustee',
    description: 'Trustee with primary management duties',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['TRUST']
  },
  SETTLER: {
    key: 'SETTLER',
    name: 'Settler',
    description: 'Person who created the trust',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['TRUST']
  },
  BENEFICIARY: {
    key: 'BENEFICIARY',
    name: 'Beneficiary',
    description: 'Person who benefits from the trust',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['TRUST']
  },

  // Society
  PRESIDENT: {
    key: 'PRESIDENT',
    name: 'President',
    description: 'Head of the society',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['SOCIETY']
  },
  SECRETARY: {
    key: 'SECRETARY',
    name: 'Secretary',
    description: 'Administrative head of the society',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['SOCIETY']
  },
  TREASURER: {
    key: 'TREASURER',
    name: 'Treasurer',
    description: 'Financial head of the society',
    canBeSignatory: true,
    canManageEntity: false,
    entityTypes: ['SOCIETY']
  },
  GOVERNING_BODY_MEMBER: {
    key: 'GOVERNING_BODY_MEMBER',
    name: 'Governing Body Member',
    description: 'Member of the governing body',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['SOCIETY']
  },
  MEMBER: {
    key: 'MEMBER',
    name: 'Member',
    description: 'General member',
    canBeSignatory: false,
    canManageEntity: false,
    entityTypes: ['HUF', 'SOCIETY', 'COOPERATIVE']
  },

  // Cooperative Society Roles
  CHAIRMAN: {
    key: 'CHAIRMAN',
    name: 'Chairman',
    description: 'Elected head of the cooperative society',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['COOPERATIVE', 'PRODUCER_COMPANY']
  },
  VICE_CHAIRMAN: {
    key: 'VICE_CHAIRMAN',
    name: 'Vice Chairman',
    description: 'Deputy head of the cooperative society',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['COOPERATIVE']
  },

  // AOP/BOI Roles
  AUTHORIZED_MEMBER: {
    key: 'AUTHORIZED_MEMBER',
    name: 'Authorized Member',
    description: 'Member authorized to sign on behalf of the group',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['AOP', 'BOI']
  },

  // JV Roles
  LEAD_MEMBER: {
    key: 'LEAD_MEMBER',
    name: 'Lead Member',
    description: 'Lead member of joint venture or consortium',
    canBeSignatory: true,
    canManageEntity: true,
    entityTypes: ['JV_UNINCORPORATED', 'CONSORTIUM']
  },
  NOMINEE_DIRECTOR: {
    key: 'NOMINEE_DIRECTOR',
    name: 'Nominee Director',
    description: 'Director nominated by a JV partner',
    canBeSignatory: true,
    canManageEntity: false,
    entityTypes: ['JV_INCORPORATED']
  }
}

// ============================================================================
// INDUSTRY CATEGORIES
// ============================================================================

export interface IndustryCategory {
  key: string
  name: string
  subCategories?: string[]
}

export const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    key: 'MANUFACTURING',
    name: 'Manufacturing',
    subCategories: ['Textiles', 'Food Processing', 'Chemicals', 'Pharmaceuticals', 'Automobiles', 'Electronics', 'Machinery', 'Other Manufacturing']
  },
  {
    key: 'TRADING',
    name: 'Trading & Wholesale',
    subCategories: ['Wholesale', 'Retail', 'Import/Export', 'Distribution', 'E-commerce']
  },
  {
    key: 'SERVICES',
    name: 'Services',
    subCategories: ['IT/Software', 'Consulting', 'Legal', 'Accounting', 'Healthcare', 'Education', 'Hospitality', 'Real Estate', 'Transportation', 'Other Services']
  },
  {
    key: 'CONSTRUCTION',
    name: 'Construction & Infrastructure',
    subCategories: ['Residential', 'Commercial', 'Infrastructure', 'Interior Design']
  },
  {
    key: 'AGRICULTURE',
    name: 'Agriculture & Allied',
    subCategories: ['Farming', 'Dairy', 'Poultry', 'Fishery', 'Food Processing', 'Agri-Tech']
  },
  {
    key: 'FINANCE',
    name: 'Financial Services',
    subCategories: ['NBFC', 'Insurance', 'Stock Broking', 'Mutual Funds', 'Fintech']
  },
  {
    key: 'MEDIA',
    name: 'Media & Entertainment',
    subCategories: ['Film Production', 'Advertising', 'Publishing', 'Digital Media', 'Events']
  },
  {
    key: 'ENERGY',
    name: 'Energy & Utilities',
    subCategories: ['Power Generation', 'Renewable Energy', 'Oil & Gas', 'Mining']
  },
  {
    key: 'HEALTHCARE',
    name: 'Healthcare & Pharma',
    subCategories: ['Hospitals', 'Clinics', 'Diagnostics', 'Pharmaceuticals', 'Medical Devices']
  },
  {
    key: 'OTHER',
    name: 'Other',
    subCategories: []
  }
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all entity types as array
 */
export const getEntityTypes = (): EntityType[] => {
  return Object.values(ENTITY_TYPES)
}

/**
 * Get entity type by key
 */
export const getEntityType = (key: string): EntityType | undefined => {
  return ENTITY_TYPES[key]
}

/**
 * Get member roles for a specific entity type
 */
export const getMemberRolesForEntityType = (entityType: string): MemberRole[] => {
  const entity = ENTITY_TYPES[entityType]
  if (!entity) return []

  return entity.memberRoles
    .map(roleKey => MEMBER_ROLES[roleKey])
    .filter(Boolean)
}

/**
 * Get all industry categories
 */
export const getIndustryCategories = (): IndustryCategory[] => {
  return INDUSTRY_CATEGORIES
}

/**
 * Check if entity type allows more members
 */
export const canAddMoreMembers = (entityType: string, currentMemberCount: number): boolean => {
  const entity = ENTITY_TYPES[entityType]
  if (!entity) return false

  if (entity.maxMembers === null) return true
  return currentMemberCount < entity.maxMembers
}

/**
 * Get minimum required members for entity type
 */
export const getMinMembers = (entityType: string): number => {
  return ENTITY_TYPES[entityType]?.minMembers || 1
}

/**
 * Check if member role can be signatory
 */
export const canBeSignatory = (roleKey: string): boolean => {
  return MEMBER_ROLES[roleKey]?.canBeSignatory || false
}

/**
 * Check if member role can manage entity
 */
export const canManageEntity = (roleKey: string): boolean => {
  return MEMBER_ROLES[roleKey]?.canManageEntity || false
}

/**
 * Get admin roles for entity type (roles that can manage)
 */
export const getAdminRolesForEntityType = (entityType: string): MemberRole[] => {
  return getMemberRolesForEntityType(entityType).filter(role => role.canManageEntity)
}

/**
 * Validate if role is valid for entity type
 */
export const isValidRoleForEntityType = (entityType: string, roleKey: string): boolean => {
  const entity = ENTITY_TYPES[entityType]
  return entity?.memberRoles.includes(roleKey) || false
}
