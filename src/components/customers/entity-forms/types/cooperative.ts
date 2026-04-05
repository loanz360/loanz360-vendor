/**
 * Cooperative Society Entity Form Types
 */

import { generateSafeId } from './shared'

export interface BoardMemberData {
  id: string
  designation: 'CHAIRMAN' | 'VICE_CHAIRMAN' | 'SECRETARY' | 'TREASURER' | 'DIRECTOR' | ''
  full_name: string
  date_of_birth: string
  gender: string
  pan_number: string
  aadhaar_number: string
  mobile: string
  email: string
  member_id: string
  shares_held: number | null
  date_of_election: string
  term_end_date: string
  is_authorized_signatory: boolean
  // Documents
  pan_document_url: string
  aadhaar_front_url: string
  aadhaar_back_url: string
  photo_url: string
}

export interface CooperativeData {
  // Society Details
  society_name: string
  registration_number: string
  date_of_registration: string
  registrar_of_cooperatives: string
  registration_type: 'STATE' | 'MULTI_STATE' | ''
  cooperative_type: 'CREDIT' | 'HOUSING' | 'CONSUMER' | 'PRODUCER' | 'MARKETING' | 'LABOUR' | 'OTHER' | ''
  area_of_operation: 'VILLAGE' | 'DISTRICT' | 'STATE' | 'MULTI_STATE' | ''
  society_pan: string
  authorized_share_capital: number | null
  paid_up_share_capital: number | null
  number_of_members: number | null
  gst_registration_status: 'REGISTERED' | 'NOT_REGISTERED' | ''
  gstin: string

  // Board of Directors / Managing Committee
  board_members: BoardMemberData[]

  // Registered Office Address
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string

  // Documents
  registration_certificate_url: string
  bye_laws_url: string
  society_pan_url: string
  resolution_url: string
  bank_statement_url: string
  address_proof_url: string
  audit_report_url: string
  annual_return_url: string
  member_list_url: string

  // Status
  profile_completed: boolean
  verification_status: string
}

export interface CooperativeStepProps {
  data: CooperativeData
  errors: Record<string, string>
  onUpdate: (updates: Partial<CooperativeData>) => void
}

export const COOPERATIVE_TYPE_OPTIONS = [
  { value: 'CREDIT', label: 'Credit Cooperative Society' },
  { value: 'HOUSING', label: 'Housing Cooperative Society' },
  { value: 'CONSUMER', label: 'Consumer Cooperative Society' },
  { value: 'PRODUCER', label: 'Producer Cooperative Society' },
  { value: 'MARKETING', label: 'Marketing Cooperative Society' },
  { value: 'LABOUR', label: 'Labour Cooperative Society' },
  { value: 'OTHER', label: 'Other Cooperative Society' }
]

export const REGISTRATION_TYPE_OPTIONS = [
  { value: 'STATE', label: 'State Cooperative' },
  { value: 'MULTI_STATE', label: 'Multi-State Cooperative' }
]

export const AREA_OF_OPERATION_OPTIONS = [
  { value: 'VILLAGE', label: 'Village Level' },
  { value: 'DISTRICT', label: 'District Level' },
  { value: 'STATE', label: 'State Level' },
  { value: 'MULTI_STATE', label: 'Multi-State Level' }
]

export const BOARD_DESIGNATION_OPTIONS = [
  { value: 'CHAIRMAN', label: 'Chairman' },
  { value: 'VICE_CHAIRMAN', label: 'Vice Chairman' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'TREASURER', label: 'Treasurer' },
  { value: 'DIRECTOR', label: 'Director' }
]

export const createEmptyBoardMember = (): BoardMemberData => ({
  id: generateSafeId(),
  designation: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  pan_number: '',
  aadhaar_number: '',
  mobile: '',
  email: '',
  member_id: '',
  shares_held: null,
  date_of_election: '',
  term_end_date: '',
  is_authorized_signatory: false,
  pan_document_url: '',
  aadhaar_front_url: '',
  aadhaar_back_url: '',
  photo_url: ''
})

export const getInitialCooperativeData = (): CooperativeData => ({
  // Society Details
  society_name: '',
  registration_number: '',
  date_of_registration: '',
  registrar_of_cooperatives: '',
  registration_type: '',
  cooperative_type: '',
  area_of_operation: '',
  society_pan: '',
  authorized_share_capital: null,
  paid_up_share_capital: null,
  number_of_members: null,
  gst_registration_status: '',
  gstin: '',

  // Board Members - start with key positions
  board_members: [
    { ...createEmptyBoardMember(), designation: 'CHAIRMAN' },
    { ...createEmptyBoardMember(), designation: 'SECRETARY' },
    { ...createEmptyBoardMember(), designation: 'TREASURER' }
  ],

  // Registered Office Address
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',

  // Documents
  registration_certificate_url: '',
  bye_laws_url: '',
  society_pan_url: '',
  resolution_url: '',
  bank_statement_url: '',
  address_proof_url: '',
  audit_report_url: '',
  annual_return_url: '',
  member_list_url: '',

  // Status
  profile_completed: false,
  verification_status: 'NOT_STARTED'
})

// Alias for backward compatibility
export const initialCooperativeData = getInitialCooperativeData
