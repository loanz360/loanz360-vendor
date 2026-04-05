/**
 * KYC/eKYC Field Definitions by Customer Subrole
 * Defines required KYC fields and verification methods for each of the 13 customer subroles
 */

// =====================================================
// INTERFACES
// =====================================================

export interface KYCField {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'file' | 'number' | 'textarea'
  placeholder?: string
  required: boolean
  verifiable: boolean // Can be verified via eKYC
  verificationMethod?: 'AADHAAR_OTP' | 'PAN_VERIFY' | 'BANK_VERIFY' | 'GST_VERIFY' | 'DIGILOCKER' | 'VIDEO_KYC' | 'MANUAL'
  options?: { value: string; label: string }[]
  maxLength?: number
  pattern?: string
  helpText?: string
  category: 'IDENTITY' | 'ADDRESS' | 'INCOME' | 'BUSINESS' | 'PROFESSIONAL' | 'EMPLOYMENT'
}

export interface KYCSection {
  id: string
  title: string
  description: string
  fields: KYCField[]
}

export interface SubroleKYCConfig {
  subroleKey: string
  subroleLabel: string
  sections: KYCSection[]
  requiredVerifications: string[]
  additionalDocuments: string[]
}

// =====================================================
// COMMON KYC FIELDS
// =====================================================

const COMMON_IDENTITY_FIELDS: KYCField[] = [
  {
    key: 'pan_number',
    label: 'PAN Number',
    type: 'text',
    placeholder: 'ABCDE1234F',
    required: true,
    verifiable: true,
    verificationMethod: 'PAN_VERIFY',
    maxLength: 10,
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
    helpText: 'Your 10-character Permanent Account Number',
    category: 'IDENTITY'
  },
  {
    key: 'aadhaar_number',
    label: 'Aadhaar Number',
    type: 'text',
    placeholder: '1234 5678 9012',
    required: true,
    verifiable: true,
    verificationMethod: 'AADHAAR_OTP',
    maxLength: 14,
    pattern: '^[0-9]{4} [0-9]{4} [0-9]{4}$',
    helpText: 'Your 12-digit Aadhaar number',
    category: 'IDENTITY'
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    type: 'date',
    required: true,
    verifiable: true,
    verificationMethod: 'AADHAAR_OTP',
    helpText: 'As per Aadhaar/PAN',
    category: 'IDENTITY'
  },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'MALE', label: 'Male' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'OTHER', label: 'Other' }
    ],
    category: 'IDENTITY'
  }
]

const COMMON_ADDRESS_FIELDS: KYCField[] = [
  {
    key: 'current_address',
    label: 'Current Address',
    type: 'textarea',
    placeholder: 'House/Flat No., Building, Street, Area',
    required: true,
    verifiable: true,
    verificationMethod: 'AADHAAR_OTP',
    category: 'ADDRESS'
  },
  {
    key: 'current_city',
    label: 'City',
    type: 'text',
    required: true,
    verifiable: false,
    category: 'ADDRESS'
  },
  {
    key: 'current_state',
    label: 'State',
    type: 'select',
    required: true,
    verifiable: false,
    category: 'ADDRESS'
  },
  {
    key: 'current_pincode',
    label: 'PIN Code',
    type: 'text',
    placeholder: '123456',
    required: true,
    verifiable: false,
    maxLength: 6,
    pattern: '^[0-9]{6}$',
    category: 'ADDRESS'
  }
]

// =====================================================
// SUBROLE-SPECIFIC KYC FIELDS
// =====================================================

// SALARIED-specific fields
const SALARIED_EMPLOYMENT_FIELDS: KYCField[] = [
  {
    key: 'employer_name',
    label: 'Employer Name',
    type: 'text',
    placeholder: 'Company/Organization Name',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'employee_id',
    label: 'Employee ID',
    type: 'text',
    placeholder: 'Your employee ID',
    required: false,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'employment_type',
    label: 'Employment Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'PERMANENT', label: 'Permanent' },
      { value: 'CONTRACT', label: 'Contract' },
      { value: 'PROBATION', label: 'Probation' },
      { value: 'TEMPORARY', label: 'Temporary' }
    ],
    category: 'EMPLOYMENT'
  },
  {
    key: 'designation',
    label: 'Designation',
    type: 'text',
    placeholder: 'Your job title',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'monthly_salary',
    label: 'Monthly Net Salary',
    type: 'number',
    placeholder: '50000',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    helpText: 'Your monthly take-home salary',
    category: 'INCOME'
  },
  {
    key: 'date_of_joining',
    label: 'Date of Joining',
    type: 'date',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'office_email',
    label: 'Official Email',
    type: 'text',
    placeholder: 'yourname@company.com',
    required: false,
    verifiable: false,
    category: 'EMPLOYMENT'
  }
]

