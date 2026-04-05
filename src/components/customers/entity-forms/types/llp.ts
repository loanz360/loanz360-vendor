/**
 * Limited Liability Partnership (LLP) Entity Form Types
 */

import { generateSafeId } from './shared'

export interface LLPPartnerData {
  id: string
  partner_type: 'DESIGNATED_PARTNER' | 'PARTNER' | ''
  dpin_din: string
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  capital_contribution: number | null
  profit_sharing_percent: number | null
  has_digital_signature: boolean
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
  din_proof_url: string
}

export interface LLPData {
  // LLP Details
  llp_name: string
  llpin: string
  date_of_incorporation: string
  nature_of_business: string
  business_category: string
  llp_pan: string
  cin: string
  authorized_capital: number | null
  paid_up_capital: number | null
  annual_turnover: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | 'COMPOSITION' | ''
  gstin: string
  roc_office: string

  // Partners
  partners: LLPPartnerData[]

  // Registered Office Address
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string

  // Documents
  llp_agreement_url: string
  certificate_of_incorporation_url: string
  llp_pan_url: string
  bank_statement_url: string
  registered_office_proof_url: string
  itr_documents_url: string
  gst_certificate_url: string
  annual_return_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface LLPStepProps {
  data: LLPData
  errors: Record<string, string>
  onUpdate: (updates: Partial<LLPData>) => void
}

export const LLP_PARTNER_TYPE_OPTIONS = [
  { value: 'DESIGNATED_PARTNER', label: 'Designated Partner' },
  { value: 'PARTNER', label: 'Partner' }
]

// ROC_OFFICES is exported from types/index.ts to avoid duplicate exports

export const createEmptyLLPPartner = (): LLPPartnerData => ({
  id: generateSafeId(),
  partner_type: '',
  dpin_din: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  capital_contribution: null,
  profit_sharing_percent: null,
  has_digital_signature: false,
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: '',
  din_proof_url: ''
})

export const getInitialLLPData = (): LLPData => ({
  // LLP Details
  llp_name: '',
  llpin: '',
  date_of_incorporation: '',
  nature_of_business: '',
  business_category: '',
  llp_pan: '',
  cin: '',
  authorized_capital: null,
  paid_up_capital: null,
  annual_turnover: '',
  gst_registration_status: '',
  gstin: '',
  roc_office: '',

  // Partners - start with 2 designated partners (minimum required)
  partners: [
    { ...createEmptyLLPPartner(), partner_type: 'DESIGNATED_PARTNER' },
    { ...createEmptyLLPPartner(), partner_type: 'DESIGNATED_PARTNER' }
  ],

  // Registered Office Address
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',

  // Documents
  llp_agreement_url: '',
  certificate_of_incorporation_url: '',
  llp_pan_url: '',
  bank_statement_url: '',
  registered_office_proof_url: '',
  itr_documents_url: '',
  gst_certificate_url: '',
  annual_return_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialLLPData = getInitialLLPData
