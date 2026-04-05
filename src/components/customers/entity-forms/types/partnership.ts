/**
 * Partnership Firm Entity Form Types
 */

import { generateSafeId } from './shared'

export interface PartnerData {
  id: string
  partner_type: 'MANAGING_PARTNER' | 'PARTNER' | ''
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  capital_contribution_percent: number | null
  profit_sharing_percent: number | null
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface PartnershipData {
  // Firm Details
  firm_name: string
  trading_name: string
  nature_of_business: string
  business_category: string
  date_of_formation: string
  partnership_deed_number: string
  registrar_of_firms: string
  firm_pan: string
  annual_turnover: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | 'COMPOSITION' | ''
  gstin: string

  // Partners
  partners: PartnerData[]

  // Registered Office Address
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string

  // Business Address
  business_same_as_registered: boolean
  business_address_line1: string
  business_address_line2: string
  business_city: string
  business_state: string
  business_pincode: string

  // Documents
  partnership_deed_url: string
  registration_certificate_url: string
  firm_pan_url: string
  bank_statement_url: string
  address_proof_url: string
  itr_documents_url: string
  gst_certificate_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface PartnershipStepProps {
  data: PartnershipData
  errors: Record<string, string>
  onUpdate: (updates: Partial<PartnershipData>) => void
}

export const PARTNER_TYPE_OPTIONS = [
  { value: 'MANAGING_PARTNER', label: 'Managing Partner' },
  { value: 'PARTNER', label: 'Partner' }
]

export const createEmptyPartner = (): PartnerData => ({
  id: generateSafeId(),
  partner_type: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  capital_contribution_percent: null,
  profit_sharing_percent: null,
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
})

export const getInitialPartnershipData = (): PartnershipData => ({
  // Firm Details
  firm_name: '',
  trading_name: '',
  nature_of_business: '',
  business_category: '',
  date_of_formation: '',
  partnership_deed_number: '',
  registrar_of_firms: '',
  firm_pan: '',
  annual_turnover: '',
  gst_registration_status: '',
  gstin: '',

  // Partners - start with 2 empty partners (minimum required)
  partners: [createEmptyPartner(), createEmptyPartner()],

  // Registered Office Address
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',

  // Business Address
  business_same_as_registered: false,
  business_address_line1: '',
  business_address_line2: '',
  business_city: '',
  business_state: '',
  business_pincode: '',

  // Documents
  partnership_deed_url: '',
  registration_certificate_url: '',
  firm_pan_url: '',
  bank_statement_url: '',
  address_proof_url: '',
  itr_documents_url: '',
  gst_certificate_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility - use the function form for SSR safety
export const initialPartnershipData = getInitialPartnershipData