// PROFESSIONAL-specific fields
const PROFESSIONAL_FIELDS: KYCField[] = [
  {
    key: 'professional_registration_number',
    label: 'Registration Number',
    type: 'text',
    placeholder: 'Your professional registration number',
    required: true,
    verifiable: true,
    verificationMethod: 'MANUAL',
    helpText: 'e.g., MCI/BCI/ICAI registration number',
    category: 'PROFESSIONAL'
  },
  {
    key: 'professional_body',
    label: 'Regulatory Body',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'MCI', label: 'Medical Council of India (MCI)' },
      { value: 'DCI', label: 'Dental Council of India (DCI)' },
      { value: 'BCI', label: 'Bar Council of India (BCI)' },
      { value: 'ICAI', label: 'Institute of Chartered Accountants (ICAI)' },
      { value: 'ICSI', label: 'Institute of Company Secretaries (ICSI)' },
      { value: 'ICMAI', label: 'Institute of Cost Accountants (ICMAI)' },
      { value: 'COA', label: 'Council of Architecture (COA)' },
      { value: 'IEI', label: 'Institution of Engineers (IEI)' },
      { value: 'OTHER', label: 'Other' }
    ],
    category: 'PROFESSIONAL'
  },
  {
    key: 'practice_name',
    label: 'Practice/Clinic Name',
    type: 'text',
    placeholder: 'Name of your practice',
    required: false,
    verifiable: false,
    category: 'PROFESSIONAL'
  },
  {
    key: 'years_of_practice',
    label: 'Years of Practice',
    type: 'number',
    placeholder: '5',
    required: true,
    verifiable: false,
    category: 'PROFESSIONAL'
  },
  {
    key: 'gstin',
    label: 'GST Number (if registered)',
    type: 'text',
    placeholder: '22AAAAA0000A1Z5',
    required: false,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    maxLength: 15,
    category: 'BUSINESS'
  },
  {
    key: 'annual_income',
    label: 'Annual Professional Income',
    type: 'number',
    placeholder: '1000000',
    required: true,
    verifiable: false,
    category: 'INCOME'
  }
]

