/**
 * Private Limited Company Entity Form Types
 */

import { generateSafeId } from './shared'

export interface DirectorData {
  id: string
  director_type: 'MANAGING_DIRECTOR' | 'WHOLE_TIME_DIRECTOR' | 'DIRECTOR' | ''
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

export interface ShareholderData {
  id: string
  shareholder_type: 'INDIVIDUAL' | 'BODY_CORPORATE' | ''
  name: string
  pan_number: string
  number_of_shares: number | null
  face_value_per_share: number | null
  shareholding_percent: number | null
}

export interface PrivateLimitedData {
  // Company Details
  company_name: string
  cin: string
  date_of_incorporation: string
  company_type: string
  company_subtype: string
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
  directors: DirectorData[]

  // Shareholders
  shareholders: ShareholderData[]

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
  share_certificates_url: string
  bank_statement_url: string
  registered_office_proof_url: string
  itr_documents_url: string
  audited_financials_url: string
  gst_certificate_url: string
  annual_return_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface PrivateLimitedStepProps {
  data: PrivateLimitedData
  errors: Record<string, string>
  onUpdate: (updates: Partial<PrivateLimitedData>) => void
}

export const DIRECTOR_TYPE_OPTIONS = [
  { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
  { value: 'WHOLE_TIME_DIRECTOR', label: 'Whole-time Director' },
  { value: 'DIRECTOR', label: 'Director' }
]

export const SHAREHOLDER_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'BODY_CORPORATE', label: 'Body Corporate' }
]

export const COMPANY_SUBTYPE_OPTIONS = [
  { value: 'REGULAR', label: 'Regular Private Limited' },
  { value: 'SMALL_COMPANY', label: 'Small Company' },
  { value: 'OPC_CONVERTED', label: 'Converted from OPC' }
]

export const INDUSTRY_CLASSIFICATION_OPTIONS = [
  { value: 'AGRICULTURE', label: 'Agriculture, Forestry & Fishing' },
  { value: 'MINING', label: 'Mining & Quarrying' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'ELECTRICITY', label: 'Electricity, Gas & Water Supply' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'TRADE', label: 'Wholesale & Retail Trade' },
  { value: 'TRANSPORT', label: 'Transport, Storage & Communications' },
  { value: 'FINANCE', label: 'Financing, Insurance & Real Estate' },
  { value: 'SERVICES', label: 'Community, Social & Personal Services' },
  { value: 'IT', label: 'Information Technology' }
]

export const createEmptyDirector = (): DirectorData => ({
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

export const createEmptyShareholder = (): ShareholderData => ({
  id: generateSafeId(),
  shareholder_type: '',
  name: '',
  pan_number: '',
  number_of_shares: null,
  face_value_per_share: 10,
  shareholding_percent: null
})

export const getInitialPrivateLimitedData = (): PrivateLimitedData => ({
  // Company Details
  company_name: '',
  cin: '',
  date_of_incorporation: '',
  company_type: 'Private Limited by Shares',
  company_subtype: '',
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

  // Directors - start with 2 directors (minimum required)
  directors: [createEmptyDirector(), createEmptyDirector()],

  // Shareholders - start with 2 shareholders (minimum required)
  shareholders: [createEmptyShareholder(), createEmptyShareholder()],

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
  share_certificates_url: '',
  bank_statement_url: '',
  registered_office_proof_url: '',
  itr_documents_url: '',
  audited_financials_url: '',
  gst_certificate_url: '',
  annual_return_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialPrivateLimitedData = getInitialPrivateLimitedData
