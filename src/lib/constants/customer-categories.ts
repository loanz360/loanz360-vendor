/**
 * Customer Category Hierarchy Definitions
 * 3-Level Structure: Primary Category → Sub-Category → Specific Profile
 *
 * This file defines the customer categorization system used for:
 * - Registration flow (category selection)
 * - Dashboard routing (9 category-specific dashboards)
 * - Document requirements
 * - Profile completion tracking
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Employment Type Enum
 * Used to filter categories based on customer's employment status
 */
export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED' | 'OTHER' | 'BOTH'

export const EMPLOYMENT_TYPES: Record<EmploymentType, { name: string; description: string }> = {
  SALARIED: { name: 'Salaried', description: 'Employees working for a company or organization' },
  SELF_EMPLOYED: { name: 'Self-Employed', description: 'Business owners and professionals' },
  OTHER: { name: 'Other', description: 'Pensioners, rental income, NRI, etc.' },
  BOTH: { name: 'Both', description: 'Applicable to both salaried and self-employed' }
}

export interface CustomerCategory {
  key: string
  name: string
  description: string
  icon: string
  color: string
  requiredDocuments: string[]
  additionalFields?: string[]
  employmentType?: EmploymentType
}

export interface CustomerSubCategory extends CustomerCategory {
  parentKey: string
}

export interface CustomerSpecificProfile extends CustomerCategory {
  parentKey: string
  subCategoryKey: string
}

export interface DocumentType {
  key: string
  name: string
  description: string
  category: 'IDENTITY' | 'ADDRESS' | 'INCOME' | 'BUSINESS' | 'PROPERTY' | 'OTHER'
  acceptedFormats: string[]
  maxSizeMB: number
  isOptional?: boolean
}

// ============================================================================
// PRIMARY CATEGORIES (Level 1)
// ============================================================================

export const PRIMARY_CATEGORIES: Record<string, CustomerCategory> = {
  SALARIED: {
    key: 'SALARIED',
    name: 'Salaried Employee',
    description: 'Individuals employed in government or private sector',
    icon: 'Briefcase',
    color: '#3B82F6', // blue
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'BANK_STATEMENT', 'FORM_16'],
    employmentType: 'SALARIED'
  },
  SELF_EMPLOYED_PROFESSIONAL: {
    key: 'SELF_EMPLOYED_PROFESSIONAL',
    name: 'Self-Employed Professional',
    description: 'Licensed professionals like doctors, lawyers, CAs',
    icon: 'Stethoscope',
    color: '#8B5CF6', // purple
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROFESSIONAL_LICENSE', 'ITR', 'BANK_STATEMENT'],
    employmentType: 'SELF_EMPLOYED'
  },
  SELF_EMPLOYED_BUSINESS: {
    key: 'SELF_EMPLOYED_BUSINESS',
    name: 'Self-Employed Business',
    description: 'Business owners and entrepreneurs',
    icon: 'Store',
    color: '#F59E0B', // amber
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'ITR', 'BANK_STATEMENT', 'BUSINESS_PROOF'],
    employmentType: 'SELF_EMPLOYED'
  },
  BUSINESS_ENTITY: {
    key: 'BUSINESS_ENTITY',
    name: 'Business Entity',
    description: 'Companies, partnerships, and other business structures',
    icon: 'Building2',
    color: '#10B981', // emerald
    requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'],
    employmentType: 'SELF_EMPLOYED'
  },
  AGRICULTURE: {
    key: 'AGRICULTURE',
    name: 'Agriculture & Allied',
    description: 'Farmers and agriculture-related income',
    icon: 'Wheat',
    color: '#84CC16', // lime
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'LAND_RECORDS', 'BANK_STATEMENT', 'CROP_RECEIPTS'],
    employmentType: 'SELF_EMPLOYED'
  },
  RENTAL_INCOME: {
    key: 'RENTAL_INCOME',
    name: 'Rental Income',
    description: 'Individuals with primary income from rent',
    icon: 'Home',
    color: '#EC4899', // pink
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROPERTY_DOCUMENTS', 'RENT_AGREEMENTS', 'BANK_STATEMENT'],
    employmentType: 'OTHER'
  },
  NRI: {
    key: 'NRI',
    name: 'Non-Resident Indian',
    description: 'Indians residing abroad',
    icon: 'Globe',
    color: '#06B6D4', // cyan
    requiredDocuments: ['PASSPORT', 'VISA', 'PAN_CARD', 'OVERSEAS_ADDRESS_PROOF', 'NRE_NRO_STATEMENT'],
    employmentType: 'BOTH'
  },
  PENSIONER: {
    key: 'PENSIONER',
    name: 'Pensioner',
    description: 'Retired individuals receiving pension',
    icon: 'UserCheck',
    color: '#6366F1', // indigo
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'PENSION_CERTIFICATE', 'BANK_STATEMENT'],
    employmentType: 'OTHER'
  },
  OTHER: {
    key: 'OTHER',
    name: 'Other Income Sources',
    description: 'Other income categories not covered above',
    icon: 'MoreHorizontal',
    color: '#78716C', // stone
    requiredDocuments: ['PAN_CARD', 'AADHAR', 'INCOME_PROOF', 'BANK_STATEMENT'],
    employmentType: 'OTHER'
  }
}