// BUSINESS-specific fields
const BUSINESS_FIELDS: KYCField[] = [
  {
    key: 'business_name',
    label: 'Business/Entity Name',
    type: 'text',
    placeholder: 'Legal name of business',
    required: true,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    category: 'BUSINESS'
  },
  {
    key: 'business_pan',
    label: 'Business PAN',
    type: 'text',
    placeholder: 'ABCDE1234F',
    required: true,
    verifiable: true,
    verificationMethod: 'PAN_VERIFY',
    maxLength: 10,
    pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$',
    category: 'BUSINESS'
  },
  {
    key: 'gstin',
    label: 'GST Number',
    type: 'text',
    placeholder: '22AAAAA0000A1Z5',
    required: true,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    maxLength: 15,
    category: 'BUSINESS'
  },
  {
    key: 'business_type',
    label: 'Business Entity Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
      { value: 'PARTNERSHIP', label: 'Partnership' },
      { value: 'LLP', label: 'Limited Liability Partnership (LLP)' },
      { value: 'PRIVATE_LIMITED', label: 'Private Limited Company' },
      { value: 'PUBLIC_LIMITED', label: 'Public Limited Company' },
      { value: 'OPC', label: 'One Person Company (OPC)' },
      { value: 'HUF', label: 'Hindu Undivided Family (HUF)' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'business_registration_date',
    label: 'Business Registration Date',
    type: 'date',
    required: true,
    verifiable: false,
    category: 'BUSINESS'
  },
  {
    key: 'cin_llpin',
    label: 'CIN/LLPIN (if applicable)',
    type: 'text',
    placeholder: 'U12345MH2020PTC123456',
    required: false,
    verifiable: true,
    verificationMethod: 'MANUAL',
    helpText: 'Corporate Identification Number or LLPIN',
    category: 'BUSINESS'
  },
  {
    key: 'annual_turnover',
    label: 'Annual Turnover',
    type: 'number',
    placeholder: '5000000',
    required: true,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    helpText: 'Total turnover in last financial year',
    category: 'INCOME'
  },
  {
    key: 'business_address',
    label: 'Registered Business Address',
    type: 'textarea',
    placeholder: 'Complete registered address',
    required: true,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    category: 'ADDRESS'
  }
]

// MSME-specific fields
const MSME_FIELDS: KYCField[] = [
  {
    key: 'udyam_number',
    label: 'Udyam Registration Number',
    type: 'text',
    placeholder: 'UDYAM-XX-00-0000000',
    required: true,
    verifiable: true,
    verificationMethod: 'MANUAL',
    helpText: 'Your official Udyam registration number',
    category: 'BUSINESS'
  },
  {
    key: 'msme_classification',
    label: 'MSME Classification',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'MICRO', label: 'Micro (Investment < ₹1 Cr, Turnover < ₹5 Cr)' },
      { value: 'SMALL', label: 'Small (Investment < ₹10 Cr, Turnover < ₹50 Cr)' },
      { value: 'MEDIUM', label: 'Medium (Investment < ₹50 Cr, Turnover < ₹250 Cr)' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'enterprise_type',
    label: 'Enterprise Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'MANUFACTURING', label: 'Manufacturing' },
      { value: 'SERVICES', label: 'Services' }
    ],
    category: 'BUSINESS'
  },
  ...BUSINESS_FIELDS.filter(f => f.key !== 'business_type')
]

// AGRICULTURE-specific fields
const AGRICULTURE_FIELDS: KYCField[] = [
  {
    key: 'land_holding_size',
    label: 'Total Land Holding (in acres)',
    type: 'number',
    placeholder: '5',
    required: true,
    verifiable: false,
    category: 'BUSINESS'
  },
  {
    key: 'land_type',
    label: 'Land Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'OWNED', label: 'Owned' },
      { value: 'LEASED', label: 'Leased' },
      { value: 'ANCESTRAL', label: 'Ancestral' },
      { value: 'MIXED', label: 'Mixed (Owned + Leased)' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'khasra_number',
    label: 'Khasra/Survey Number',
    type: 'text',
    placeholder: 'Land survey number',
    required: true,
    verifiable: false,
    helpText: 'Land record identification number',
    category: 'BUSINESS'
  },
  {
    key: 'kisan_credit_card',
    label: 'Kisan Credit Card Number',
    type: 'text',
    placeholder: 'Your KCC number',
    required: false,
    verifiable: false,
    category: 'BUSINESS'
  },
  {
    key: 'primary_crop',
    label: 'Primary Crop/Activity',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'FOOD_GRAINS', label: 'Food Grains (Rice, Wheat, etc.)' },
      { value: 'CASH_CROPS', label: 'Cash Crops (Cotton, Sugarcane, etc.)' },
      { value: 'HORTICULTURE', label: 'Horticulture (Fruits, Vegetables)' },
      { value: 'DAIRY', label: 'Dairy Farming' },
      { value: 'POULTRY', label: 'Poultry' },
      { value: 'FISHERY', label: 'Fishery' },
      { value: 'LIVESTOCK', label: 'Livestock' },
      { value: 'MIXED', label: 'Mixed Farming' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'annual_agricultural_income',
    label: 'Annual Agricultural Income',
    type: 'number',
    placeholder: '300000',
    required: true,
    verifiable: false,
    category: 'INCOME'
  }
]

// PENSIONER-specific fields
const PENSIONER_FIELDS: KYCField[] = [
  {
    key: 'pension_type',
    label: 'Pension Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'CENTRAL_GOVT', label: 'Central Government' },
      { value: 'STATE_GOVT', label: 'State Government' },
      { value: 'DEFENCE', label: 'Defence' },
      { value: 'PSU', label: 'PSU/Autonomous Body' },
      { value: 'BANK', label: 'Bank' },
      { value: 'FAMILY', label: 'Family Pension' },
      { value: 'PRIVATE', label: 'Private/Corporate Pension' }
    ],
    category: 'INCOME'
  },
  {
    key: 'ppo_number',
    label: 'PPO Number',
    type: 'text',
    placeholder: 'Pension Payment Order number',
    required: true,
    verifiable: true,
    verificationMethod: 'MANUAL',
    helpText: 'Your Pension Payment Order number',
    category: 'INCOME'
  },
  {
    key: 'retirement_date',
    label: 'Date of Retirement',
    type: 'date',
    required: true,
    verifiable: false,
    category: 'INCOME'
  },
  {
    key: 'last_employer',
    label: 'Last Employer/Department',
    type: 'text',
    placeholder: 'Name of organization',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'last_designation',
    label: 'Last Designation',
    type: 'text',
    placeholder: 'Your designation at retirement',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'monthly_pension',
    label: 'Monthly Pension Amount',
    type: 'number',
    placeholder: '25000',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    category: 'INCOME'
  },
  {
    key: 'pension_bank_account',
    label: 'Pension Bank Account Number',
    type: 'text',
    placeholder: 'Account where pension is credited',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    category: 'INCOME'
  }
]

