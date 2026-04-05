/**
 * Sole Proprietorship Entity Form Types
 * Types for the entity data collection wizard
 */

export interface SoleProprietorshipData {
  // Business Entity Details
  business_name: string
  trading_name: string
  nature_of_business: string
  business_category: string
  year_of_establishment: number | null
  annual_turnover: number | null
  number_of_employees: number | null

  // Registration & Tax Details
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | 'COMPOSITION' | ''
  gstin: string
  shop_establishment_license: string
  udyam_registration: string
  trade_license: string
  fssai_license: string

  // Proprietor Details
  proprietor_name: string
  proprietor_dob: string
  proprietor_gender: string
  proprietor_father_name: string
  proprietor_pan: string
  proprietor_aadhaar: string
  proprietor_mobile: string
  proprietor_email: string

  // Residential Address
  residential_address_line1: string
  residential_address_line2: string
  residential_city: string
  residential_state: string
  residential_pincode: string
  residential_address_proof_type: string
  residential_address_proof_url: string

  // Permanent Address
  permanent_same_as_residential: boolean
  permanent_address_line1: string
  permanent_address_line2: string
  permanent_city: string
  permanent_state: string
  permanent_pincode: string
  permanent_address_proof_type: string
  permanent_address_proof_url: string

  // Business Address
  business_address_line1: string
  business_address_line2: string
  business_city: string
  business_state: string
  business_pincode: string
  business_address_proof_type: string
  business_address_proof_url: string

  // KYC Documents
  pan_document_url: string
  pan_verified: boolean
  aadhaar_front_url: string
  aadhaar_back_url: string
  aadhaar_verified: boolean
  passport_photo_url: string
  bank_statement_url: string
  itr_documents_url: string
  gst_certificate_url: string
  shop_license_document_url: string
  udyam_certificate_url: string
  business_address_proof_document_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface SoleProprietorshipStepProps {
  data: SoleProprietorshipData
  errors: Record<string, string>
  onUpdate: (updates: Partial<SoleProprietorshipData>) => void
}

export const ADDRESS_PROOF_TYPES = [
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'RENT_AGREEMENT', label: 'Rent Agreement' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'VOTER_ID', label: 'Voter ID' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'PROPERTY_TAX', label: 'Property Tax Receipt' }
]

export const initialSoleProprietorshipData: SoleProprietorshipData = {
  // Business Entity Details
  business_name: '',
  trading_name: '',
  nature_of_business: '',
  business_category: '',
  year_of_establishment: null,
  annual_turnover: null,
  number_of_employees: null,

  // Registration & Tax Details
  gst_registration_status: '',
  gstin: '',
  shop_establishment_license: '',
  udyam_registration: '',
  trade_license: '',
  fssai_license: '',

  // Proprietor Details
  proprietor_name: '',
  proprietor_dob: '',
  proprietor_gender: '',
  proprietor_father_name: '',
  proprietor_pan: '',
  proprietor_aadhaar: '',
  proprietor_mobile: '',
  proprietor_email: '',

  // Residential Address
  residential_address_line1: '',
  residential_address_line2: '',
  residential_city: '',
  residential_state: '',
  residential_pincode: '',
  residential_address_proof_type: '',
  residential_address_proof_url: '',

  // Permanent Address
  permanent_same_as_residential: false,
  permanent_address_line1: '',
  permanent_address_line2: '',
  permanent_city: '',
  permanent_state: '',
  permanent_pincode: '',
  permanent_address_proof_type: '',
  permanent_address_proof_url: '',

  // Business Address
  business_address_line1: '',
  business_address_line2: '',
  business_city: '',
  business_state: '',
  business_pincode: '',
  business_address_proof_type: '',
  business_address_proof_url: '',

  // KYC Documents
  pan_document_url: '',
  pan_verified: false,
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  aadhaar_verified: false,
  passport_photo_url: '',
  bank_statement_url: '',
  itr_documents_url: '',
  gst_certificate_url: '',
  shop_license_document_url: '',
  udyam_certificate_url: '',
  business_address_proof_document_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
}
