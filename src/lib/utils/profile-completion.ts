/**
 * Profile Completion Calculator
 * Calculates how complete an employee's profile is based on mandatory field groups.
 * Used by: EmployeeSidebar (GoldenProfileCard), Profile page, Profile Review API
 */

export interface ProfileCompletionResult {
  /** Overall completion percentage (0-100) */
  percentage: number
  /** List of missing mandatory field labels */
  missingFields: string[]
  /** Whether all mandatory fields are filled (100%) */
  mandatoryComplete: boolean
  /** Breakdown by section */
  sections: {
    name: string
    percentage: number
    filled: number
    total: number
    missing: string[]
  }[]
}

interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  pincode?: string
}

interface EmployeeProfileData {
  // Personal Info
  full_name?: string
  date_of_birth?: string
  gender?: string
  blood_group?: string
  profile_photo_url?: string

  // Contact Info
  mobile_number?: string
  personal_email?: string
  work_email?: string
  emergency_contact_name?: string
  emergency_contact_number?: string
  emergency_contact_relation?: string

  // Addresses
  present_address?: string | Address
  permanent_address?: string | Address
  current_address?: Address
  city?: string
  state?: string
  pincode?: string

  // Identity Documents
  pan_number?: string
  pan_card_url?: string
  aadhar_number?: string
  aadhaar_number?: string
  aadhar_card_url?: string
  aadhaar_card_url?: string

  // Bank Details
  bank_account_number?: string
  bank_name?: string
  branch_name?: string
  ifsc_code?: string
  cancelled_cheque_url?: string

  // Professional Info
  department_id?: string
  sub_role?: string
  reporting_manager_id?: string
  date_of_joining?: string

  // Document Uploads
  present_address_proof_url?: string
  permanent_address_proof_url?: string

  // References
  reference1_name?: string
  reference1_contact?: string
  reference2_name?: string
  reference2_contact?: string

  // Allow additional fields
  [key: string]: unknown
}

/**
 * Section definitions with weights
 * Weights must sum to 100
 */
const SECTIONS = [
  {
    name: 'Personal Info',
    weight: 15,
    fields: [
      { key: 'full_name', label: 'Full Name' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'gender', label: 'Gender' },
      { key: 'blood_group', label: 'Blood Group' },
    ],
  },
  {
    name: 'Contact Info',
    weight: 10,
    fields: [
      { key: 'mobile_number', label: 'Mobile Number' },
      { key: 'personal_email', label: 'Personal Email' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
      { key: 'emergency_contact_number', label: 'Emergency Contact Number' },
      { key: 'emergency_contact_relation', label: 'Emergency Contact Relation' },
    ],
  },
  {
    name: 'Address',
    weight: 10,
    fields: [
      { key: 'present_address', label: 'Present Address', check: checkAddress },
      { key: 'permanent_address', label: 'Permanent Address', check: checkAddress },
    ],
  },
  {
    name: 'Identity Documents',
    weight: 20,
    fields: [
      { key: 'pan_number', label: 'PAN Number' },
      { key: 'pan_card_url', label: 'PAN Card Upload' },
      { key: ['aadhar_number', 'aadhaar_number'], label: 'Aadhaar Number' },
      { key: ['aadhar_card_url', 'aadhaar_card_url'], label: 'Aadhaar Card Upload' },
    ],
  },
  {
    name: 'Bank Details',
    weight: 15,
    fields: [
      { key: 'bank_account_number', label: 'Bank Account Number' },
      { key: 'bank_name', label: 'Bank Name' },
      { key: 'ifsc_code', label: 'IFSC Code' },
      { key: 'cancelled_cheque_url', label: 'Cancelled Cheque Upload' },
    ],
  },
  {
    name: 'Professional Info',
    weight: 10,
    fields: [
      { key: 'department_id', label: 'Department' },
      { key: 'sub_role', label: 'Sub-Role / Designation' },
      { key: 'reporting_manager_id', label: 'Reporting Manager' },
    ],
  },
  {
    name: 'Document Uploads',
    weight: 20,
    fields: [
      { key: 'present_address_proof_url', label: 'Present Address Proof' },
      { key: 'permanent_address_proof_url', label: 'Permanent Address Proof' },
      { key: 'reference1_name', label: 'Reference 1 Name' },
      { key: 'reference1_contact', label: 'Reference 1 Contact' },
      { key: 'reference2_name', label: 'Reference 2 Name' },
      { key: 'reference2_contact', label: 'Reference 2 Contact' },
    ],
  },
]

/**
 * Check if an address field is filled
 * Handles both string (legacy) and object (new JSONB) formats
 */
function checkAddress(value: unknown): boolean {
  if (!value) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object') {
    const addr = value as Address
    return !!(addr.line1?.trim() && addr.city?.trim() && addr.state?.trim() && addr.pincode?.trim())
  }
  return false
}

/**
 * Check if a field is filled
 */
function isFieldFilled(data: EmployeeProfileData, key: string | string[], customCheck?: (value: unknown) => boolean): boolean {
  // Handle array of possible keys (for fields with naming variations)
  if (Array.isArray(key)) {
    return key.some(k => {
      const value = data[k]
      if (customCheck) return customCheck(value)
      return value !== null && value !== undefined && value !== ''
    })
  }

  const value = data[key]
  if (customCheck) return customCheck(value)
  return value !== null && value !== undefined && value !== ''
}

/**
 * Calculate profile completion percentage
 */
export function calculateProfileCompletion(data: EmployeeProfileData): ProfileCompletionResult {
  const allMissing: string[] = []
  const sections: ProfileCompletionResult['sections'] = []

  let weightedSum = 0

  for (const section of SECTIONS) {
    const sectionMissing: string[] = []
    let filled = 0

    for (const field of section.fields) {
      if (isFieldFilled(data, field.key, (field as unknown).check)) {
        filled++
      } else {
        sectionMissing.push(field.label)
        allMissing.push(`${section.name}: ${field.label}`)
      }
    }

    const total = section.fields.length
    const sectionPct = total > 0 ? Math.round((filled / total) * 100) : 100

    sections.push({
      name: section.name,
      percentage: sectionPct,
      filled,
      total,
      missing: sectionMissing,
    })

    // Weighted contribution to overall percentage
    weightedSum += (filled / total) * section.weight
  }

  const percentage = Math.round(weightedSum)

  return {
    percentage,
    missingFields: allMissing,
    mandatoryComplete: allMissing.length === 0,
    sections,
  }
}