// NRI-specific fields
const NRI_FIELDS: KYCField[] = [
  {
    key: 'passport_number',
    label: 'Passport Number',
    type: 'text',
    placeholder: 'A1234567',
    required: true,
    verifiable: true,
    verificationMethod: 'MANUAL',
    category: 'IDENTITY'
  },
  {
    key: 'passport_expiry',
    label: 'Passport Expiry Date',
    type: 'date',
    required: true,
    verifiable: false,
    category: 'IDENTITY'
  },
  {
    key: 'country_of_residence',
    label: 'Country of Residence',
    type: 'text',
    placeholder: 'UAE, USA, UK, etc.',
    required: true,
    verifiable: false,
    category: 'ADDRESS'
  },
  {
    key: 'overseas_address',
    label: 'Overseas Address',
    type: 'textarea',
    placeholder: 'Complete address abroad',
    required: true,
    verifiable: false,
    category: 'ADDRESS'
  },
  {
    key: 'visa_type',
    label: 'Visa Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'WORK', label: 'Work Visa' },
      { value: 'STUDENT', label: 'Student Visa' },
      { value: 'PERMANENT_RESIDENT', label: 'Permanent Resident' },
      { value: 'CITIZEN', label: 'Citizen (PIO/OCI)' },
      { value: 'OTHER', label: 'Other' }
    ],
    category: 'IDENTITY'
  },
  {
    key: 'nre_nro_account',
    label: 'NRE/NRO Account Number',
    type: 'text',
    placeholder: 'Your NRE/NRO account number',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    category: 'INCOME'
  },
  {
    key: 'overseas_employer',
    label: 'Overseas Employer',
    type: 'text',
    placeholder: 'Name of employer abroad',
    required: false,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'monthly_overseas_income',
    label: 'Monthly Income (in INR equivalent)',
    type: 'number',
    placeholder: '150000',
    required: true,
    verifiable: false,
    category: 'INCOME'
  }
]

// STUDENT-specific fields
const STUDENT_FIELDS: KYCField[] = [
  {
    key: 'institution_name',
    label: 'Institution Name',
    type: 'text',
    placeholder: 'Name of college/university',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'course_name',
    label: 'Course/Program Name',
    type: 'text',
    placeholder: 'e.g., B.Tech, MBA, MBBS',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'course_type',
    label: 'Course Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'UG', label: 'Undergraduate' },
      { value: 'PG', label: 'Postgraduate' },
      { value: 'PHD', label: 'Doctoral (PhD)' },
      { value: 'DIPLOMA', label: 'Diploma' },
      { value: 'CERTIFICATE', label: 'Certificate Course' }
    ],
    category: 'EMPLOYMENT'
  },
  {
    key: 'enrollment_number',
    label: 'Enrollment/Roll Number',
    type: 'text',
    placeholder: 'Your student ID',
    required: true,
    verifiable: false,
    category: 'IDENTITY'
  },
  {
    key: 'course_duration',
    label: 'Course Duration (years)',
    type: 'number',
    placeholder: '4',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'current_year',
    label: 'Current Year of Study',
    type: 'number',
    placeholder: '2',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'co_applicant_name',
    label: 'Co-Applicant/Guardian Name',
    type: 'text',
    placeholder: 'Parent/Guardian name',
    required: true,
    verifiable: false,
    helpText: 'Required for students without income',
    category: 'IDENTITY'
  },
  {
    key: 'co_applicant_income',
    label: 'Co-Applicant Annual Income',
    type: 'number',
    placeholder: '500000',
    required: true,
    verifiable: false,
    category: 'INCOME'
  }
]

