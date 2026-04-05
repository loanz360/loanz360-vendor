/**
 * Trust Entity Form Types
 */

import { generateSafeId } from './shared'

export interface TrusteeData {
  id: string
  trustee_type: 'MANAGING_TRUSTEE' | 'TRUSTEE' | ''
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  occupation: string
  date_of_appointment: string
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface BeneficiaryData {
  id: string
  beneficiary_type: 'INDIVIDUAL' | 'CLASS_OF_PERSONS' | ''
  description: string
}

export interface TrustData {
  // Trust Details
  trust_name: string
  trust_type: 'PUBLIC' | 'PRIVATE' | 'CHARITABLE' | ''
  date_of_creation: string
  trust_deed_number: string
  registration_number: string
  registering_authority: string
  purpose_of_trust: string
  trust_pan: string
  registration_12a: string
  registration_80g: string
  fcra_registration: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | ''
  gstin: string

  // Trustees
  trustees: TrusteeData[]

  // Beneficiaries (Optional)
  beneficiaries: BeneficiaryData[]

  // Trust Address
  trust_address_line1: string
  trust_address_line2: string
  trust_city: string
  trust_state: string
  trust_pincode: string

  // Documents
  trust_deed_url: string
  registration_certificate_url: string
  trust_pan_url: string
  certificate_12a_url: string
  certificate_80g_url: string
  bank_statement_url: string
  address_proof_url: string
  annual_report_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface TrustStepProps {
  data: TrustData
  errors: Record<string, string>
  onUpdate: (updates: Partial<TrustData>) => void
}

export const TRUST_TYPE_OPTIONS = [
  { value: 'PUBLIC', label: 'Public Trust' },
  { value: 'PRIVATE', label: 'Private Trust' },
  { value: 'CHARITABLE', label: 'Charitable Trust' }
]

export const TRUSTEE_TYPE_OPTIONS = [
  { value: 'MANAGING_TRUSTEE', label: 'Managing Trustee' },
  { value: 'TRUSTEE', label: 'Trustee' }
]

export const BENEFICIARY_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'CLASS_OF_PERSONS', label: 'Class of Persons' }
]

export const createEmptyTrustee = (): TrusteeData => ({
  id: generateSafeId(),
  trustee_type: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  occupation: '',
  date_of_appointment: '',
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
})

export const createEmptyBeneficiary = (): BeneficiaryData => ({
  id: generateSafeId(),
  beneficiary_type: '',
  description: ''
})

export const getInitialTrustData = (): TrustData => ({
  // Trust Details
  trust_name: '',
  trust_type: '',
  date_of_creation: '',
  trust_deed_number: '',
  registration_number: '',
  registering_authority: '',
  purpose_of_trust: '',
  trust_pan: '',
  registration_12a: '',
  registration_80g: '',
  fcra_registration: '',
  gst_registration_status: '',
  gstin: '',

  // Trustees - start with 2 trustees (recommended minimum)
  trustees: [createEmptyTrustee(), createEmptyTrustee()],

  // Beneficiaries
  beneficiaries: [],

  // Trust Address
  trust_address_line1: '',
  trust_address_line2: '',
  trust_city: '',
  trust_state: '',
  trust_pincode: '',

  // Documents
  trust_deed_url: '',
  registration_certificate_url: '',
  trust_pan_url: '',
  certificate_12a_url: '',
  certificate_80g_url: '',
  bank_statement_url: '',
  address_proof_url: '',
  annual_report_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialTrustData = getInitialTrustData
