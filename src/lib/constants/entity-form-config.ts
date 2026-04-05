/**
 * Entity Form Configuration
 * Defines form fields, member configurations, and document requirements for all 10 entity types
 *
 * NOTE: All fields are NOT mandatory until development is complete
 */

// ============================================
// TYPES
// ============================================

export type EntityFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'pincode'  // Auto-fills city/state
  | 'pan'      // PAN verification
  | 'gst'      // GST verification
  | 'aadhaar'  // Aadhaar verification
  | 'din'      // DIN verification

export interface EntityFormField {
  key: string
  label: string
  type: EntityFieldType
  placeholder?: string
  options?: { value: string; label: string }[]
  dependsOn?: { field: string; value: string | string[] }
  helpText?: string
  maxLength?: number
  pattern?: string
  verifiable?: boolean  // If true, shows verify button
  required: false  // All fields NOT mandatory during dev
}

export interface EntityFormSection {
  id: string
  title: string
  description?: string
  fields: EntityFormField[]
}

export interface MemberRole {
  key: string
  label: string
  minCount: number
  maxCount: number
}

export interface MemberField {
  key: string
  label: string
  type: EntityFieldType
  placeholder?: string
  options?: { value: string; label: string }[]
  verifiable?: boolean
  required: false
}

export interface EntityMemberConfig {
  roles: MemberRole[]
  fields: MemberField[]
  autoPopulateFirst: boolean  // Auto-populate from My Profile
  firstMemberEditable: boolean
}

export interface EntityDocument {
  key: string
  label: string
  description?: string
  acceptedFormats: string[]
  maxSizeMB: number
  allowScan: boolean
  required: false
}

export interface EntityFormConfig {
  entityType: string
  label: string
  detailsSections: EntityFormSection[]
  memberConfig: EntityMemberConfig
  documents: EntityDocument[]
}

// ============================================
// COMMON FIELDS (used across all entities)
// ============================================

const COMMON_ADDRESS_FIELDS: EntityFormField[] = [
  {
    key: 'address_line1',
    label: 'Address Line 1',
    type: 'text',
    placeholder: 'Building/Flat No., Street Name',
    maxLength: 200,
    required: false
  },
  {
    key: 'address_line2',
    label: 'Address Line 2',
    type: 'text',
    placeholder: 'Area, Landmark',
    maxLength: 200,
    required: false
  },
  {
    key: 'pincode',
    label: 'PIN Code',
    type: 'pincode',
    placeholder: '6-digit PIN code',
    pattern: '^[1-9][0-9]{5}$',
    helpText: 'City and State will auto-fill based on PIN code',
    required: false
  },
  {
    key: 'city',
    label: 'City',
    type: 'text',
    placeholder: 'City (auto-filled)',
    required: false
  },
  {
    key: 'state',
    label: 'State',
    type: 'text',
    placeholder: 'State (auto-filled)',
    required: false
  }
]

const OFFICE_OWNERSHIP_FIELDS: EntityFormField[] = [
  {
    key: 'office_ownership',
    label: 'Office/Premises Ownership',
    type: 'radio',
    options: [
      { value: 'OWNED', label: 'Owned' },
      { value: 'RENTED', label: 'Rented' },
      { value: 'LEASED', label: 'Leased' }
    ],
    required: false
  },
  {
    key: 'rent_amount',
    label: 'Monthly Rent Amount',
    type: 'text',
    placeholder: 'Enter monthly rent',
    dependsOn: { field: 'office_ownership', value: ['RENTED', 'LEASED'] },
    required: false
  }
]

const GST_FIELDS: EntityFormField[] = [
  {
    key: 'has_gst',
    label: 'GST Registered?',
    type: 'radio',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ],
    required: false
  },
  {
    key: 'gst_number',
    label: 'GST Number',
    type: 'gst',
    placeholder: '15-character GST number',
    pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
    dependsOn: { field: 'has_gst', value: 'yes' },
    verifiable: true,
    required: false
  }
]

// Common member fields
const COMMON_MEMBER_FIELDS: MemberField[] = [
  {
    key: 'full_name',
    label: 'Full Name',
    type: 'text',
    placeholder: 'As per PAN card',
    required: false
  },
  {
    key: 'pan_number',
    label: 'PAN Number',
    type: 'pan',
    placeholder: '10-character PAN',
    verifiable: true,
    required: false
  },
  {
    key: 'aadhaar_number',
    label: 'Aadhaar Number',
    type: 'aadhaar',
    placeholder: '12-digit Aadhaar',
    verifiable: true,
    required: false
  },
  {
    key: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'email@example.com',
    required: false
  },
  {
    key: 'mobile',
    label: 'Mobile Number',
    type: 'phone',
    placeholder: '10-digit mobile number',
    required: false
  },
  {
    key: 'date_of_birth',
    label: 'Date of Birth',
    type: 'date',
    required: false
  },
  {
    key: 'address',
    label: 'Residential Address',
    type: 'textarea',
    placeholder: 'Full residential address',
    required: false
  },
  {
    key: 'pincode',
    label: 'PIN Code',
    type: 'pincode',
    placeholder: '6-digit PIN',
    required: false
  },
  {
    key: 'city',
    label: 'City',
    type: 'text',
    required: false
  },
  {
    key: 'state',
    label: 'State',
    type: 'text',
    required: false
  }
]