// GIG_ECONOMY-specific fields
const GIG_ECONOMY_FIELDS: KYCField[] = [
  {
    key: 'primary_platform',
    label: 'Primary Platform/Source',
    type: 'text',
    placeholder: 'e.g., Upwork, Swiggy, YouTube',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'gig_type',
    label: 'Type of Gig Work',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'FREELANCER', label: 'Freelancer (IT, Writing, Design)' },
      { value: 'DELIVERY', label: 'Delivery Partner' },
      { value: 'RIDE_SHARE', label: 'Ride Share Driver' },
      { value: 'CONTENT_CREATOR', label: 'Content Creator/Influencer' },
      { value: 'CONSULTANT', label: 'Independent Consultant' },
      { value: 'ARTIST', label: 'Artist/Performer' },
      { value: 'OTHER', label: 'Other' }
    ],
    category: 'EMPLOYMENT'
  },
  {
    key: 'years_of_experience',
    label: 'Years in Gig Work',
    type: 'number',
    placeholder: '2',
    required: true,
    verifiable: false,
    category: 'EMPLOYMENT'
  },
  {
    key: 'gstin',
    label: 'GST Number (if registered)',
    type: 'text',
    placeholder: '22AAAAA0000A1Z5',
    required: false,
    verifiable: true,
    verificationMethod: 'GST_VERIFY',
    category: 'BUSINESS'
  },
  {
    key: 'monthly_average_income',
    label: 'Average Monthly Income',
    type: 'number',
    placeholder: '40000',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    helpText: 'Average income over last 6 months',
    category: 'INCOME'
  },
  {
    key: 'portfolio_url',
    label: 'Portfolio/Profile URL',
    type: 'text',
    placeholder: 'https://yourportfolio.com',
    required: false,
    verifiable: false,
    category: 'EMPLOYMENT'
  }
]

// WOMEN-specific fields (additional to base category)
const WOMEN_SPECIFIC_FIELDS: KYCField[] = [
  {
    key: 'women_owned_business',
    label: 'Women-Owned Business (51%+ ownership)',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'YES', label: 'Yes - 51% or more owned by women' },
      { value: 'NO', label: 'No' }
    ],
    helpText: 'Required for women entrepreneur schemes',
    category: 'BUSINESS'
  },
  {
    key: 'shg_membership',
    label: 'Self Help Group (SHG) Membership',
    type: 'select',
    required: false,
    verifiable: false,
    options: [
      { value: 'YES', label: 'Yes - Active SHG Member' },
      { value: 'NO', label: 'No' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'shg_name',
    label: 'SHG Name',
    type: 'text',
    placeholder: 'Name of your Self Help Group',
    required: false,
    verifiable: false,
    category: 'BUSINESS'
  }
]

// INSTITUTIONAL-specific fields
const INSTITUTIONAL_FIELDS: KYCField[] = [
  {
    key: 'institution_type',
    label: 'Institution Type',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'SCHOOL', label: 'School/College' },
      { value: 'HOSPITAL', label: 'Hospital/Clinic' },
      { value: 'NGO', label: 'NGO/Non-Profit' },
      { value: 'TRUST', label: 'Charitable Trust' },
      { value: 'SOCIETY', label: 'Cooperative Society' },
      { value: 'HOUSING_SOCIETY', label: 'Housing Society' },
      { value: 'RELIGIOUS', label: 'Religious Institution' }
    ],
    category: 'BUSINESS'
  },
  {
    key: 'registration_number',
    label: 'Registration Number',
    type: 'text',
    placeholder: 'Society/Trust registration number',
    required: true,
    verifiable: true,
    verificationMethod: 'MANUAL',
    category: 'BUSINESS'
  },
  {
    key: 'registration_authority',
    label: 'Registered With',
    type: 'text',
    placeholder: 'e.g., Charity Commissioner, Registrar of Societies',
    required: true,
    verifiable: false,
    category: 'BUSINESS'
  },
  {
    key: 'date_of_establishment',
    label: 'Date of Establishment',
    type: 'date',
    required: true,
    verifiable: false,
    category: 'BUSINESS'
  },
  {
    key: 'annual_budget',
    label: 'Annual Budget/Turnover',
    type: 'number',
    placeholder: '5000000',
    required: true,
    verifiable: false,
    category: 'INCOME'
  },
  ...BUSINESS_FIELDS.filter(f => ['business_pan', 'gstin', 'business_address'].includes(f.key))
]

