/**
 * One Person Company (OPC) Entity Form Types
 */

export interface OPCDirectorData {
  din: string
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  residential_address_line1: string
  residential_address_line2: string
  residential_city: string
  residential_state: string
  residential_pincode: string
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface NomineeData {
  nominee_name: string
  nominee_pan: string
  nominee_aadhaar: string
  relationship: string
  nominee_consent_url: string
  nominee_pan_url: string
  nominee_aadhaar_url: string
}

export interface OPCData {
  // Company Details
  company_name: string
  cin: string
  date_of_incorporation: string
  nature_of_business: string
  business_category: string
  authorized_capital: number | null
  paid_up_capital: number | null
  company_pan: string
  annual_turnover: string
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | 'COMPOSITION' | ''
  gstin: string
  roc_office: string

  // Director (Single)
  director: OPCDirectorData

  // Nominee Director
  nominee: NomineeData

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
  bank_statement_url: string
  registered_office_proof_url: string
  itr_documents_url: string
  gst_certificate_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface OPCStepProps {
  data: OPCData
  errors: Record<string, string>
  onUpdate: (updates: Partial<OPCData>) => void
}

export const NOMINEE_RELATIONSHIP_OPTIONS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'CHILD', label: 'Son/Daughter' },
  { value: 'SIBLING', label: 'Brother/Sister' },
  { value: 'RELATIVE', label: 'Other Relative' },
  { value: 'FRIEND', label: 'Friend' }
]

export const initialOPCDirector: OPCDirectorData = {
  din: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  residential_address_line1: '',
  residential_address_line2: '',
  residential_city: '',
  residential_state: '',
  residential_pincode: '',
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
}

export const initialNominee: NomineeData = {
  nominee_name: '',
  nominee_pan: '',
  nominee_aadhaar: '',
  relationship: '',
  nominee_consent_url: '',
  nominee_pan_url: '',
  nominee_aadhaar_url: ''
}

export const initialOPCData: OPCData = {
  // Company Details
  company_name: '',
  cin: '',
  date_of_incorporation: '',
  nature_of_business: '',
  business_category: '',
  authorized_capital: null,
  paid_up_capital: null,
  company_pan: '',
  annual_turnover: '',
  gst_registration_status: '',
  gstin: '',
  roc_office: '',

  // Director
  director: { ...initialOPCDirector },

  // Nominee
  nominee: { ...initialNominee },

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
  bank_statement_url: '',
  registered_office_proof_url: '',
  itr_documents_url: '',
  gst_certificate_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
}