// Common documents
const COMMON_DOCUMENTS: EntityDocument[] = [
  {
    key: 'pan_card',
    label: 'PAN Card',
    description: 'Entity PAN card',
    acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5,
    allowScan: true,
    required: false
  },
  {
    key: 'address_proof',
    label: 'Address Proof',
    description: 'Office/Business address proof',
    acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
    maxSizeMB: 5,
    allowScan: true,
    required: false
  },
  {
    key: 'bank_statement',
    label: 'Bank Statement',
    description: 'Last 6 months bank statement (or use Account Aggregator)',
    acceptedFormats: ['application/pdf'],
    maxSizeMB: 5,
    allowScan: false,
    required: false
  }
]

// ============================================
// ENTITY-SPECIFIC CONFIGURATIONS
// ============================================

// 1. PROPRIETORSHIP
const PROPRIETORSHIP_CONFIG: EntityFormConfig = {
  entityType: 'PROPRIETORSHIP',
  label: 'Proprietorship',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Business Information',
      fields: [
        {
          key: 'business_name',
          label: 'Business/Trade Name',
          type: 'text',
          placeholder: 'Enter business name',
          maxLength: 200,
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Describe your business activity',
          required: false
        },
        {
          key: 'date_of_commencement',
          label: 'Date of Commencement',
          type: 'date',
          helpText: 'Date when business operations started',
          required: false
        },
        {
          key: 'business_vintage',
          label: 'Business Vintage (Years)',
          type: 'text',
          placeholder: 'Number of years in business',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Business Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        ...GST_FIELDS,
        {
          key: 'udyam_number',
          label: 'Udyam Registration Number',
          type: 'text',
          placeholder: 'UDYAM-XX-00-0000000',
          helpText: 'If registered under MSME',
          required: false
        },
        {
          key: 'shop_establishment_number',
          label: 'Shop & Establishment License No.',
          type: 'text',
          placeholder: 'Enter license number if applicable',
          required: false
        }
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'PROPRIETOR', label: 'Proprietor', minCount: 1, maxCount: 1 }
    ],
    fields: COMMON_MEMBER_FIELDS,
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      description: 'If GST registered',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'shop_license',
      label: 'Shop & Establishment License',
      description: 'Business license from local authority',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'udyam_certificate',
      label: 'Udyam Registration Certificate',
      description: 'MSME registration certificate if applicable',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Income Tax Returns',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 2. PARTNERSHIP
const PARTNERSHIP_CONFIG: EntityFormConfig = {
  entityType: 'PARTNERSHIP',
  label: 'Partnership Firm',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Firm Information',
      fields: [
        {
          key: 'firm_name',
          label: 'Partnership Firm Name',
          type: 'text',
          placeholder: 'Enter firm name',
          maxLength: 200,
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Describe your business activity',
          required: false
        },
        {
          key: 'date_of_deed',
          label: 'Date of Partnership Deed',
          type: 'date',
          helpText: 'Date when partnership deed was executed',
          required: false
        },
        {
          key: 'firm_registration_number',
          label: 'Firm Registration Number',
          type: 'text',
          placeholder: 'If registered with ROF',
          helpText: 'Registration number from Registrar of Firms',
          required: false
        },
        {
          key: 'is_registered',
          label: 'Is Firm Registered?',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Firm Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'firm_pan',
          label: 'Firm PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS,
        {
          key: 'udyam_number',
          label: 'Udyam Registration Number',
          type: 'text',
          placeholder: 'UDYAM-XX-00-0000000',
          required: false
        }
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'PARTNER', label: 'Partner', minCount: 2, maxCount: 20 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'profit_share_percentage',
        label: 'Profit Sharing Ratio (%)',
        type: 'text',
        placeholder: 'e.g., 50',
        required: false
      },
      {
        key: 'capital_contribution',
        label: 'Capital Contribution',
        type: 'text',
        placeholder: 'Amount in INR',
        required: false
      },
      {
        key: 'is_managing_partner',
        label: 'Is Managing Partner?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'partnership_deed',
      label: 'Partnership Deed',
      description: 'Registered partnership deed',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'registration_certificate',
      label: 'Firm Registration Certificate',
      description: 'Certificate from Registrar of Firms',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'partner_pan_cards',
      label: 'All Partners PAN Cards',
      description: 'PAN cards of all partners',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Firm ITR',
      description: 'Last 2 years ITR of the firm',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 3. LLP (Limited Liability Partnership)
const LLP_CONFIG: EntityFormConfig = {
  entityType: 'LLP',
  label: 'Limited Liability Partnership (LLP)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'LLP Information',
      fields: [
        {
          key: 'llp_name',
          label: 'LLP Name',
          type: 'text',
          placeholder: 'Enter LLP name',
          maxLength: 200,
          required: false
        },
        {
          key: 'llpin',
          label: 'LLPIN (LLP Identification Number)',
          type: 'text',
          placeholder: 'AAA-0000',
          helpText: 'Unique identification number from MCA',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Describe your business activity',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Total Contribution',
          type: 'text',
          placeholder: 'Total capital contribution',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'llp_pan',
          label: 'LLP PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS,
        {
          key: 'tan_number',
          label: 'TAN Number',
          type: 'text',
          placeholder: '10-character TAN',
          required: false
        }
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'DESIGNATED_PARTNER', label: 'Designated Partner', minCount: 2, maxCount: 10 },
      { key: 'PARTNER', label: 'Partner', minCount: 0, maxCount: 50 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'dpin',
        label: 'DPIN (Designated Partner Identification Number)',
        type: 'text',
        placeholder: '8-digit DPIN',
        required: false
      },
      {
        key: 'contribution_amount',
        label: 'Capital Contribution',
        type: 'text',
        placeholder: 'Amount in INR',
        required: false
      },
      {
        key: 'contribution_percentage',
        label: 'Contribution Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 50',
        required: false
      },
      {
        key: 'date_of_joining',
        label: 'Date of Becoming Partner',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'llp_agreement',
      label: 'LLP Agreement',
      description: 'Registered LLP agreement',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      description: 'LLP incorporation certificate from MCA',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'moa',
      label: 'LLP Form 3 (Information & Undertaking)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'partner_documents',
      label: 'Designated Partners Identity Proof',
      description: 'PAN and address proof of all designated partners',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'LLP ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'annual_return',
      label: 'Annual Return (Form 11)',
      description: 'Latest annual return filed with MCA',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 4. PRIVATE LIMITED COMPANY
const PRIVATE_LIMITED_CONFIG: EntityFormConfig = {
  entityType: 'PRIVATE_LIMITED',
  label: 'Private Limited Company',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Enter company name',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'U00000XX0000XXX000000',
          helpText: '21-character CIN from MCA',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Primary business activity',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Authorized Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'paid_up_capital',
          label: 'Paid-up Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'tan_number',
          label: 'TAN Number',
          type: 'text',
          placeholder: '10-character TAN',
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'DIRECTOR', label: 'Director', minCount: 2, maxCount: 15 },
      { key: 'SHAREHOLDER', label: 'Shareholder', minCount: 1, maxCount: 200 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'din',
        label: 'DIN (Director Identification Number)',
        type: 'din',
        placeholder: '8-digit DIN',
        verifiable: true,
        required: false
      },
      {
        key: 'designation',
        label: 'Designation',
        type: 'select',
        options: [
          { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
          { value: 'WHOLE_TIME_DIRECTOR', label: 'Whole Time Director' },
          { value: 'DIRECTOR', label: 'Director' },
          { value: 'INDEPENDENT_DIRECTOR', label: 'Independent Director' },
          { value: 'ADDITIONAL_DIRECTOR', label: 'Additional Director' }
        ],
        required: false
      },
      {
        key: 'shareholding_percentage',
        label: 'Shareholding Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 25',
        required: false
      },
      {
        key: 'date_of_appointment',
        label: 'Date of Appointment',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      description: 'Resolution authorizing loan application',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'shareholding_pattern',
      label: 'Shareholding Pattern',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'director_kyc',
      label: 'All Directors KYC',
      description: 'PAN, Aadhaar, and address proof of all directors',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Company ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'audited_financials',
      label: 'Audited Financial Statements',
      description: 'Last 2 years audited balance sheet and P&L',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 5. PUBLIC LIMITED COMPANY
const PUBLIC_LIMITED_CONFIG: EntityFormConfig = {
  entityType: 'PUBLIC_LIMITED',
  label: 'Public Limited Company',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Enter company name',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'L00000XX0000XXX000000',
          helpText: '21-character CIN from MCA',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Primary business activity',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Authorized Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'paid_up_capital',
          label: 'Paid-up Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'is_listed',
          label: 'Is Listed on Stock Exchange?',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        },
        {
          key: 'stock_exchange',
          label: 'Stock Exchange',
          type: 'select',
          options: [
            { value: 'BSE', label: 'BSE' },
            { value: 'NSE', label: 'NSE' },
            { value: 'BOTH', label: 'Both BSE & NSE' }
          ],
          dependsOn: { field: 'is_listed', value: 'yes' },
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'tan_number',
          label: 'TAN Number',
          type: 'text',
          placeholder: '10-character TAN',
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'DIRECTOR', label: 'Director', minCount: 3, maxCount: 15 },
      { key: 'SHAREHOLDER', label: 'Major Shareholder (>5%)', minCount: 0, maxCount: 50 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'din',
        label: 'DIN (Director Identification Number)',
        type: 'din',
        placeholder: '8-digit DIN',
        verifiable: true,
        required: false
      },
      {
        key: 'designation',
        label: 'Designation',
        type: 'select',
        options: [
          { value: 'CHAIRMAN', label: 'Chairman' },
          { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
          { value: 'WHOLE_TIME_DIRECTOR', label: 'Whole Time Director' },
          { value: 'EXECUTIVE_DIRECTOR', label: 'Executive Director' },
          { value: 'NON_EXECUTIVE_DIRECTOR', label: 'Non-Executive Director' },
          { value: 'INDEPENDENT_DIRECTOR', label: 'Independent Director' }
        ],
        required: false
      },
      {
        key: 'shareholding_percentage',
        label: 'Shareholding Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 10',
        required: false
      },
      {
        key: 'date_of_appointment',
        label: 'Date of Appointment',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'shareholding_pattern',
      label: 'Shareholding Pattern',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'director_kyc',
      label: 'All Directors KYC',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'audited_financials',
      label: 'Audited Financial Statements',
      description: 'Last 3 years audited balance sheet and P&L',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'annual_report',
      label: 'Annual Report',
      description: 'Latest annual report',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 6. ONE PERSON COMPANY (OPC)
const OPC_CONFIG: EntityFormConfig = {
  entityType: 'OPC',
  label: 'One Person Company (OPC)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Enter company name (OPC) Pvt Ltd',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'U00000XX0000OPC000000',
          helpText: '21-character CIN from MCA',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business',
          type: 'text',
          placeholder: 'Primary business activity',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Authorized Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'paid_up_capital',
          label: 'Paid-up Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'tan_number',
          label: 'TAN Number',
          type: 'text',
          placeholder: '10-character TAN',
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'DIRECTOR', label: 'Director (Sole Member)', minCount: 1, maxCount: 1 },
      { key: 'NOMINEE', label: 'Nominee Director', minCount: 1, maxCount: 1 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'din',
        label: 'DIN (Director Identification Number)',
        type: 'din',
        placeholder: '8-digit DIN',
        verifiable: true,
        required: false
      },
      {
        key: 'is_nominee',
        label: 'Is Nominee?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      },
      {
        key: 'nominee_consent_date',
        label: 'Nominee Consent Date',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'nominee_consent',
      label: 'Nominee Consent Letter',
      description: 'Written consent from nominee director',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'director_kyc',
      label: 'Director & Nominee KYC',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'gst_certificate',
      label: 'GST Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Company ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'audited_financials',
      label: 'Audited Financial Statements',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 7. HINDU UNDIVIDED FAMILY (HUF)
const HUF_CONFIG: EntityFormConfig = {
  entityType: 'HUF',
  label: 'Hindu Undivided Family (HUF)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'HUF Information',
      fields: [
        {
          key: 'huf_name',
          label: 'HUF Name',
          type: 'text',
          placeholder: 'e.g., Sharma (HUF)',
          maxLength: 200,
          required: false
        },
        {
          key: 'date_of_creation',
          label: 'Date of Creation/Formation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business/Investment',
          type: 'text',
          placeholder: 'Business activity or investment purpose',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'HUF Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax Details',
      fields: [
        {
          key: 'huf_pan',
          label: 'HUF PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'KARTA', label: 'Karta (Manager)', minCount: 1, maxCount: 1 },
      { key: 'COPARCENER', label: 'Coparcener', minCount: 0, maxCount: 20 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'relationship_to_karta',
        label: 'Relationship to Karta',
        type: 'select',
        options: [
          { value: 'SELF', label: 'Self (Karta)' },
          { value: 'SON', label: 'Son' },
          { value: 'DAUGHTER', label: 'Daughter' },
          { value: 'GRANDSON', label: 'Grandson' },
          { value: 'GRANDDAUGHTER', label: 'Granddaughter' },
          { value: 'WIFE', label: 'Wife' },
          { value: 'FATHER', label: 'Father' },
          { value: 'MOTHER', label: 'Mother' }
        ],
        required: false
      },
      {
        key: 'share_in_huf',
        label: 'Share in HUF Property (%)',
        type: 'text',
        placeholder: 'Percentage share',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'huf_deed',
      label: 'HUF Deed/Declaration',
      description: 'HUF formation deed or declaration',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'karta_pan',
      label: 'Karta PAN Card',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'karta_aadhaar',
      label: 'Karta Aadhaar Card',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'coparcener_list',
      label: 'List of Coparceners with Details',
      description: 'Affidavit listing all coparceners',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'HUF ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 8. TRUST
const TRUST_CONFIG: EntityFormConfig = {
  entityType: 'TRUST',
  label: 'Trust',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Trust Information',
      fields: [
        {
          key: 'trust_name',
          label: 'Trust Name',
          type: 'text',
          placeholder: 'Enter trust name',
          maxLength: 200,
          required: false
        },
        {
          key: 'trust_type',
          label: 'Type of Trust',
          type: 'select',
          options: [
            { value: 'PUBLIC_CHARITABLE', label: 'Public Charitable Trust' },
            { value: 'PRIVATE_TRUST', label: 'Private Trust' },
            { value: 'RELIGIOUS_TRUST', label: 'Religious Trust' },
            { value: 'FAMILY_TRUST', label: 'Family Trust' },
            { value: 'EDUCATIONAL_TRUST', label: 'Educational Trust' }
          ],
          required: false
        },
        {
          key: 'trust_registration_number',
          label: 'Trust Registration Number',
          type: 'text',
          placeholder: 'Registration number',
          required: false
        },
        {
          key: 'date_of_creation',
          label: 'Date of Creation/Registration',
          type: 'date',
          required: false
        },
        {
          key: 'objectives',
          label: 'Objectives of Trust',
          type: 'textarea',
          placeholder: 'Primary objectives of the trust',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Trust Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'trust_pan',
          label: 'Trust PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'section_12a',
          label: '12A Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          helpText: 'Income tax exemption registration',
          required: false
        },
        {
          key: 'section_80g',
          label: '80G Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          helpText: 'Donors can claim tax deduction',
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'TRUSTEE', label: 'Trustee', minCount: 2, maxCount: 21 },
      { key: 'MANAGING_TRUSTEE', label: 'Managing Trustee', minCount: 1, maxCount: 1 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'trustee_type',
        label: 'Trustee Type',
        type: 'select',
        options: [
          { value: 'MANAGING_TRUSTEE', label: 'Managing Trustee' },
          { value: 'TRUSTEE', label: 'Trustee' },
          { value: 'FOUNDER_TRUSTEE', label: 'Founder Trustee' }
        ],
        required: false
      },
      {
        key: 'date_of_appointment',
        label: 'Date of Appointment',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'trust_deed',
      label: 'Trust Deed',
      description: 'Registered trust deed',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'registration_certificate',
      label: 'Trust Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'trustee_resolution',
      label: 'Trustee Resolution for Loan',
      description: 'Resolution authorizing loan application',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'trustee_kyc',
      label: 'All Trustees KYC',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: '12a_certificate',
      label: '12A Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: '80g_certificate',
      label: '80G Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Trust ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'audited_accounts',
      label: 'Audited Accounts',
      description: 'Last 2 years audited accounts',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// 9. SOCIETY
const SOCIETY_CONFIG: EntityFormConfig = {
  entityType: 'SOCIETY',
  label: 'Society',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Society Information',
      fields: [
        {
          key: 'society_name',
          label: 'Society Name',
          type: 'text',
          placeholder: 'Enter society name',
          maxLength: 200,
          required: false
        },
        {
          key: 'registration_number',
          label: 'Registration Number',
          type: 'text',
          placeholder: 'Society registration number',
          required: false
        },
        {
          key: 'registering_authority',
          label: 'Registering Authority',
          type: 'text',
          placeholder: 'e.g., Registrar of Societies, Mumbai',
          required: false
        },
        {
          key: 'date_of_registration',
          label: 'Date of Registration',
          type: 'date',
          required: false
        },
        {
          key: 'objectives',
          label: 'Objectives of Society',
          type: 'textarea',
          placeholder: 'Primary objectives of the society',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'society_pan',
          label: 'Society PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'section_12a',
          label: '12A Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        },
        {
          key: 'section_80g',
          label: '80G Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        },
        {
          key: 'fcra',
          label: 'FCRA Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          helpText: 'Foreign Contribution Regulation Act',
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'GOVERNING_BODY_MEMBER', label: 'Governing Body Member', minCount: 5, maxCount: 21 },
      { key: 'PRESIDENT', label: 'President', minCount: 1, maxCount: 1 },
      { key: 'SECRETARY', label: 'Secretary', minCount: 1, maxCount: 1 },
      { key: 'TREASURER', label: 'Treasurer', minCount: 1, maxCount: 1 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'position',
        label: 'Position in Society',
        type: 'select',
        options: [
          { value: 'PRESIDENT', label: 'President' },
          { value: 'VICE_PRESIDENT', label: 'Vice President' },
          { value: 'SECRETARY', label: 'Secretary' },
          { value: 'JOINT_SECRETARY', label: 'Joint Secretary' },
          { value: 'TREASURER', label: 'Treasurer' },
          { value: 'MEMBER', label: 'Member' }
        ],
        required: false
      },
      {
        key: 'date_of_election',
        label: 'Date of Election/Appointment',
        type: 'date',
        required: false
      },
      {
        key: 'term_end_date',
        label: 'Term End Date',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'registration_certificate',
      label: 'Society Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'memorandum',
      label: 'Memorandum of Association',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'rules_regulations',
      label: 'Rules & Regulations/Bye-laws',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'governing_body_resolution',
      label: 'Governing Body Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'governing_body_list',
      label: 'List of Governing Body Members',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_kyc',
      label: 'Key Office Bearers KYC',
      description: 'PAN and Aadhaar of President, Secretary, Treasurer',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: '12a_certificate',
      label: '12A Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'fcra_certificate',
      label: 'FCRA Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'Society ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'audited_accounts',
      label: 'Audited Accounts',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// ============================================
// 10. COOPERATIVE SOCIETY
// ============================================

const COOPERATIVE_CONFIG: EntityFormConfig = {
  entityType: 'COOPERATIVE',
  label: 'Cooperative Society',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Society Information',
      fields: [
        {
          key: 'cooperative_name',
          label: 'Cooperative Society Name',
          type: 'text',
          placeholder: 'Enter cooperative name',
          maxLength: 200,
          required: false
        },
        {
          key: 'registration_number',
          label: 'Registration Number',
          type: 'text',
          placeholder: 'Cooperative registration number',
          required: false
        },
        {
          key: 'registering_authority',
          label: 'Registering Authority',
          type: 'text',
          placeholder: 'e.g., Registrar of Cooperatives',
          required: false
        },
        {
          key: 'date_of_registration',
          label: 'Date of Registration',
          type: 'date',
          required: false
        },
        {
          key: 'type_of_cooperative',
          label: 'Type of Cooperative',
          type: 'select',
          options: [
            { value: 'CREDIT', label: 'Credit Cooperative' },
            { value: 'CONSUMER', label: 'Consumer Cooperative' },
            { value: 'PRODUCER', label: 'Producer Cooperative' },
            { value: 'MARKETING', label: 'Marketing Cooperative' },
            { value: 'HOUSING', label: 'Housing Cooperative' },
            { value: 'MULTI_PURPOSE', label: 'Multi-Purpose Cooperative' }
          ],
          required: false
        },
        {
          key: 'objectives',
          label: 'Objectives of Cooperative',
          type: 'textarea',
          placeholder: 'Primary objectives of the cooperative',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'cooperative_pan',
          label: 'Cooperative PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'PRESIDENT', label: 'President/Chairman', minCount: 1, maxCount: 1 },
      { key: 'VICE_PRESIDENT', label: 'Vice President', minCount: 0, maxCount: 1 },
      { key: 'SECRETARY', label: 'Secretary', minCount: 1, maxCount: 1 },
      { key: 'TREASURER', label: 'Treasurer', minCount: 1, maxCount: 1 },
      { key: 'BOARD_MEMBER', label: 'Board Member', minCount: 0, maxCount: 15 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'position',
        label: 'Position in Cooperative',
        type: 'select',
        options: [
          { value: 'PRESIDENT', label: 'President/Chairman' },
          { value: 'VICE_PRESIDENT', label: 'Vice President' },
          { value: 'SECRETARY', label: 'Secretary' },
          { value: 'TREASURER', label: 'Treasurer' },
          { value: 'BOARD_MEMBER', label: 'Board Member' }
        ],
        required: false
      },
      {
        key: 'date_of_election',
        label: 'Date of Election',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'registration_certificate',
      label: 'Cooperative Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'bylaws',
      label: 'Bye-laws',
      description: 'Cooperative bye-laws',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'audit_report',
      label: 'Latest Audit Report',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    },
    {
      key: 'member_kyc',
      label: 'Key Office Bearers KYC',
      description: 'PAN and Aadhaar of President, Secretary, Treasurer',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// 11. SECTION 8 COMPANY
// ============================================

const SECTION_8_CONFIG: EntityFormConfig = {
  entityType: 'SECTION_8',
  label: 'Section 8 Company (Non-Profit)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'Company Name',
          type: 'text',
          placeholder: 'Enter company name',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'U00000XX0000XXX000000',
          helpText: '21-character CIN from MCA',
          required: false
        },
        {
          key: 'section_8_license_number',
          label: 'Section 8 License Number',
          type: 'text',
          placeholder: 'License number from MCA',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'objectives',
          label: 'Objectives (Charitable Purpose)',
          type: 'textarea',
          placeholder: 'Describe the charitable/non-profit objectives',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        {
          key: 'section_12a',
          label: '12A Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        },
        {
          key: 'section_80g',
          label: '80G Registration',
          type: 'radio',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' }
          ],
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'MANAGING_DIRECTOR', label: 'Managing Director', minCount: 0, maxCount: 1 },
      { key: 'DIRECTOR', label: 'Director', minCount: 2, maxCount: 15 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'din',
        label: 'DIN (Director Identification Number)',
        type: 'din',
        placeholder: '8-digit DIN',
        verifiable: true,
        required: false
      },
      {
        key: 'designation',
        label: 'Designation',
        type: 'select',
        options: [
          { value: 'MANAGING_DIRECTOR', label: 'Managing Director' },
          { value: 'DIRECTOR', label: 'Director' },
          { value: 'COMPANY_SECRETARY', label: 'Company Secretary' }
        ],
        required: false
      },
      {
        key: 'date_of_appointment',
        label: 'Date of Appointment',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'section_8_license',
      label: 'Section 8 License',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: '12a_certificate',
      label: '12A Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: '80g_certificate',
      label: '80G Registration Certificate',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'director_kyc',
      label: 'All Directors KYC',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// 12. PRODUCER COMPANY
// ============================================

const PRODUCER_COMPANY_CONFIG: EntityFormConfig = {
  entityType: 'PRODUCER_COMPANY',
  label: 'Producer Company',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'Producer Company Name',
          type: 'text',
          placeholder: 'Enter company name',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'U00000XX0000XXX000000',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_produce',
          label: 'Nature of Produce/Activity',
          type: 'textarea',
          placeholder: 'Agricultural produce, livestock, etc.',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Authorized Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'paid_up_capital',
          label: 'Paid-up Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'CHAIRMAN', label: 'Chairman', minCount: 0, maxCount: 1 },
      { key: 'DIRECTOR', label: 'Director', minCount: 5, maxCount: 15 },
      { key: 'CEO', label: 'Chief Executive', minCount: 0, maxCount: 1 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'designation',
        label: 'Designation',
        type: 'select',
        options: [
          { value: 'CHAIRMAN', label: 'Chairman' },
          { value: 'DIRECTOR', label: 'Director' },
          { value: 'CEO', label: 'Chief Executive' }
        ],
        required: false
      },
      {
        key: 'date_of_appointment',
        label: 'Date of Appointment',
        type: 'date',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'director_kyc',
      label: 'All Directors KYC',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// 13. AOP (Association of Persons)
// ============================================

const AOP_CONFIG: EntityFormConfig = {
  entityType: 'AOP',
  label: 'Association of Persons (AOP)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'AOP Information',
      fields: [
        {
          key: 'aop_name',
          label: 'AOP Name',
          type: 'text',
          placeholder: 'Enter AOP name',
          maxLength: 200,
          required: false
        },
        {
          key: 'date_of_formation',
          label: 'Date of Formation',
          type: 'date',
          required: false
        },
        {
          key: 'purpose',
          label: 'Purpose/Objective',
          type: 'textarea',
          placeholder: 'Describe the common purpose of the AOP',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax Details',
      fields: [
        {
          key: 'aop_pan',
          label: 'AOP PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'AUTHORIZED_MEMBER', label: 'Authorized Member', minCount: 1, maxCount: 5 },
      { key: 'MEMBER', label: 'Member', minCount: 1, maxCount: 50 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'share_percentage',
        label: 'Share Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 25',
        required: false
      },
      {
        key: 'is_authorized',
        label: 'Is Authorized to Sign?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'aop_agreement',
      label: 'AOP Agreement/Deed',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_kyc',
      label: 'All Members KYC',
      description: 'PAN and Aadhaar of all members',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'AOP ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// ============================================
// 14. BOI (Body of Individuals)
// ============================================

const BOI_CONFIG: EntityFormConfig = {
  entityType: 'BOI',
  label: 'Body of Individuals (BOI)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'BOI Information',
      fields: [
        {
          key: 'boi_name',
          label: 'BOI Name',
          type: 'text',
          placeholder: 'Enter BOI name',
          maxLength: 200,
          required: false
        },
        {
          key: 'date_of_formation',
          label: 'Date of Formation',
          type: 'date',
          required: false
        },
        {
          key: 'purpose',
          label: 'Purpose/Objective',
          type: 'textarea',
          placeholder: 'Describe the common purpose of the BOI',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax Details',
      fields: [
        {
          key: 'boi_pan',
          label: 'BOI PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'AUTHORIZED_MEMBER', label: 'Authorized Member', minCount: 1, maxCount: 5 },
      { key: 'MEMBER', label: 'Member', minCount: 1, maxCount: 50 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'share_percentage',
        label: 'Share Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 25',
        required: false
      },
      {
        key: 'is_authorized',
        label: 'Is Authorized to Sign?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'boi_agreement',
      label: 'BOI Agreement/Deed',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_kyc',
      label: 'All Members KYC',
      description: 'PAN and Aadhaar of all members',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'itr',
      label: 'BOI ITR',
      description: 'Last 2 years ITR',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: false,
      required: false
    }
  ]
}

// ============================================
// 15. JV INCORPORATED
// ============================================

const JV_INCORPORATED_CONFIG: EntityFormConfig = {
  entityType: 'JV_INCORPORATED',
  label: 'Joint Venture (Incorporated)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'JV Company Information',
      fields: [
        {
          key: 'company_name',
          label: 'JV Company Name',
          type: 'text',
          placeholder: 'Enter JV company name',
          maxLength: 200,
          required: false
        },
        {
          key: 'cin',
          label: 'CIN (Corporate Identity Number)',
          type: 'text',
          placeholder: 'U00000XX0000XXX000000',
          required: false
        },
        {
          key: 'date_of_incorporation',
          label: 'Date of Incorporation',
          type: 'date',
          required: false
        },
        {
          key: 'nature_of_business',
          label: 'Nature of Business/Project',
          type: 'textarea',
          placeholder: 'Describe the JV purpose',
          required: false
        },
        {
          key: 'authorized_capital',
          label: 'Authorized Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'paid_up_capital',
          label: 'Paid-up Capital',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Registered Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax & Registration Details',
      fields: [
        {
          key: 'company_pan',
          label: 'JV Company PAN Number',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'DIRECTOR', label: 'Director', minCount: 2, maxCount: 15 },
      { key: 'NOMINEE_DIRECTOR', label: 'Nominee Director', minCount: 0, maxCount: 10 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'din',
        label: 'DIN (Director Identification Number)',
        type: 'din',
        placeholder: '8-digit DIN',
        verifiable: true,
        required: false
      },
      {
        key: 'representing_company',
        label: 'Representing Company',
        type: 'text',
        placeholder: 'Name of JV partner company',
        required: false
      },
      {
        key: 'shareholding_percentage',
        label: 'JV Partner Shareholding (%)',
        type: 'text',
        placeholder: 'e.g., 50',
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'jv_agreement',
      label: 'JV Agreement',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'incorporation_certificate',
      label: 'Certificate of Incorporation',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'moa',
      label: 'Memorandum of Association (MOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'aoa',
      label: 'Articles of Association (AOA)',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'board_resolution',
      label: 'Board Resolution for Loan',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'partner_board_resolutions',
      label: 'JV Partners Board Resolutions',
      description: 'Board resolutions from each JV partner',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// 16. JV UNINCORPORATED
// ============================================

const JV_UNINCORPORATED_CONFIG: EntityFormConfig = {
  entityType: 'JV_UNINCORPORATED',
  label: 'Joint Venture (Unincorporated)',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'JV Information',
      fields: [
        {
          key: 'jv_name',
          label: 'JV Name',
          type: 'text',
          placeholder: 'Enter JV name',
          maxLength: 200,
          required: false
        },
        {
          key: 'date_of_agreement',
          label: 'Date of JV Agreement',
          type: 'date',
          required: false
        },
        {
          key: 'project_description',
          label: 'Project/Purpose Description',
          type: 'textarea',
          placeholder: 'Describe the JV project or purpose',
          required: false
        },
        {
          key: 'project_value',
          label: 'Estimated Project Value',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Project Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax Details',
      fields: [
        {
          key: 'jv_pan',
          label: 'JV PAN Number (if obtained)',
          type: 'pan',
          placeholder: '10-character PAN',
          verifiable: true,
          required: false
        },
        ...GST_FIELDS
      ]
    }
  ],
  memberConfig: {
    roles: [
      { key: 'LEAD_MEMBER', label: 'Lead Member', minCount: 1, maxCount: 1 },
      { key: 'MEMBER', label: 'JV Member', minCount: 1, maxCount: 10 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'company_name',
        label: 'Company/Entity Name',
        type: 'text',
        placeholder: 'Name of the JV member entity',
        required: false
      },
      {
        key: 'share_percentage',
        label: 'JV Share Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 60',
        required: false
      },
      {
        key: 'is_lead_member',
        label: 'Is Lead Member?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'jv_agreement',
      label: 'JV Agreement',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_authorizations',
      label: 'All Members Authorization Letters',
      description: 'Authorization from each JV member',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_board_resolutions',
      label: 'Members Board Resolutions',
      description: 'Board resolutions from each member entity',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'lead_member_kyc',
      label: 'Lead Member KYC & Documents',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// 17. CONSORTIUM
// ============================================

const CONSORTIUM_CONFIG: EntityFormConfig = {
  entityType: 'CONSORTIUM',
  label: 'Consortium',
  detailsSections: [
    {
      id: 'basic_info',
      title: 'Consortium Information',
      fields: [
        {
          key: 'consortium_name',
          label: 'Consortium Name',
          type: 'text',
          placeholder: 'Enter consortium name',
          maxLength: 200,
          required: false
        },
        {
          key: 'date_of_agreement',
          label: 'Date of Consortium Agreement',
          type: 'date',
          required: false
        },
        {
          key: 'project_description',
          label: 'Project Description',
          type: 'textarea',
          placeholder: 'Describe the consortium project',
          required: false
        },
        {
          key: 'project_value',
          label: 'Project Value',
          type: 'text',
          placeholder: 'Amount in INR',
          required: false
        },
        {
          key: 'project_duration',
          label: 'Project Duration',
          type: 'text',
          placeholder: 'e.g., 24 months',
          required: false
        }
      ]
    },
    {
      id: 'address_info',
      title: 'Project Office Address',
      fields: [...COMMON_ADDRESS_FIELDS, ...OFFICE_OWNERSHIP_FIELDS]
    },
    {
      id: 'tax_info',
      title: 'Tax Details',
      fields: GST_FIELDS
    }
  ],
  memberConfig: {
    roles: [
      { key: 'LEAD_MEMBER', label: 'Lead Member', minCount: 1, maxCount: 1 },
      { key: 'MEMBER', label: 'Consortium Member', minCount: 1, maxCount: 20 }
    ],
    fields: [
      ...COMMON_MEMBER_FIELDS,
      {
        key: 'company_name',
        label: 'Company/Entity Name',
        type: 'text',
        placeholder: 'Name of the consortium member',
        required: false
      },
      {
        key: 'share_percentage',
        label: 'Work Share Percentage (%)',
        type: 'text',
        placeholder: 'e.g., 40',
        required: false
      },
      {
        key: 'is_lead_member',
        label: 'Is Lead Member?',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    autoPopulateFirst: true,
    firstMemberEditable: true
  },
  documents: [
    ...COMMON_DOCUMENTS,
    {
      key: 'consortium_agreement',
      label: 'Consortium Agreement',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'member_board_resolutions',
      label: 'All Members Board Resolutions',
      description: 'Board resolutions from each consortium member',
      acceptedFormats: ['application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    },
    {
      key: 'lead_member_documents',
      label: 'Lead Member Company Documents',
      acceptedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxSizeMB: 5,
      allowScan: true,
      required: false
    }
  ]
}

// ============================================
// MASTER CONFIG EXPORT - ALL 20 ENTITY TYPES
// ============================================
//
// ✅ ACTIVE ENTITIES (11) - Phase 1
// ❌ DISABLED ENTITIES (12) - Phase 2 (per migration 20260210000001)
//    - Database: is_active = false
//    - Configs kept for future re-enablement
//

export const ENTITY_FORM_CONFIGS: Record<string, EntityFormConfig> = {
  // ✅ ACTIVE - 1. Proprietorship
  PROPRIETORSHIP: PROPRIETORSHIP_CONFIG,

  // ✅ ACTIVE - 2-3. Partnership (Unregistered & Registered use same config)
  PARTNERSHIP_UNREGISTERED: { ...PARTNERSHIP_CONFIG, entityType: 'PARTNERSHIP_UNREGISTERED', label: 'Partnership Firm (Unregistered)' },
  PARTNERSHIP_REGISTERED: { ...PARTNERSHIP_CONFIG, entityType: 'PARTNERSHIP_REGISTERED', label: 'Partnership Firm (Registered)' },
  // ❌ DISABLED - Legacy Partnership (replaced by UNREGISTERED/REGISTERED variants)
  PARTNERSHIP: PARTNERSHIP_CONFIG,

  // ✅ ACTIVE - 4. LLP
  LLP: LLP_CONFIG,

  // ✅ ACTIVE - 5. Private Limited
  PRIVATE_LIMITED: PRIVATE_LIMITED_CONFIG,

  // ✅ ACTIVE - 6-7. Public Limited (Unlisted & Listed use same config)
  PUBLIC_LIMITED_UNLISTED: { ...PUBLIC_LIMITED_CONFIG, entityType: 'PUBLIC_LIMITED_UNLISTED', label: 'Public Limited Company (Unlisted)' },
  PUBLIC_LIMITED_LISTED: { ...PUBLIC_LIMITED_CONFIG, entityType: 'PUBLIC_LIMITED_LISTED', label: 'Public Limited Company (Listed)' },
  // ❌ DISABLED - Legacy Public Limited (replaced by UNLISTED/LISTED variants)
  PUBLIC_LIMITED: PUBLIC_LIMITED_CONFIG,

  // ✅ ACTIVE - 8. OPC
  OPC: OPC_CONFIG,

  // ✅ ACTIVE - 9. HUF
  HUF: HUF_CONFIG,

  // ❌ DISABLED - 10-11. Trust Private/Charitable (Phase 2)
  TRUST_PRIVATE: { ...TRUST_CONFIG, entityType: 'TRUST_PRIVATE', label: 'Private Trust' },
  TRUST_CHARITABLE: { ...TRUST_CONFIG, entityType: 'TRUST_CHARITABLE', label: 'Charitable/Public Trust' },
  // ✅ ACTIVE - Generic Trust
  TRUST: TRUST_CONFIG,

  // ✅ ACTIVE - 12. Society
  SOCIETY: SOCIETY_CONFIG,

  // ❌ DISABLED - 13. Cooperative (Phase 2)
  COOPERATIVE: COOPERATIVE_CONFIG,

  // ❌ DISABLED - 14. Section 8 Company (Phase 2)
  SECTION_8: SECTION_8_CONFIG,

  // ❌ DISABLED - 15. Producer Company (Phase 2)
  PRODUCER_COMPANY: PRODUCER_COMPANY_CONFIG,

  // ❌ DISABLED - 16. AOP (Phase 2)
  AOP: AOP_CONFIG,

  // ❌ DISABLED - 17. BOI (Phase 2)
  BOI: BOI_CONFIG,

  // ❌ DISABLED - 18. JV Incorporated (Phase 2)
  JV_INCORPORATED: JV_INCORPORATED_CONFIG,

  // ❌ DISABLED - 19. JV Unincorporated (Phase 2)
  JV_UNINCORPORATED: JV_UNINCORPORATED_CONFIG,

  // ❌ DISABLED - 20. Consortium (Phase 2)
  CONSORTIUM: CONSORTIUM_CONFIG
}

// Helper function to get config for an entity type
export function getEntityFormConfig(entityType: string): EntityFormConfig | null {
  return ENTITY_FORM_CONFIGS[entityType] || null
}

// Helper function to get all entity types
export function getAllEntityTypes(): string[] {
  return Object.keys(ENTITY_FORM_CONFIGS)
}

// Helper function to get entity label
export function getEntityLabel(entityType: string): string {
  return ENTITY_FORM_CONFIGS[entityType]?.label || entityType
}
