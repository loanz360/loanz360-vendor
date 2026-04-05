/**
 * Hindu Undivided Family (HUF) Entity Form Types
 */

import { generateSafeId } from './shared'

export interface KartaData {
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  relationship_in_huf: string
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface CoparcenerData {
  id: string
  full_name: string
  date_of_birth: string
  gender: string
  relationship_to_karta: string
  pan_number: string
  aadhaar_number: string
}

export interface HUFData {
  // HUF Details
  huf_name: string
  date_of_creation: string
  huf_pan: string
  nature_of_huf_business: string
  annual_income_range: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | ''
  gstin: string

  // Karta (Head of HUF)
  karta: KartaData

  // Coparceners
  coparceners: CoparcenerData[]

  // HUF Address
  huf_address_line1: string
  huf_address_line2: string
  huf_city: string
  huf_state: string
  huf_pincode: string

  // Documents
  huf_pan_url: string
  huf_deed_url: string
  karta_pan_url: string
  karta_aadhaar_front_url: string
  karta_aadhaar_back_url: string
  karta_photo_url: string
  bank_statement_url: string
  address_proof_url: string
  itr_huf_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface HUFStepProps {
  data: HUFData
  errors: Record<string, string>
  onUpdate: (updates: Partial<HUFData>) => void
}

export const RELATIONSHIP_TO_KARTA_OPTIONS = [
  { value: 'SON', label: 'Son' },
  { value: 'DAUGHTER', label: 'Daughter' },
  { value: 'WIFE', label: 'Wife' },
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GRANDSON', label: 'Grandson' },
  { value: 'GRANDDAUGHTER', label: 'Granddaughter' },
  { value: 'DAUGHTER_IN_LAW', label: 'Daughter-in-law' },
  { value: 'OTHER', label: 'Other Family Member' }
]

export const ANNUAL_INCOME_RANGE_OPTIONS = [
  { value: 'BELOW_5L', label: 'Below ₹5 Lakhs' },
  { value: '5L_TO_10L', label: '₹5 - 10 Lakhs' },
  { value: '10L_TO_25L', label: '₹10 - 25 Lakhs' },
  { value: '25L_TO_50L', label: '₹25 - 50 Lakhs' },
  { value: '50L_TO_1CR', label: '₹50 Lakhs - 1 Crore' },
  { value: 'ABOVE_1CR', label: 'Above ₹1 Crore' }
]

export const HUF_BUSINESS_OPTIONS = [
  { value: 'NONE', label: 'No Business' },
  { value: 'TRADING', label: 'Trading' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'AGRICULTURE', label: 'Agriculture' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'INVESTMENT', label: 'Investment/Portfolio Income' },
  { value: 'OTHER', label: 'Other' }
]

export const initialKarta: KartaData = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  relationship_in_huf: 'Karta',
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
}

export const createEmptyCoparcener = (): CoparcenerData => ({
  id: generateSafeId(),
  full_name: '',
  date_of_birth: '',
  gender: '',
  relationship_to_karta: '',
  pan_number: '',
  aadhaar_number: ''
})

export const getInitialHUFData = (): HUFData => ({
  // HUF Details
  huf_name: '',
  date_of_creation: '',
  huf_pan: '',
  nature_of_huf_business: '',
  annual_income_range: '',
  gst_registration_status: '',
  gstin: '',

  // Karta
  karta: { ...initialKarta },

  // Coparceners - start with 1 empty coparcener
  coparceners: [createEmptyCoparcener()],

  // HUF Address
  huf_address_line1: '',
  huf_address_line2: '',
  huf_city: '',
  huf_state: '',
  huf_pincode: '',

  // Documents
  huf_pan_url: '',
  huf_deed_url: '',
  karta_pan_url: '',
  karta_aadhaar_front_url: '',
  karta_aadhaar_back_url: '',
  karta_photo_url: '',
  bank_statement_url: '',
  address_proof_url: '',
  itr_huf_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialHUFData = getInitialHUFData
