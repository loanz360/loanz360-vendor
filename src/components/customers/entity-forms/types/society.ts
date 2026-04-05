/**
 * Society Entity Form Types
 */

import { generateSafeId } from './shared'

export interface GoverningBodyMemberData {
  id: string
  designation: 'PRESIDENT' | 'VICE_PRESIDENT' | 'SECRETARY' | 'TREASURER' | 'MEMBER' | ''
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  occupation: string
  date_of_appointment: string
  term_end_date: string
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface SocietyData {
  // Society Details
  society_name: string
  registration_number: string
  date_of_registration: string
  registering_authority: string
  state_of_registration: string
  society_type: 'EDUCATIONAL' | 'CHARITABLE' | 'RELIGIOUS' | 'SPORTS' | 'CULTURAL' | 'PROFESSIONAL' | ''
  objects_of_society: string
  society_pan: string
  registration_12a: string
  registration_80g: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | ''
  gstin: string

  // Governing Body Members
  governing_body: GoverningBodyMemberData[]

  // Registered Office Address
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string

  // Documents
  registration_certificate_url: string
  memorandum_of_association_url: string
  rules_regulations_url: string
  society_pan_url: string
  resolution_url: string
  certificate_12a_url: string
  certificate_80g_url: string
  bank_statement_url: string
  address_proof_url: string
  annual_report_url: string
  member_list_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface SocietyStepProps {
  data: SocietyData
  errors: Record<string, string>
  onUpdate: (updates: Partial<SocietyData>) => void
}

export const SOCIETY_TYPE_OPTIONS = [
  { value: 'EDUCATIONAL', label: 'Educational Society' },
  { value: 'CHARITABLE', label: 'Charitable Society' },
  { value: 'RELIGIOUS', label: 'Religious Society' },
  { value: 'SPORTS', label: 'Sports Society' },
  { value: 'CULTURAL', label: 'Cultural Society' },
  { value: 'PROFESSIONAL', label: 'Professional Society' }
]

export const GB_DESIGNATION_OPTIONS = [
  { value: 'PRESIDENT', label: 'President' },
  { value: 'VICE_PRESIDENT', label: 'Vice President' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'MEMBER', label: 'Member' }
]

export const createEmptyGBMember = (): GoverningBodyMemberData => ({
  id: generateSafeId(),
  designation: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  occupation: '',
  date_of_appointment: '',
  term_end_date: '',
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
})

export const getInitialSocietyData = (): SocietyData => ({
  // Society Details
  society_name: '',
  registration_number: '',
  date_of_registration: '',
  registering_authority: '',
  state_of_registration: '',
  society_type: '',
  objects_of_society: '',
  society_pan: '',
  registration_12a: '',
  registration_80g: '',
  gst_registration_status: '',
  gstin: '',

  // Governing Body - start with key positions
  governing_body: [
    { ...createEmptyGBMember(), designation: 'PRESIDENT' },
    { ...createEmptyGBMember(), designation: 'SECRETARY' },
    { ...createEmptyGBMember(), designation: 'TREASURER' }
  ],

  // Registered Office Address
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',

  // Documents
  registration_certificate_url: '',
  memorandum_of_association_url: '',
  rules_regulations_url: '',
  society_pan_url: '',
  resolution_url: '',
  certificate_12a_url: '',
  certificate_80g_url: '',
  bank_statement_url: '',
  address_proof_url: '',
  annual_report_url: '',
  member_list_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialSocietyData = getInitialSocietyData