// ============================================================================
// SUB-CATEGORIES (Level 2)
// ============================================================================

export const SUB_CATEGORIES: Record<string, CustomerSubCategory[]> = {
  SALARIED: [
    { key: 'GOVERNMENT', name: 'Government Employee', description: 'Central/State government employees', parentKey: 'SALARIED', icon: 'Building', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'FORM_16', 'EMPLOYEE_ID'] },
    { key: 'PSU', name: 'PSU Employee', description: 'Public sector undertaking employees', parentKey: 'SALARIED', icon: 'Factory', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'FORM_16', 'EMPLOYEE_ID'] },
    { key: 'PRIVATE_MNC', name: 'Private Sector - MNC', description: 'Multinational company employees', parentKey: 'SALARIED', icon: 'Globe', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'FORM_16', 'OFFER_LETTER'] },
    { key: 'PRIVATE_LARGE', name: 'Private Sector - Large Corp', description: 'Large corporate employees', parentKey: 'SALARIED', icon: 'Building2', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'FORM_16', 'OFFER_LETTER'] },
    { key: 'PRIVATE_SME', name: 'Private Sector - SME', description: 'Small/medium enterprise employees', parentKey: 'SALARIED', icon: 'Store', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'BANK_STATEMENT'] },
    { key: 'STARTUP', name: 'Startup Employee', description: 'Startup company employees', parentKey: 'SALARIED', icon: 'Rocket', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'OFFER_LETTER', 'BANK_STATEMENT'] },
    { key: 'DEFENCE', name: 'Defence Personnel', description: 'Armed forces personnel', parentKey: 'SALARIED', icon: 'Shield', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SERVICE_ID', 'SALARY_SLIP'] },
    { key: 'BANK_EMPLOYEE', name: 'Bank Employee', description: 'Banking sector employees', parentKey: 'SALARIED', icon: 'Landmark', color: '#3B82F6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'SALARY_SLIP', 'EMPLOYEE_ID'] }
  ],
  SELF_EMPLOYED_PROFESSIONAL: [
    { key: 'DOCTOR', name: 'Doctor / Medical Professional', description: 'MBBS, MD, specialists, dentists', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Stethoscope', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'MEDICAL_LICENSE', 'CLINIC_PROOF', 'ITR', 'BANK_STATEMENT'] },
    { key: 'CA', name: 'Chartered Accountant', description: 'Practicing CAs', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Calculator', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'CA_CERTIFICATE', 'FIRM_PROOF', 'ITR', 'BANK_STATEMENT'] },
    { key: 'LAWYER', name: 'Lawyer / Advocate', description: 'Practicing lawyers and advocates', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Scale', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'BAR_COUNCIL_LICENSE', 'OFFICE_PROOF', 'ITR', 'BANK_STATEMENT'] },
    { key: 'ARCHITECT', name: 'Architect', description: 'Licensed architects', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Compass', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'COA_LICENSE', 'OFFICE_PROOF', 'ITR', 'BANK_STATEMENT'] },
    { key: 'CS', name: 'Company Secretary', description: 'Practicing company secretaries', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'FileText', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'CS_CERTIFICATE', 'ITR', 'BANK_STATEMENT'] },
    { key: 'CWA', name: 'Cost Accountant', description: 'Cost and management accountants', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'PieChart', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'CWA_CERTIFICATE', 'ITR', 'BANK_STATEMENT'] },
    { key: 'CONSULTANT', name: 'Consultant / Freelancer', description: 'Independent consultants', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Briefcase', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'ITR', 'BANK_STATEMENT'] },
    { key: 'ENGINEER', name: 'Consulting Engineer', description: 'Licensed consulting engineers', parentKey: 'SELF_EMPLOYED_PROFESSIONAL', icon: 'Wrench', color: '#8B5CF6', requiredDocuments: ['PAN_CARD', 'AADHAR', 'ENGINEERING_LICENSE', 'ITR', 'BANK_STATEMENT'] }
  ],
  SELF_EMPLOYED_BUSINESS: [
    { key: 'PROPRIETOR', name: 'Proprietorship', description: 'Sole proprietorship businesses', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'User', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'SHOP_ACT', 'ITR', 'BANK_STATEMENT'] },
    { key: 'TRADER', name: 'Trader / Wholesaler', description: 'Trading and wholesale businesses', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'Package', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'TRADE_LICENSE', 'ITR', 'BANK_STATEMENT'] },
    { key: 'MANUFACTURER', name: 'Manufacturer', description: 'Manufacturing businesses', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'Factory', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'FACTORY_LICENSE', 'ITR', 'BANK_STATEMENT'] },
    { key: 'SERVICE_PROVIDER', name: 'Service Provider', description: 'Service-based businesses', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'Wrench', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'SERVICE_CONTRACT', 'ITR', 'BANK_STATEMENT'] },
    { key: 'RETAILER', name: 'Retailer', description: 'Retail shop owners', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'ShoppingBag', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'SHOP_ACT', 'ITR', 'BANK_STATEMENT'] },
    { key: 'CONTRACTOR', name: 'Contractor', description: 'Construction and other contractors', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'HardHat', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'CONTRACT_COPIES', 'ITR', 'BANK_STATEMENT'] },
    { key: 'TRANSPORTER', name: 'Transporter', description: 'Transport and logistics businesses', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'Truck', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'VEHICLE_RC', 'ITR', 'BANK_STATEMENT'] },
    { key: 'COMMISSION_AGENT', name: 'Commission Agent', description: 'Commission-based agents', parentKey: 'SELF_EMPLOYED_BUSINESS', icon: 'Handshake', color: '#F59E0B', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'ITR', 'BANK_STATEMENT'] }
  ],
  BUSINESS_ENTITY: [
    { key: 'PRIVATE_LIMITED', name: 'Private Limited Company', description: 'Pvt Ltd companies', parentKey: 'BUSINESS_ENTITY', icon: 'Building2', color: '#10B981', requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'] },
    { key: 'PUBLIC_LIMITED', name: 'Public Limited Company', description: 'Public listed companies', parentKey: 'BUSINESS_ENTITY', icon: 'TrendingUp', color: '#10B981', requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'BOARD_RESOLUTION', 'AUDITED_FINANCIALS'] },
    { key: 'LLP', name: 'Limited Liability Partnership', description: 'LLP firms', parentKey: 'BUSINESS_ENTITY', icon: 'Users', color: '#10B981', requiredDocuments: ['LLP_PAN', 'GST_CERTIFICATE', 'LLP_AGREEMENT', 'INCORPORATION_CERT', 'ITR', 'BANK_STATEMENT'] },
    { key: 'PARTNERSHIP', name: 'Partnership Firm', description: 'Traditional partnership firms', parentKey: 'BUSINESS_ENTITY', icon: 'Handshake', color: '#10B981', requiredDocuments: ['FIRM_PAN', 'GST_CERTIFICATE', 'PARTNERSHIP_DEED', 'ITR', 'BANK_STATEMENT'] },
    { key: 'HUF', name: 'Hindu Undivided Family', description: 'HUF businesses', parentKey: 'BUSINESS_ENTITY', icon: 'Home', color: '#10B981', requiredDocuments: ['HUF_PAN', 'HUF_DEED', 'ITR', 'BANK_STATEMENT'] },
    { key: 'TRUST', name: 'Trust', description: 'Registered trusts', parentKey: 'BUSINESS_ENTITY', icon: 'Shield', color: '#10B981', requiredDocuments: ['TRUST_PAN', 'TRUST_DEED', 'REGISTRATION_CERT', 'AUDITED_ACCOUNTS'] },
    { key: 'SOCIETY', name: 'Society / Association', description: 'Registered societies', parentKey: 'BUSINESS_ENTITY', icon: 'Users', color: '#10B981', requiredDocuments: ['SOCIETY_PAN', 'REGISTRATION_CERT', 'BYLAWS', 'AUDITED_ACCOUNTS'] },
    { key: 'OPC', name: 'One Person Company', description: 'Single-member companies', parentKey: 'BUSINESS_ENTITY', icon: 'User', color: '#10B981', requiredDocuments: ['COMPANY_PAN', 'GST_CERTIFICATE', 'MOA_AOA', 'INCORPORATION_CERT', 'ITR'] }
  ],
  AGRICULTURE: [
    { key: 'FARMER_SMALL', name: 'Small Farmer (< 2 ha)', description: 'Small-scale farmers', parentKey: 'AGRICULTURE', icon: 'Wheat', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'LAND_RECORDS', 'KISAN_CREDIT_CARD', 'BANK_STATEMENT'] },
    { key: 'FARMER_MEDIUM', name: 'Medium Farmer (2-10 ha)', description: 'Medium-scale farmers', parentKey: 'AGRICULTURE', icon: 'Wheat', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'LAND_RECORDS', 'CROP_RECEIPTS', 'BANK_STATEMENT'] },
    { key: 'FARMER_LARGE', name: 'Large Farmer (> 10 ha)', description: 'Large-scale farmers', parentKey: 'AGRICULTURE', icon: 'Wheat', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'LAND_RECORDS', 'ITR', 'BANK_STATEMENT'] },
    { key: 'DAIRY', name: 'Dairy Farming', description: 'Dairy farm operators', parentKey: 'AGRICULTURE', icon: 'Milk', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'DAIRY_LICENSE', 'BANK_STATEMENT'] },
    { key: 'POULTRY', name: 'Poultry Farming', description: 'Poultry farm operators', parentKey: 'AGRICULTURE', icon: 'Bird', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'POULTRY_LICENSE', 'BANK_STATEMENT'] },
    { key: 'FISHERY', name: 'Fishery / Aquaculture', description: 'Fish farming and aquaculture', parentKey: 'AGRICULTURE', icon: 'Fish', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'FISHERY_LICENSE', 'BANK_STATEMENT'] },
    { key: 'HORTICULTURE', name: 'Horticulture / Floriculture', description: 'Fruit, vegetable, flower farming', parentKey: 'AGRICULTURE', icon: 'Flower', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'LAND_RECORDS', 'BANK_STATEMENT'] },
    { key: 'AGRI_BUSINESS', name: 'Agri-Business / Processing', description: 'Agricultural processing businesses', parentKey: 'AGRICULTURE', icon: 'Factory', color: '#84CC16', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'FSSAI_LICENSE', 'BANK_STATEMENT'] }
  ],
  RENTAL_INCOME: [
    { key: 'RESIDENTIAL_RENT', name: 'Residential Property Rent', description: 'Income from residential rentals', parentKey: 'RENTAL_INCOME', icon: 'Home', color: '#EC4899', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROPERTY_DOCUMENTS', 'RENT_AGREEMENT', 'BANK_STATEMENT'] },
    { key: 'COMMERCIAL_RENT', name: 'Commercial Property Rent', description: 'Income from commercial rentals', parentKey: 'RENTAL_INCOME', icon: 'Building', color: '#EC4899', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROPERTY_DOCUMENTS', 'RENT_AGREEMENT', 'BANK_STATEMENT'] },
    { key: 'INDUSTRIAL_RENT', name: 'Industrial Property Rent', description: 'Income from industrial rentals', parentKey: 'RENTAL_INCOME', icon: 'Factory', color: '#EC4899', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROPERTY_DOCUMENTS', 'LEASE_DEED', 'BANK_STATEMENT'] },
    { key: 'MIXED_USE', name: 'Mixed-Use Property', description: 'Income from mixed-use properties', parentKey: 'RENTAL_INCOME', icon: 'Building2', color: '#EC4899', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PROPERTY_DOCUMENTS', 'RENT_AGREEMENTS', 'BANK_STATEMENT'] }
  ],
  NRI: [
    { key: 'NRI_SALARIED', name: 'NRI - Salaried', description: 'NRIs employed abroad', parentKey: 'NRI', icon: 'Briefcase', color: '#06B6D4', requiredDocuments: ['PASSPORT', 'VISA', 'PAN_CARD', 'EMPLOYMENT_LETTER', 'NRE_NRO_STATEMENT', 'TAX_RETURNS'] },
    { key: 'NRI_BUSINESS', name: 'NRI - Business Owner', description: 'NRIs with overseas businesses', parentKey: 'NRI', icon: 'Store', color: '#06B6D4', requiredDocuments: ['PASSPORT', 'VISA', 'PAN_CARD', 'BUSINESS_PROOF', 'NRE_NRO_STATEMENT', 'TAX_RETURNS'] },
    { key: 'NRI_PROFESSIONAL', name: 'NRI - Professional', description: 'NRI professionals abroad', parentKey: 'NRI', icon: 'Stethoscope', color: '#06B6D4', requiredDocuments: ['PASSPORT', 'VISA', 'PAN_CARD', 'PROFESSIONAL_LICENSE', 'NRE_NRO_STATEMENT'] },
    { key: 'PIO_OCI', name: 'PIO / OCI Card Holder', description: 'Persons of Indian Origin', parentKey: 'NRI', icon: 'CreditCard', color: '#06B6D4', requiredDocuments: ['OCI_CARD', 'FOREIGN_PASSPORT', 'PAN_CARD', 'INCOME_PROOF', 'BANK_STATEMENT'] }
  ],
  PENSIONER: [
    { key: 'GOVT_PENSIONER', name: 'Government Pensioner', description: 'Retired government employees', parentKey: 'PENSIONER', icon: 'Building', color: '#6366F1', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PPO', 'PENSION_SLIP', 'BANK_STATEMENT'] },
    { key: 'PSU_PENSIONER', name: 'PSU Pensioner', description: 'Retired PSU employees', parentKey: 'PENSIONER', icon: 'Factory', color: '#6366F1', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PENSION_CERTIFICATE', 'PENSION_SLIP', 'BANK_STATEMENT'] },
    { key: 'DEFENCE_PENSIONER', name: 'Defence Pensioner', description: 'Retired defence personnel', parentKey: 'PENSIONER', icon: 'Shield', color: '#6366F1', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PPO', 'DISCHARGE_BOOK', 'BANK_STATEMENT'] },
    { key: 'FAMILY_PENSION', name: 'Family Pension Recipient', description: 'Family pension beneficiaries', parentKey: 'PENSIONER', icon: 'Users', color: '#6366F1', requiredDocuments: ['PAN_CARD', 'AADHAR', 'FAMILY_PENSION_ORDER', 'BANK_STATEMENT'] },
    { key: 'PRIVATE_PENSION', name: 'Private Pension / Annuity', description: 'Private pension recipients', parentKey: 'PENSIONER', icon: 'Wallet', color: '#6366F1', requiredDocuments: ['PAN_CARD', 'AADHAR', 'PENSION_STATEMENT', 'BANK_STATEMENT'] }
  ],
  OTHER: [
    { key: 'HOMEMAKER', name: 'Homemaker with Income', description: 'Homemakers with independent income', parentKey: 'OTHER', icon: 'Home', color: '#78716C', requiredDocuments: ['PAN_CARD', 'AADHAR', 'INCOME_SOURCE_PROOF', 'BANK_STATEMENT'] },
    { key: 'STUDENT', name: 'Student with Income', description: 'Students with income sources', parentKey: 'OTHER', icon: 'GraduationCap', color: '#78716C', requiredDocuments: ['PAN_CARD', 'AADHAR', 'STUDENT_ID', 'INCOME_PROOF', 'BANK_STATEMENT'] },
    { key: 'FREELANCER', name: 'Freelancer / Gig Worker', description: 'Gig economy workers', parentKey: 'OTHER', icon: 'Laptop', color: '#78716C', requiredDocuments: ['PAN_CARD', 'AADHAR', 'GST_CERTIFICATE', 'CONTRACT_COPIES', 'BANK_STATEMENT'] },
    { key: 'INVESTOR', name: 'Investor / Dividend Income', description: 'Investment income earners', parentKey: 'OTHER', icon: 'TrendingUp', color: '#78716C', requiredDocuments: ['PAN_CARD', 'AADHAR', 'DEMAT_STATEMENT', 'DIVIDEND_CERTIFICATES', 'ITR'] },
    { key: 'ROYALTY_INCOME', name: 'Royalty / IP Income', description: 'Intellectual property income', parentKey: 'OTHER', icon: 'Award', color: '#78716C', requiredDocuments: ['PAN_CARD', 'AADHAR', 'IP_DOCUMENTS', 'ROYALTY_AGREEMENTS', 'ITR'] }
  ]
}

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

export const DOCUMENT_TYPES: Record<string, DocumentType> = {
  // Identity Documents
  PAN_CARD: { key: 'PAN_CARD', name: 'PAN Card', description: 'Permanent Account Number card', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  AADHAR: { key: 'AADHAR', name: 'Aadhar Card', description: 'UIDAI Aadhar card (front & back)', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  PASSPORT: { key: 'PASSPORT', name: 'Passport', description: 'Valid Indian passport', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  VOTER_ID: { key: 'VOTER_ID', name: 'Voter ID', description: 'Election Commission voter ID', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  DRIVING_LICENSE: { key: 'DRIVING_LICENSE', name: 'Driving License', description: 'Valid driving license', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },

  // Income Documents - Salaried
  SALARY_SLIP: { key: 'SALARY_SLIP', name: 'Salary Slip', description: 'Last 3 months salary slips', category: 'INCOME', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 10 },
  FORM_16: { key: 'FORM_16', name: 'Form 16', description: 'Form 16 from employer', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  OFFER_LETTER: { key: 'OFFER_LETTER', name: 'Offer Letter', description: 'Current employment offer letter', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  EMPLOYEE_ID: { key: 'EMPLOYEE_ID', name: 'Employee ID Card', description: 'Company employee ID card', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },

  // Income Documents - Business/Self-Employed
  ITR: { key: 'ITR', name: 'Income Tax Returns', description: 'Last 2-3 years ITR with acknowledgment', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  GST_CERTIFICATE: { key: 'GST_CERTIFICATE', name: 'GST Certificate', description: 'GST registration certificate', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  BANK_STATEMENT: { key: 'BANK_STATEMENT', name: 'Bank Statement', description: 'Last 6-12 months bank statements', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 20 },

  // Business Documents
  SHOP_ACT: { key: 'SHOP_ACT', name: 'Shop & Establishment License', description: 'Shop Act registration', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  TRADE_LICENSE: { key: 'TRADE_LICENSE', name: 'Trade License', description: 'Municipal trade license', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  MOA_AOA: { key: 'MOA_AOA', name: 'MOA & AOA', description: 'Memorandum and Articles of Association', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  INCORPORATION_CERT: { key: 'INCORPORATION_CERT', name: 'Certificate of Incorporation', description: 'Company incorporation certificate', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  BOARD_RESOLUTION: { key: 'BOARD_RESOLUTION', name: 'Board Resolution', description: 'Board resolution for loan', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  AUDITED_FINANCIALS: { key: 'AUDITED_FINANCIALS', name: 'Audited Financials', description: 'Audited financial statements', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 20 },
  PARTNERSHIP_DEED: { key: 'PARTNERSHIP_DEED', name: 'Partnership Deed', description: 'Registered partnership deed', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  LLP_AGREEMENT: { key: 'LLP_AGREEMENT', name: 'LLP Agreement', description: 'LLP formation agreement', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },

  // Professional Licenses
  PROFESSIONAL_LICENSE: { key: 'PROFESSIONAL_LICENSE', name: 'Professional License', description: 'Professional registration certificate', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  MEDICAL_LICENSE: { key: 'MEDICAL_LICENSE', name: 'Medical License', description: 'Medical council registration', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  BAR_COUNCIL_LICENSE: { key: 'BAR_COUNCIL_LICENSE', name: 'Bar Council License', description: 'Bar council enrollment certificate', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  CA_CERTIFICATE: { key: 'CA_CERTIFICATE', name: 'CA Certificate', description: 'ICAI membership certificate', category: 'BUSINESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },

  // Property Documents
  PROPERTY_DOCUMENTS: { key: 'PROPERTY_DOCUMENTS', name: 'Property Documents', description: 'Title deed, sale deed, etc.', category: 'PROPERTY', acceptedFormats: ['application/pdf'], maxSizeMB: 20 },
  RENT_AGREEMENT: { key: 'RENT_AGREEMENT', name: 'Rent Agreement', description: 'Registered rent agreement', category: 'PROPERTY', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },
  LAND_RECORDS: { key: 'LAND_RECORDS', name: 'Land Records', description: '7/12 extract, patta, khatauni', category: 'PROPERTY', acceptedFormats: ['application/pdf'], maxSizeMB: 10 },

  // NRI Documents
  VISA: { key: 'VISA', name: 'Visa', description: 'Valid work/residence visa', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  NRE_NRO_STATEMENT: { key: 'NRE_NRO_STATEMENT', name: 'NRE/NRO Statement', description: 'NRE/NRO account statements', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 20 },
  OVERSEAS_ADDRESS_PROOF: { key: 'OVERSEAS_ADDRESS_PROOF', name: 'Overseas Address Proof', description: 'Utility bill or bank statement from abroad', category: 'ADDRESS', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  OCI_CARD: { key: 'OCI_CARD', name: 'OCI Card', description: 'Overseas Citizen of India card', category: 'IDENTITY', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },

  // Pension Documents
  PPO: { key: 'PPO', name: 'Pension Payment Order', description: 'PPO document', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  PENSION_SLIP: { key: 'PENSION_SLIP', name: 'Pension Slip', description: 'Monthly pension slip', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },
  PENSION_CERTIFICATE: { key: 'PENSION_CERTIFICATE', name: 'Pension Certificate', description: 'Pension sanction certificate', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 5 },

  // Agriculture Documents
  KISAN_CREDIT_CARD: { key: 'KISAN_CREDIT_CARD', name: 'Kisan Credit Card', description: 'KCC card copy', category: 'OTHER', acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'], maxSizeMB: 5 },
  CROP_RECEIPTS: { key: 'CROP_RECEIPTS', name: 'Crop Sale Receipts', description: 'Mandi receipts or sale invoices', category: 'INCOME', acceptedFormats: ['application/pdf'], maxSizeMB: 10 }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all primary categories as array
 */
export const getPrimaryCategories = (): CustomerCategory[] => {
  return Object.values(PRIMARY_CATEGORIES)
}

/**
 * Get sub-categories for a primary category
 */
export const getSubCategories = (primaryKey: string): CustomerSubCategory[] => {
  return SUB_CATEGORIES[primaryKey] || []
}

/**
 * Get a specific primary category by key
 */
export const getPrimaryCategory = (key: string): CustomerCategory | undefined => {
  return PRIMARY_CATEGORIES[key]
}

/**
 * Get a specific sub-category by key
 */
export const getSubCategory = (primaryKey: string, subKey: string): CustomerSubCategory | undefined => {
  const subs = SUB_CATEGORIES[primaryKey]
  return subs?.find(sub => sub.key === subKey)
}

/**
 * Get required documents for a category/sub-category combination
 */
export const getRequiredDocuments = (primaryKey: string, subKey?: string): string[] => {
  if (subKey) {
    const subCategory = getSubCategory(primaryKey, subKey)
    return subCategory?.requiredDocuments || []
  }
  return PRIMARY_CATEGORIES[primaryKey]?.requiredDocuments || []
}

/**
 * Get document type details
 */
export const getDocumentType = (key: string): DocumentType | undefined => {
  return DOCUMENT_TYPES[key]
}

/**
 * Get all document types as array
 */
export const getAllDocumentTypes = (): DocumentType[] => {
  return Object.values(DOCUMENT_TYPES)
}

/**
 * Get dashboard route for a category
 */
export const getCategoryDashboardRoute = (primaryKey: string): string => {
  const routes: Record<string, string> = {
    SALARIED: '/customers/dashboard/salaried',
    SELF_EMPLOYED_PROFESSIONAL: '/customers/dashboard/professional',
    SELF_EMPLOYED_BUSINESS: '/customers/dashboard/business',
    BUSINESS_ENTITY: '/customers/dashboard/entity',
    AGRICULTURE: '/customers/dashboard/agriculture',
    RENTAL_INCOME: '/customers/dashboard/rental',
    NRI: '/customers/dashboard/nri',
    PENSIONER: '/customers/dashboard/pensioner',
    OTHER: '/customers/dashboard/other'
  }
  return routes[primaryKey] || '/customers/dashboard'
}

/**
 * Check if a category key is valid
 */
export const isValidCategory = (primaryKey: string, subKey?: string): boolean => {
  if (!PRIMARY_CATEGORIES[primaryKey]) {
    return false
  }
  if (subKey) {
    return !!getSubCategory(primaryKey, subKey)
  }
  return true
}

/**
 * Get categories filtered by employment type
 */
export const getCategoriesByEmploymentType = (employmentType: EmploymentType): CustomerCategory[] => {
  return Object.values(PRIMARY_CATEGORIES).filter(category => {
    if (!category.employmentType) return true
    if (category.employmentType === 'BOTH') return true
    return category.employmentType === employmentType
  })
}

/**
 * Get all employment types
 */
export const getEmploymentTypes = () => Object.entries(EMPLOYMENT_TYPES).map(([key, value]) => ({
  key: key as EmploymentType,
  ...value
}))