// SPECIAL category fields
const SPECIAL_FIELDS: KYCField[] = [
  {
    key: 'income_source',
    label: 'Primary Income Source',
    type: 'select',
    required: true,
    verifiable: false,
    options: [
      { value: 'RENTAL', label: 'Rental Income' },
      { value: 'DIVIDEND', label: 'Dividend/Investment Income' },
      { value: 'FAMILY_SUPPORT', label: 'Family Support' },
      { value: 'SAVINGS', label: 'Savings/FD Interest' },
      { value: 'OTHER', label: 'Other' }
    ],
    category: 'INCOME'
  },
  {
    key: 'monthly_income',
    label: 'Monthly Income',
    type: 'number',
    placeholder: '25000',
    required: true,
    verifiable: true,
    verificationMethod: 'BANK_VERIFY',
    category: 'INCOME'
  },
  {
    key: 'special_category',
    label: 'Special Category (if applicable)',
    type: 'select',
    required: false,
    verifiable: false,
    options: [
      { value: 'NONE', label: 'None' },
      { value: 'SC', label: 'Scheduled Caste (SC)' },
      { value: 'ST', label: 'Scheduled Tribe (ST)' },
      { value: 'OBC', label: 'Other Backward Class (OBC)' },
      { value: 'MINORITY', label: 'Minority' },
      { value: 'EWS', label: 'Economically Weaker Section (EWS)' },
      { value: 'DIFFERENTLY_ABLED', label: 'Differently Abled' },
      { value: 'EX_SERVICEMEN', label: 'Ex-Servicemen' }
    ],
    helpText: 'May be eligible for special schemes',
    category: 'IDENTITY'
  }
]

// =====================================================
// SUBROLE KYC CONFIGURATIONS
// =====================================================

