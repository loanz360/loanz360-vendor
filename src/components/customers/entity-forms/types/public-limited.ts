/**
 * Public Limited Company Entity Form Types
 */

import { generateSafeId } from './shared'

export interface PublicDirectorData {
  id: string
  director_type: 'MANAGING_DIRECTOR' | 'WHOLE_TIME_DIRECTOR' | 'INDEPENDENT_DIRECTOR' | 'DIRECTOR' | ''
  din: string
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  date_of_appointment: string
  has_digital_signature: boolean
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
  din_proof_url: string
}

export interface KMPData {
  id: string
  kmp_type: 'CEO' | 'CFO' | 'COMPANY_SECRETARY' | ''
  full_name: string
  pan_number: string
  professional_membership_no: string
  date_of_appointment: string
}

export interface PublicShareholderData {
  id: string
  shareholder_type: 'INDIVIDUAL' | 'BODY_CORPORATE' | 'FII' | 'MUTUAL_FUND' | ''
  name: string
  pan_number: string
  number_of_shares: number | null
  face_value_per_share: number | null
  shareholding_percent: number | null
}

export interface PublicLimitedData {
  // Company Details
  company_name: string
  cin: string
  date_of_incorporation: string
  listed_status: 'LISTED' | 'UNLISTED' | ''
  stock_exchange: string
  stock_symbol: string
  nature_of_business: string
  industry_classification: string
  authorized_capital: number | null
  paid_up_capital: number | null
  company_pan: string
  company_tan: string
  annual_turnover: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | 'COMPOSITION' | ''
  gstin: string
  roc_office: string

  // Directors
  directors: PublicDirectorData[]

  // Key Managerial Personnel
  kmps: KMPData[]

  // Major Shareholders (top 10)
  shareholders: PublicShareholderData[]

  // Registered Office Address
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string

  // Documents
  certificate_of_incorporation_url: string
  moa_url: string
  aoa_url: string
  company_pan_url: string
  board_resolution_url: string
  prospectus_url: string
  sebi_compliance_url: string
  bank_statement_url: string
  audited_financials_url: string
  gst_certificate_url: string
  annual_return_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface PublicLimitedStepProps {
  data: PublicLimitedData
  errors: Record<string, string>
  onUpdate: (updates: Partial<PublicLimitedData>) => void
}

export const PUBLIC_DIRECTOR_TYPE_OPTIONS = [
  { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
  { value: 'WHOLE_TIME_DIRECTOR', label: 'Whole-time Director' },
  { value: 'INDEPENDENT_DIRECTOR', label: 'Independent Director' },
  { value: 'DIRECTOR', label: 'Director' }
]

export const KMP_TYPE_OPTIONS = [
  { value: 'CEO', label: 'Chief Executive Officer (CEO)' },
  { value: 'CFO', label: 'Chief Financial Officer (CFO)' },
  { value: 'COMPANY_SECRETARY', label: 'Company Secretary' }
]

export const LISTED_STATUS_OPTIONS = [
  { value: 'LISTED', label: 'Listed' },
  { value: 'UNLISTED', label: 'Unlisted' }
]

export const STOCK_EXCHANGE_OPTIONS = [
  { value: 'BSE', label: 'Bombay Stock Exchange (BSE)' },
  { value: 'NSE', label: 'National Stock Exchange (NSE)' },
  { value: 'BOTH', label: 'Both BSE & NSE' }
]

export const createEmptyPublicDirector = (): PublicDirectorData => ({
  id: generateSafeId(),
  director_type: '',
  din: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  date_of_appointment: '',
  has_digital_signature: false,
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: '',
  din_proof_url: ''
})

export const createEmptyKMP = (): KMPData => ({
  id: generateSafeId(),
  kmp_type: '',
  full_name: '',
  pan_number: '',
  professional_membership_no: '',
  date_of_appointment: ''
})

export const createEmptyPublicShareholder = (): PublicShareholderData => ({
  id: generateSafeId(),
  shareholder_type: '',
  name: '',
  pan_number: '',
  number_of_shares: null,
  face_value_per_share: 10,
  shareholding_percent: null
})

export const getInitialPublicLimitedData = (): PublicLimitedData => ({
  // Company Details
  company_name: '',
  cin: '',
  date_of_incorporation: '',
  listed_status: '',
  stock_exchange: '',
  stock_symbol: '',
  nature_of_business: '',
  industry_classification: '',
  authorized_capital: null,
  paid_up_capital: null,
  company_pan: '',
  company_tan: '',
  annual_turnover: '',
  gst_registration_status: '',
  gstin: '',
  roc_office: '',

  // Directors - start with 3 directors (minimum required for public)
  directors: [createEmptyPublicDirector(), createEmptyPublicDirector(), createEmptyPublicDirector()],

  // KMPs
  kmps: [],

  // Major Shareholders
  shareholders: [],

  // Registered Office Address
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',

  // Documents
  certificate_of_incorporation_url: '',
  moa_url: '',
  aoa_url: '',
  company_pan_url: '',
  board_resolution_url: '',
  prospectus_url: '',
  sebi_compliance_url: '',
  bank_statement_url: '',
  audited_financials_url: '',
  gst_certificate_url: '',
  annual_return_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialPublicLimitedData = getInitialPublicLimitedData