export const SUBROLE_KYC_CONFIGS: Record<string, SubroleKYCConfig> = {
  INDIVIDUAL: {
    subroleKey: 'INDIVIDUAL',
    subroleLabel: 'Individual',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'income', title: 'Income Details', description: 'Income source information', fields: SPECIAL_FIELDS.filter(f => f.category === 'INCOME') }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'ADDRESS_PROOF']
  },
  SALARIED: {
    subroleKey: 'SALARIED',
    subroleLabel: 'Salaried Employee',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'employment', title: 'Employment Details', description: 'Current employment information', fields: SALARIED_EMPLOYMENT_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'BANK_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'SALARY_SLIP', 'BANK_STATEMENT', 'FORM_16', 'EMPLOYMENT_PROOF']
  },
  PROFESSIONAL: {
    subroleKey: 'PROFESSIONAL',
    subroleLabel: 'Self-Employed Professional',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'professional', title: 'Professional Details', description: 'Professional qualification and practice', fields: PROFESSIONAL_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'GST_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'PROFESSIONAL_LICENSE', 'ITR', 'BANK_STATEMENT']
  },
  BUSINESS: {
    subroleKey: 'BUSINESS',
    subroleLabel: 'Self-Employed Business',
    sections: [
      { id: 'identity', title: 'Proprietor/Director Identity', description: 'Identity of key person', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'business', title: 'Business Details', description: 'Business entity information', fields: BUSINESS_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'GST_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'GST_CERTIFICATE', 'ITR', 'BANK_STATEMENT', 'MOA_AOA', 'PARTNERSHIP_DEED']
  },
  MSME: {
    subroleKey: 'MSME',
    subroleLabel: 'MSME',
    sections: [
      { id: 'identity', title: 'Owner/Director Identity', description: 'Identity of key person', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'msme', title: 'MSME Details', description: 'Enterprise classification and registration', fields: MSME_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'GST_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'UDYAM_CERTIFICATE', 'GST_CERTIFICATE', 'ITR', 'BANK_STATEMENT']
  },
  AGRICULTURE: {
    subroleKey: 'AGRICULTURE',
    subroleLabel: 'Agriculture & Allied',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'agriculture', title: 'Agricultural Details', description: 'Land and farming information', fields: AGRICULTURE_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'LAND_RECORDS', 'KISAN_CREDIT_CARD', 'BANK_STATEMENT']
  },
  PENSIONER: {
    subroleKey: 'PENSIONER',
    subroleLabel: 'Pensioner',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'pension', title: 'Pension Details', description: 'Pension and retirement information', fields: PENSIONER_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'BANK_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'PENSION_CERTIFICATE', 'PPO_COPY', 'BANK_STATEMENT']
  },
  NRI: {
    subroleKey: 'NRI',
    subroleLabel: 'Non-Resident Indian',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Passport and identity documents', fields: [...COMMON_IDENTITY_FIELDS.filter(f => f.key !== 'aadhaar_number'), ...NRI_FIELDS.filter(f => f.category === 'IDENTITY')] },
      { id: 'address', title: 'Address Details', description: 'Indian and overseas address', fields: [...COMMON_ADDRESS_FIELDS, ...NRI_FIELDS.filter(f => f.category === 'ADDRESS')] },
      { id: 'nri', title: 'NRI Details', description: 'Overseas employment and income', fields: NRI_FIELDS.filter(f => f.category === 'INCOME' || f.category === 'EMPLOYMENT') }
    ],
    requiredVerifications: ['PAN_VERIFY', 'BANK_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'PASSPORT', 'VISA', 'OVERSEAS_ADDRESS_PROOF', 'NRE_NRO_STATEMENT', 'EMPLOYMENT_PROOF']
  },
  WOMEN: {
    subroleKey: 'WOMEN',
    subroleLabel: 'Women',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'women', title: 'Women Entrepreneur Details', description: 'Business ownership and SHG details', fields: WOMEN_SPECIFIC_FIELDS },
      { id: 'income', title: 'Income Details', description: 'Source of income', fields: SPECIAL_FIELDS.filter(f => f.category === 'INCOME') }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'BUSINESS_REGISTRATION', 'BANK_STATEMENT']
  },
  STUDENT: {
    subroleKey: 'STUDENT',
    subroleLabel: 'Student',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'education', title: 'Education Details', description: 'Institution and course information', fields: STUDENT_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'ADMISSION_LETTER', 'FEE_STRUCTURE', 'STUDENT_ID', 'CO_APPLICANT_INCOME_PROOF']
  },
  GIG_ECONOMY: {
    subroleKey: 'GIG_ECONOMY',
    subroleLabel: 'Gig Economy & Freelancer',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'gig', title: 'Gig Work Details', description: 'Platform and income information', fields: GIG_ECONOMY_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP', 'BANK_VERIFY'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'BANK_STATEMENT', 'PLATFORM_EARNINGS', 'ITR']
  },
  INSTITUTIONAL: {
    subroleKey: 'INSTITUTIONAL',
    subroleLabel: 'Institutional',
    sections: [
      { id: 'identity', title: 'Authorized Signatory Identity', description: 'Identity of authorized person', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'institutional', title: 'Institution Details', description: 'Registration and financial details', fields: INSTITUTIONAL_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'REGISTRATION_CERTIFICATE', 'TRUST_DEED', 'AUDITED_ACCOUNTS', 'BOARD_RESOLUTION']
  },
  SPECIAL: {
    subroleKey: 'SPECIAL',
    subroleLabel: 'Special Categories',
    sections: [
      { id: 'identity', title: 'Identity Verification', description: 'Basic identity documents', fields: COMMON_IDENTITY_FIELDS },
      { id: 'address', title: 'Address Verification', description: 'Current residential address', fields: COMMON_ADDRESS_FIELDS },
      { id: 'special', title: 'Category & Income Details', description: 'Special category and income source', fields: SPECIAL_FIELDS }
    ],
    requiredVerifications: ['PAN_VERIFY', 'AADHAAR_OTP'],
    additionalDocuments: ['PAN_CARD', 'AADHAAR', 'CATEGORY_CERTIFICATE', 'INCOME_PROOF', 'BANK_STATEMENT']
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get KYC configuration for a subrole
 */
export function getKYCConfigBySubrole(subroleKey: string): SubroleKYCConfig | null {
  return SUBROLE_KYC_CONFIGS[subroleKey] || null
}

/**
 * Get all KYC fields for a subrole (flattened)
 */
export function getAllKYCFields(subroleKey: string): KYCField[] {
  const config = getKYCConfigBySubrole(subroleKey)
  if (!config) return []
  return config.sections.flatMap(section => section.fields)
}

/**
 * Get required fields for a subrole
 */
export function getRequiredKYCFields(subroleKey: string): KYCField[] {
  return getAllKYCFields(subroleKey).filter(field => field.required)
}

/**
 * Get verifiable fields for a subrole
 */
export function getVerifiableKYCFields(subroleKey: string): KYCField[] {
  return getAllKYCFields(subroleKey).filter(field => field.verifiable)
}

/**
 * Check if all required KYC fields are filled
 */
export function isKYCComplete(subroleKey: string, data: Record<string, unknown>): boolean {
  const requiredFields = getRequiredKYCFields(subroleKey)
  return requiredFields.every(field => {
    const value = data[field.key]
    return value !== undefined && value !== null && value !== ''
  })
}

/**
 * Calculate KYC completion percentage
 */
export function calculateKYCCompletion(subroleKey: string, data: Record<string, unknown>): number {
  const requiredFields = getRequiredKYCFields(subroleKey)
  if (requiredFields.length === 0) return 100

  const filledCount = requiredFields.filter(field => {
    const value = data[field.key]
    return value !== undefined && value !== null && value !== ''
  }).length

  return Math.round((filledCount / requiredFields.length) * 100)
}

// =====================================================
// EKYC VERIFICATION METHODS
// =====================================================

export interface EKYCVerificationMethod {
  key: string
  name: string
  description: string
  icon: string
  provider: string
  fields: string[]
  isEnabled: boolean
}

export const EKYC_VERIFICATION_METHODS: EKYCVerificationMethod[] = [
  {
    key: 'AADHAAR_OTP',
    name: 'Aadhaar eKYC',
    description: 'Verify identity using Aadhaar OTP authentication',
    icon: 'fingerprint',
    provider: 'UIDAI',
    fields: ['aadhaar_number', 'full_name', 'date_of_birth', 'gender', 'current_address'],
    isEnabled: true
  },
  {
    key: 'PAN_VERIFY',
    name: 'PAN Verification',
    description: 'Verify PAN card details with Income Tax database',
    icon: 'id-card',
    provider: 'NSDL/UTI',
    fields: ['pan_number', 'full_name', 'date_of_birth'],
    isEnabled: true
  },
  {
    key: 'BANK_VERIFY',
    name: 'Bank Account Verification',
    description: 'Verify bank account using penny drop or Account Aggregator',
    icon: 'landmark',
    provider: 'Account Aggregator',
    fields: ['bank_account_number', 'ifsc_code', 'account_holder_name'],
    isEnabled: true
  },
  {
    key: 'GST_VERIFY',
    name: 'GST Verification',
    description: 'Verify GST registration and business details',
    icon: 'receipt',
    provider: 'GSTN',
    fields: ['gstin', 'business_name', 'business_address'],
    isEnabled: true
  },
  {
    key: 'DIGILOCKER',
    name: 'DigiLocker',
    description: 'Fetch documents directly from DigiLocker',
    icon: 'folder-lock',
    provider: 'DigiLocker',
    fields: [],
    isEnabled: true
  },
  {
    key: 'VIDEO_KYC',
    name: 'Video KYC',
    description: 'Complete KYC verification via video call',
    icon: 'video',
    provider: 'Internal',
    fields: [],
    isEnabled: true
  }
]

/**
 * Get verification method details
 */
export function getVerificationMethod(methodKey: string): EKYCVerificationMethod | null {
  return EKYC_VERIFICATION_METHODS.find(m => m.key === methodKey) || null
}

/**
 * Get enabled verification methods
 */
export function getEnabledVerificationMethods(): EKYCVerificationMethod[] {
  return EKYC_VERIFICATION_METHODS.filter(m => m.isEnabled)
}
