/**
 * Employment/Income Category-Specific Fields
 *
 * This file defines the dynamic form fields for each income category
 * used in the Individual customer profile.
 */

// ============================================================================
// TYPES
// ============================================================================

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency' | 'phone' | 'email'

export interface FieldOption {
  value: string
  label: string
}

export interface EmploymentField {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  required: boolean
  validation?: {
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: string
    patternMessage?: string
  }
  options?: FieldOption[]  // For select type
  helpText?: string
  gridCols?: 1 | 2  // 1 = full width, 2 = half width (default)
}

export interface CategoryFields {
  categoryKey: string
  categoryName: string
  fields: EmploymentField[]
}

// ============================================================================
// FIELD DEFINITIONS BY CATEGORY
// ============================================================================

export const EMPLOYMENT_FIELDS: Record<string, CategoryFields> = {
  // =========================================================================
  // SALARIED
  // =========================================================================
  SALARIED: {
    categoryKey: 'SALARIED',
    categoryName: 'Salaried Employee',
    fields: [
      {
        key: 'employer_name',
        label: 'Employer Name',
        type: 'text',
        placeholder: 'Enter company/organization name',
        required: true,
        validation: { minLength: 2, maxLength: 200 }
      },
      {
        key: 'designation',
        label: 'Designation',
        type: 'text',
        placeholder: 'e.g., Senior Manager, Software Engineer',
        required: true,
        validation: { minLength: 2, maxLength: 100 }
      },
      {
        key: 'employee_id',
        label: 'Employee ID',
        type: 'text',
        placeholder: 'Company employee ID',
        required: false,
        validation: { maxLength: 50 }
      },
      {
        key: 'department',
        label: 'Department',
        type: 'text',
        placeholder: 'e.g., Engineering, Sales, HR',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'monthly_salary',
        label: 'Monthly Gross Salary',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 },
        helpText: 'Include all allowances'
      },
      {
        key: 'joining_date',
        label: 'Date of Joining',
        type: 'date',
        required: false,
        helpText: 'When did you join this organization?'
      },
      {
        key: 'official_email',
        label: 'Official Email',
        type: 'email',
        placeholder: 'name@company.com',
        required: false
      },
      {
        key: 'employer_address',
        label: 'Employer Address',
        type: 'textarea',
        placeholder: 'Complete office address',
        required: false,
        gridCols: 1
      }
    ]
  },

  // =========================================================================
  // SELF-EMPLOYED PROFESSIONAL
  // =========================================================================
  SELF_EMPLOYED_PROFESSIONAL: {
    categoryKey: 'SELF_EMPLOYED_PROFESSIONAL',
    categoryName: 'Self-Employed Professional',
    fields: [
      {
        key: 'profession_type',
        label: 'Profession',
        type: 'select',
        required: true,
        options: [
          { value: 'DOCTOR', label: 'Doctor / Medical Professional' },
          { value: 'CA', label: 'Chartered Accountant' },
          { value: 'LAWYER', label: 'Lawyer / Advocate' },
          { value: 'ARCHITECT', label: 'Architect' },
          { value: 'CS', label: 'Company Secretary' },
          { value: 'CWA', label: 'Cost Accountant' },
          { value: 'CONSULTANT', label: 'Consultant / Freelancer' },
          { value: 'ENGINEER', label: 'Consulting Engineer' },
          { value: 'OTHER', label: 'Other Professional' }
        ]
      },
      {
        key: 'license_number',
        label: 'License / Registration Number',
        type: 'text',
        placeholder: 'Professional registration/license number',
        required: true,
        validation: { maxLength: 50 },
        helpText: 'e.g., MCI number for doctors, Bar Council number for lawyers'
      },
      {
        key: 'practice_name',
        label: 'Practice / Firm Name',
        type: 'text',
        placeholder: 'Name of your clinic/office/firm',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'specialization',
        label: 'Specialization',
        type: 'text',
        placeholder: 'e.g., Cardiology, Corporate Law, Taxation',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'years_of_practice',
        label: 'Years of Practice',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 70 }
      },
      {
        key: 'monthly_income',
        label: 'Average Monthly Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 },
        helpText: 'Estimated average monthly professional income'
      },
      {
        key: 'practice_address',
        label: 'Practice Address',
        type: 'textarea',
        placeholder: 'Clinic/Office address',
        required: false,
        gridCols: 1
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number (if applicable)',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      }
    ]
  },

  // =========================================================================
  // SELF-EMPLOYED BUSINESS
  // =========================================================================
  SELF_EMPLOYED_BUSINESS: {
    categoryKey: 'SELF_EMPLOYED_BUSINESS',
    categoryName: 'Self-Employed Business',
    fields: [
      {
        key: 'business_type',
        label: 'Business Type',
        type: 'select',
        required: true,
        options: [
          { value: 'PROPRIETOR', label: 'Proprietorship' },
          { value: 'TRADER', label: 'Trader / Wholesaler' },
          { value: 'MANUFACTURER', label: 'Manufacturer' },
          { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
          { value: 'RETAILER', label: 'Retailer' },
          { value: 'CONTRACTOR', label: 'Contractor' },
          { value: 'TRANSPORTER', label: 'Transporter' },
          { value: 'COMMISSION_AGENT', label: 'Commission Agent' },
          { value: 'OTHER', label: 'Other Business' }
        ]
      },
      {
        key: 'business_name',
        label: 'Business Name',
        type: 'text',
        placeholder: 'Name of your business',
        required: true,
        validation: { minLength: 2, maxLength: 200 }
      },
      {
        key: 'nature_of_business',
        label: 'Nature of Business',
        type: 'text',
        placeholder: 'Describe your business activity',
        required: true,
        validation: { maxLength: 500 }
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      },
      {
        key: 'business_vintage',
        label: 'Business Vintage (Years)',
        type: 'number',
        placeholder: 'How many years in business?',
        required: false,
        validation: { min: 0, max: 100 }
      },
      {
        key: 'annual_turnover',
        label: 'Annual Turnover',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 },
        helpText: 'Approximate annual business turnover'
      },
      {
        key: 'monthly_income',
        label: 'Monthly Net Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 },
        helpText: 'Personal income from business after expenses'
      },
      {
        key: 'shop_establishment_number',
        label: 'Shop & Establishment Number',
        type: 'text',
        placeholder: 'License number (if applicable)',
        required: false
      },
      {
        key: 'business_address',
        label: 'Business Address',
        type: 'textarea',
        placeholder: 'Complete business address',
        required: false,
        gridCols: 1
      }
    ]
  },

  // =========================================================================
  // AGRICULTURE
  // =========================================================================
  AGRICULTURE: {
    categoryKey: 'AGRICULTURE',
    categoryName: 'Agriculture & Allied',
    fields: [
      {
        key: 'farming_type',
        label: 'Type of Farming',
        type: 'select',
        required: true,
        options: [
          { value: 'FARMER_SMALL', label: 'Small Farmer (< 2 hectares)' },
          { value: 'FARMER_MEDIUM', label: 'Medium Farmer (2-10 hectares)' },
          { value: 'FARMER_LARGE', label: 'Large Farmer (> 10 hectares)' },
          { value: 'DAIRY', label: 'Dairy Farming' },
          { value: 'POULTRY', label: 'Poultry Farming' },
          { value: 'FISHERY', label: 'Fishery / Aquaculture' },
          { value: 'HORTICULTURE', label: 'Horticulture / Floriculture' },
          { value: 'AGRI_BUSINESS', label: 'Agri-Business / Processing' }
        ]
      },
      {
        key: 'land_size_acres',
        label: 'Land Size (Acres)',
        type: 'number',
        placeholder: 'Total agricultural land',
        required: true,
        validation: { min: 0.1, max: 10000 }
      },
      {
        key: 'land_location',
        label: 'Land Location (Village/District)',
        type: 'text',
        placeholder: 'Village, Taluk, District',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'crop_type',
        label: 'Primary Crops / Products',
        type: 'text',
        placeholder: 'e.g., Rice, Wheat, Vegetables, Milk',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'irrigation_type',
        label: 'Irrigation Type',
        type: 'select',
        required: false,
        options: [
          { value: 'RAINFED', label: 'Rainfed' },
          { value: 'CANAL', label: 'Canal Irrigation' },
          { value: 'BOREWELL', label: 'Borewell / Tubewell' },
          { value: 'DRIP', label: 'Drip Irrigation' },
          { value: 'SPRINKLER', label: 'Sprinkler System' },
          { value: 'MIXED', label: 'Mixed' }
        ]
      },
      {
        key: 'annual_income',
        label: 'Annual Agricultural Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'kisan_card_number',
        label: 'Kisan Credit Card Number',
        type: 'text',
        placeholder: 'KCC number (if available)',
        required: false
      },
      {
        key: 'land_ownership',
        label: 'Land Ownership',
        type: 'select',
        required: false,
        options: [
          { value: 'OWNED', label: 'Owned' },
          { value: 'LEASED', label: 'Leased' },
          { value: 'INHERITED', label: 'Inherited / Ancestral' },
          { value: 'MIXED', label: 'Mixed (Owned + Leased)' }
        ]
      }
    ]
  },

  // =========================================================================
  // RENTAL INCOME
  // =========================================================================
  RENTAL_INCOME: {
    categoryKey: 'RENTAL_INCOME',
    categoryName: 'Rental Income',
    fields: [
      {
        key: 'property_type',
        label: 'Primary Property Type',
        type: 'select',
        required: true,
        options: [
          { value: 'RESIDENTIAL', label: 'Residential Property' },
          { value: 'COMMERCIAL', label: 'Commercial Property' },
          { value: 'INDUSTRIAL', label: 'Industrial Property' },
          { value: 'MIXED_USE', label: 'Mixed-Use Property' }
        ]
      },
      {
        key: 'number_of_properties',
        label: 'Number of Properties',
        type: 'number',
        placeholder: 'Total properties generating rent',
        required: true,
        validation: { min: 1, max: 100 }
      },
      {
        key: 'monthly_rent',
        label: 'Total Monthly Rental Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 },
        helpText: 'Combined rent from all properties'
      },
      {
        key: 'property_location',
        label: 'Property Location(s)',
        type: 'text',
        placeholder: 'City/Area where properties are located',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'tenant_type',
        label: 'Primary Tenant Type',
        type: 'select',
        required: false,
        options: [
          { value: 'INDIVIDUAL', label: 'Individual / Family' },
          { value: 'CORPORATE', label: 'Corporate / Company' },
          { value: 'GOVERNMENT', label: 'Government' },
          { value: 'MIXED', label: 'Mixed' }
        ]
      },
      {
        key: 'property_value',
        label: 'Estimated Total Property Value',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      }
    ]
  },

  // =========================================================================
  // NRI
  // =========================================================================
  NRI: {
    categoryKey: 'NRI',
    categoryName: 'Non-Resident Indian',
    fields: [
      {
        key: 'nri_type',
        label: 'NRI Category',
        type: 'select',
        required: true,
        options: [
          { value: 'NRI_SALARIED', label: 'NRI - Salaried' },
          { value: 'NRI_BUSINESS', label: 'NRI - Business Owner' },
          { value: 'NRI_PROFESSIONAL', label: 'NRI - Professional' },
          { value: 'PIO_OCI', label: 'PIO / OCI Card Holder' }
        ]
      },
      {
        key: 'country_of_residence',
        label: 'Country of Residence',
        type: 'text',
        placeholder: 'e.g., USA, UAE, UK',
        required: true,
        validation: { maxLength: 100 }
      },
      {
        key: 'city_abroad',
        label: 'City of Residence',
        type: 'text',
        placeholder: 'e.g., Dubai, New York, London',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'employer_abroad',
        label: 'Employer / Business Name',
        type: 'text',
        placeholder: 'Company/Business name abroad',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'designation_abroad',
        label: 'Designation / Role',
        type: 'text',
        placeholder: 'Your job title or business role',
        required: false
      },
      {
        key: 'visa_type',
        label: 'Visa Type',
        type: 'select',
        required: false,
        options: [
          { value: 'WORK', label: 'Work Visa / Employment' },
          { value: 'BUSINESS', label: 'Business Visa' },
          { value: 'PR', label: 'Permanent Resident' },
          { value: 'CITIZEN', label: 'Foreign Citizen' },
          { value: 'STUDENT', label: 'Student Visa' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'monthly_income_foreign',
        label: 'Monthly Income (in Foreign Currency)',
        type: 'number',
        placeholder: 'Amount in local currency',
        required: false,
        helpText: 'Income in country of residence'
      },
      {
        key: 'income_currency',
        label: 'Income Currency',
        type: 'select',
        required: false,
        options: [
          { value: 'USD', label: 'US Dollar (USD)' },
          { value: 'AED', label: 'UAE Dirham (AED)' },
          { value: 'GBP', label: 'British Pound (GBP)' },
          { value: 'EUR', label: 'Euro (EUR)' },
          { value: 'SGD', label: 'Singapore Dollar (SGD)' },
          { value: 'CAD', label: 'Canadian Dollar (CAD)' },
          { value: 'AUD', label: 'Australian Dollar (AUD)' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'nre_nro_account',
        label: 'NRE/NRO Account',
        type: 'select',
        required: false,
        options: [
          { value: 'NRE', label: 'NRE Account' },
          { value: 'NRO', label: 'NRO Account' },
          { value: 'BOTH', label: 'Both NRE & NRO' },
          { value: 'NONE', label: 'None' }
        ]
      },
      {
        key: 'years_abroad',
        label: 'Years Living Abroad',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 70 }
      }
    ]
  },

  // =========================================================================
  // PENSIONER
  // =========================================================================
  PENSIONER: {
    categoryKey: 'PENSIONER',
    categoryName: 'Pensioner',
    fields: [
      {
        key: 'pension_type',
        label: 'Pension Type',
        type: 'select',
        required: true,
        options: [
          { value: 'GOVT_PENSIONER', label: 'Government Pensioner' },
          { value: 'PSU_PENSIONER', label: 'PSU Pensioner' },
          { value: 'DEFENCE_PENSIONER', label: 'Defence Pensioner' },
          { value: 'FAMILY_PENSION', label: 'Family Pension Recipient' },
          { value: 'PRIVATE_PENSION', label: 'Private Pension / Annuity' }
        ]
      },
      {
        key: 'ppo_number',
        label: 'PPO Number',
        type: 'text',
        placeholder: 'Pension Payment Order number',
        required: false,
        validation: { maxLength: 50 },
        helpText: 'For government/defence pensioners'
      },
      {
        key: 'monthly_pension',
        label: 'Monthly Pension',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'last_employer',
        label: 'Last Employer / Department',
        type: 'text',
        placeholder: 'Organization you retired from',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'last_designation',
        label: 'Last Designation',
        type: 'text',
        placeholder: 'Designation at time of retirement',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'retirement_date',
        label: 'Date of Retirement',
        type: 'date',
        required: false
      },
      {
        key: 'pension_bank',
        label: 'Pension Disbursing Bank',
        type: 'text',
        placeholder: 'Bank where pension is credited',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'other_income',
        label: 'Other Monthly Income (if any)',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 },
        helpText: 'Rental, interest, or other income'
      }
    ]
  },

  // =========================================================================
  // INDIVIDUAL (no income / basic)
  // =========================================================================
  INDIVIDUAL: {
    categoryKey: 'INDIVIDUAL',
    categoryName: 'Individual',
    fields: [
      {
        key: 'source_of_funds',
        label: 'Source of Funds',
        type: 'select',
        required: false,
        options: [
          { value: 'SAVINGS', label: 'Savings' },
          { value: 'FAMILY_SUPPORT', label: 'Family Support' },
          { value: 'INHERITANCE', label: 'Inheritance' },
          { value: 'INVESTMENTS', label: 'Investments' },
          { value: 'SPOUSE_INCOME', label: 'Spouse Income' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'guardian_name',
        label: 'Guardian / Sponsor Name',
        type: 'text',
        placeholder: 'Name of guardian or financial sponsor',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'guardian_relationship',
        label: 'Guardian Relationship',
        type: 'select',
        required: false,
        options: [
          { value: 'FATHER', label: 'Father' },
          { value: 'MOTHER', label: 'Mother' },
          { value: 'SPOUSE', label: 'Spouse' },
          { value: 'SIBLING', label: 'Sibling' },
          { value: 'RELATIVE', label: 'Relative' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'dependents_count',
        label: 'Number of Dependents',
        type: 'number',
        placeholder: 'Number of people depending on you',
        required: false,
        validation: { min: 0, max: 20 }
      },
      {
        key: 'monthly_expenses',
        label: 'Monthly Household Expenses',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      }
    ]
  },

  // =========================================================================
  // STUDENT
  // =========================================================================
  STUDENT: {
    categoryKey: 'STUDENT',
    categoryName: 'Student',
    fields: [
      {
        key: 'course_name',
        label: 'Course Name',
        type: 'text',
        placeholder: 'e.g., B.Tech, MBA, MBBS',
        required: true,
        validation: { minLength: 2, maxLength: 200 }
      },
      {
        key: 'institution_name',
        label: 'Institution / University',
        type: 'text',
        placeholder: 'Name of college or university',
        required: true,
        validation: { minLength: 2, maxLength: 300 }
      },
      {
        key: 'course_type',
        label: 'Course Type',
        type: 'select',
        required: true,
        options: [
          { value: 'UG', label: 'Undergraduate (UG)' },
          { value: 'PG', label: 'Postgraduate (PG)' },
          { value: 'PHD', label: 'Ph.D / Doctoral' },
          { value: 'DIPLOMA', label: 'Diploma' },
          { value: 'CERTIFICATE', label: 'Certificate Course' },
          { value: 'PROFESSIONAL', label: 'Professional Degree (CA/CS/Law/Medical)' }
        ]
      },
      {
        key: 'study_country',
        label: 'Country of Study',
        type: 'text',
        placeholder: 'e.g., India, USA, UK',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'admission_year',
        label: 'Admission Year',
        type: 'number',
        placeholder: 'e.g., 2024',
        required: false,
        validation: { min: 2000, max: 2030 }
      },
      {
        key: 'expected_completion',
        label: 'Expected Completion Year',
        type: 'number',
        placeholder: 'e.g., 2028',
        required: false,
        validation: { min: 2000, max: 2035 }
      },
      {
        key: 'course_fee_annual',
        label: 'Annual Course Fee',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'scholarship_amount',
        label: 'Scholarship Amount (if any)',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'co_applicant_name',
        label: 'Co-Applicant / Guardian Name',
        type: 'text',
        placeholder: 'Parent or guardian name for loan co-signing',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'co_applicant_relation',
        label: 'Co-Applicant Relationship',
        type: 'select',
        required: false,
        options: [
          { value: 'FATHER', label: 'Father' },
          { value: 'MOTHER', label: 'Mother' },
          { value: 'SPOUSE', label: 'Spouse' },
          { value: 'SIBLING', label: 'Sibling' },
          { value: 'GUARDIAN', label: 'Guardian' }
        ]
      },
      {
        key: 'co_applicant_income',
        label: 'Co-Applicant Monthly Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      }
    ]
  },

  // =========================================================================
  // RETIRED
  // =========================================================================
  RETIRED: {
    categoryKey: 'RETIRED',
    categoryName: 'Retired',
    fields: [
      {
        key: 'last_employer',
        label: 'Last Employer / Organization',
        type: 'text',
        placeholder: 'Organization you retired from',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'last_designation',
        label: 'Last Designation',
        type: 'text',
        placeholder: 'Designation at time of retirement',
        required: false,
        validation: { maxLength: 100 }
      },
      {
        key: 'retirement_date',
        label: 'Date of Retirement',
        type: 'date',
        required: true
      },
      {
        key: 'retirement_type',
        label: 'Retirement Type',
        type: 'select',
        required: false,
        options: [
          { value: 'SUPERANNUATION', label: 'Superannuation' },
          { value: 'VRS', label: 'Voluntary Retirement (VRS)' },
          { value: 'MEDICAL', label: 'Medical Retirement' },
          { value: 'EARLY', label: 'Early Retirement' }
        ]
      },
      {
        key: 'gratuity_received',
        label: 'Gratuity Received',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'pf_balance',
        label: 'PF Balance',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'monthly_investment_income',
        label: 'Monthly Investment Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 },
        helpText: 'Income from FD, mutual funds, rent, etc.'
      },
      {
        key: 'has_medical_insurance',
        label: 'Medical Insurance',
        type: 'select',
        required: false,
        options: [
          { value: 'YES', label: 'Yes' },
          { value: 'NO', label: 'No' }
        ]
      }
    ]
  },

  // =========================================================================
  // WOMEN
  // =========================================================================
  WOMEN: {
    categoryKey: 'WOMEN',
    categoryName: 'Women',
    fields: [
      {
        key: 'women_category',
        label: 'Women Category',
        type: 'select',
        required: true,
        options: [
          { value: 'ENTREPRENEUR', label: 'Women Entrepreneur' },
          { value: 'PROFESSIONAL', label: 'Working Professional' },
          { value: 'SHG_MEMBER', label: 'SHG Member' },
          { value: 'HOMEMAKER', label: 'Homemaker' },
          { value: 'ARTISAN', label: 'Artisan / Craftsperson' }
        ]
      },
      {
        key: 'shg_name',
        label: 'SHG Name (if applicable)',
        type: 'text',
        placeholder: 'Self-Help Group name',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'shg_registration',
        label: 'SHG Registration Number',
        type: 'text',
        placeholder: 'Registration / membership number',
        required: false,
        validation: { maxLength: 50 }
      },
      {
        key: 'annual_income',
        label: 'Annual Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'scheme_applied',
        label: 'Government Scheme Applied',
        type: 'select',
        required: false,
        options: [
          { value: 'MUDRA', label: 'Mudra Yojana' },
          { value: 'PMMY', label: 'PM Mudra Yojana' },
          { value: 'STAND_UP', label: 'Stand-Up India' },
          { value: 'NRLM', label: 'NRLM / DAY-NRLM' },
          { value: 'PMJDY', label: 'PM Jan Dhan Yojana' },
          { value: 'NONE', label: 'None' }
        ]
      },
      {
        key: 'number_of_dependents',
        label: 'Number of Dependents',
        type: 'number',
        placeholder: 'Number of family members dependent',
        required: false,
        validation: { min: 0, max: 20 }
      },
      {
        key: 'business_description',
        label: 'Business / Activity Description',
        type: 'textarea',
        placeholder: 'Describe your business or income-generating activity',
        required: false,
        validation: { maxLength: 500 },
        gridCols: 1
      }
    ]
  },

  // =========================================================================
  // GIG ECONOMY
  // =========================================================================
  GIG_ECONOMY: {
    categoryKey: 'GIG_ECONOMY',
    categoryName: 'Gig Economy / Freelancer',
    fields: [
      {
        key: 'gig_type',
        label: 'Gig / Freelance Type',
        type: 'select',
        required: true,
        options: [
          { value: 'FREELANCER', label: 'Freelancer' },
          { value: 'DELIVERY', label: 'Delivery Partner' },
          { value: 'RIDE_HAILING', label: 'Ride-Hailing Driver' },
          { value: 'CONTENT_CREATOR', label: 'Content Creator' },
          { value: 'CONSULTANT', label: 'Independent Consultant' },
          { value: 'TUTOR', label: 'Online Tutor' },
          { value: 'OTHER', label: 'Other Gig Worker' }
        ]
      },
      {
        key: 'platform_name',
        label: 'Primary Platform(s)',
        type: 'text',
        placeholder: 'e.g., Swiggy, Uber, Upwork, Fiverr',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'primary_skill',
        label: 'Primary Skill / Service',
        type: 'text',
        placeholder: 'e.g., Web Development, Graphic Design',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'monthly_earnings',
        label: 'Average Monthly Earnings',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'years_in_gig',
        label: 'Years in Gig Work',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 50 }
      },
      {
        key: 'client_count',
        label: 'Active Clients / Orders per Month',
        type: 'number',
        placeholder: 'Average monthly clients',
        required: false,
        validation: { min: 0, max: 10000 }
      },
      {
        key: 'has_gst',
        label: 'GST Registered',
        type: 'select',
        required: false,
        options: [
          { value: 'YES', label: 'Yes' },
          { value: 'NO', label: 'No' }
        ]
      },
      {
        key: 'portfolio_url',
        label: 'Portfolio / Profile URL',
        type: 'text',
        placeholder: 'https://your-portfolio.com',
        required: false,
        validation: { maxLength: 500 }
      }
    ]
  },

  // =========================================================================
  // MANUFACTURER
  // =========================================================================
  MANUFACTURER: {
    categoryKey: 'MANUFACTURER',
    categoryName: 'Manufacturer',
    fields: [
      {
        key: 'product_type',
        label: 'Product / Manufacturing Type',
        type: 'text',
        placeholder: 'e.g., Textiles, Electronics, Food Processing',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'manufacturing_scale',
        label: 'Manufacturing Scale',
        type: 'select',
        required: true,
        options: [
          { value: 'MICRO', label: 'Micro (< Rs.1 Cr)' },
          { value: 'SMALL', label: 'Small (Rs.1-10 Cr)' },
          { value: 'MEDIUM', label: 'Medium (Rs.10-50 Cr)' },
          { value: 'LARGE', label: 'Large (> Rs.50 Cr)' }
        ]
      },
      {
        key: 'factory_address',
        label: 'Factory / Manufacturing Address',
        type: 'textarea',
        placeholder: 'Complete factory address',
        required: false,
        gridCols: 1
      },
      {
        key: 'annual_production_value',
        label: 'Annual Production Value',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'number_of_workers',
        label: 'Number of Workers',
        type: 'number',
        placeholder: 'Total workforce',
        required: false,
        validation: { min: 0, max: 100000 }
      },
      {
        key: 'udyam_number',
        label: 'Udyam Registration Number',
        type: 'text',
        placeholder: 'UDYAM-XX-XX-XXXXXXX',
        required: false,
        validation: { maxLength: 30 }
      },
      {
        key: 'pollution_clearance',
        label: 'Pollution Clearance',
        type: 'select',
        required: false,
        options: [
          { value: 'YES', label: 'Yes - Valid' },
          { value: 'EXPIRED', label: 'Expired' },
          { value: 'NOT_REQUIRED', label: 'Not Required' },
          { value: 'NO', label: 'No' }
        ]
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      }
    ]
  },

  // =========================================================================
  // TRADER
  // =========================================================================
  TRADER: {
    categoryKey: 'TRADER',
    categoryName: 'Trader',
    fields: [
      {
        key: 'trade_type',
        label: 'Trade Type',
        type: 'select',
        required: true,
        options: [
          { value: 'RETAIL', label: 'Retail' },
          { value: 'WHOLESALE', label: 'Wholesale' },
          { value: 'DISTRIBUTOR', label: 'Distributor' },
          { value: 'IMPORT_EXPORT', label: 'Import / Export' },
          { value: 'COMMISSION_AGENT', label: 'Commission Agent' },
          { value: 'E_COMMERCE', label: 'E-Commerce Seller' }
        ]
      },
      {
        key: 'shop_address',
        label: 'Shop / Business Address',
        type: 'textarea',
        placeholder: 'Complete business address',
        required: false,
        gridCols: 1
      },
      {
        key: 'annual_turnover',
        label: 'Annual Turnover',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      },
      {
        key: 'fssai_number',
        label: 'FSSAI License Number',
        type: 'text',
        placeholder: 'For food business (if applicable)',
        required: false,
        validation: { maxLength: 20 },
        helpText: 'Required for food trading'
      },
      {
        key: 'drug_license',
        label: 'Drug License Number',
        type: 'text',
        placeholder: 'For pharma trade (if applicable)',
        required: false,
        validation: { maxLength: 30 }
      },
      {
        key: 'years_in_business',
        label: 'Years in Business',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 100 }
      },
      {
        key: 'monthly_income',
        label: 'Monthly Net Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      }
    ]
  },

  // =========================================================================
  // SERVICE (Business)
  // =========================================================================
  SERVICE: {
    categoryKey: 'SERVICE',
    categoryName: 'Service Provider',
    fields: [
      {
        key: 'service_type',
        label: 'Service Type',
        type: 'text',
        placeholder: 'e.g., IT Services, Consulting, Transport',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'service_address',
        label: 'Service / Office Address',
        type: 'textarea',
        placeholder: 'Complete business address',
        required: false,
        gridCols: 1
      },
      {
        key: 'annual_revenue',
        label: 'Annual Revenue',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'number_of_employees',
        label: 'Number of Employees',
        type: 'number',
        placeholder: 'Total staff',
        required: false,
        validation: { min: 0, max: 100000 }
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      },
      {
        key: 'professional_license',
        label: 'Professional / Business License',
        type: 'text',
        placeholder: 'License number (if applicable)',
        required: false,
        validation: { maxLength: 50 }
      },
      {
        key: 'years_in_business',
        label: 'Years in Business',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 100 }
      }
    ]
  },

  // =========================================================================
  // STARTUP
  // =========================================================================
  STARTUP: {
    categoryKey: 'STARTUP',
    categoryName: 'Startup',
    fields: [
      {
        key: 'startup_name',
        label: 'Startup Name',
        type: 'text',
        placeholder: 'Name of your startup',
        required: true,
        validation: { minLength: 2, maxLength: 200 }
      },
      {
        key: 'dpiit_number',
        label: 'DPIIT Recognition Number',
        type: 'text',
        placeholder: 'DPIIT certificate number',
        required: false,
        validation: { maxLength: 50 },
        helpText: 'Department for Promotion of Industry and Internal Trade'
      },
      {
        key: 'sector',
        label: 'Sector / Industry',
        type: 'text',
        placeholder: 'e.g., FinTech, HealthTech, EdTech',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'funding_stage',
        label: 'Funding Stage',
        type: 'select',
        required: true,
        options: [
          { value: 'BOOTSTRAPPED', label: 'Bootstrapped' },
          { value: 'PRE_SEED', label: 'Pre-Seed' },
          { value: 'SEED', label: 'Seed' },
          { value: 'SERIES_A', label: 'Series A' },
          { value: 'SERIES_B', label: 'Series B+' },
          { value: 'PROFITABLE', label: 'Profitable' }
        ]
      },
      {
        key: 'annual_revenue',
        label: 'Annual Revenue',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'burn_rate',
        label: 'Monthly Burn Rate',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'team_size',
        label: 'Team Size',
        type: 'number',
        placeholder: 'Number of team members',
        required: false,
        validation: { min: 1, max: 10000 }
      },
      {
        key: 'incorporation_date',
        label: 'Date of Incorporation',
        type: 'date',
        required: false
      }
    ]
  },

  // =========================================================================
  // REAL ESTATE
  // =========================================================================
  REAL_ESTATE: {
    categoryKey: 'REAL_ESTATE',
    categoryName: 'Real Estate',
    fields: [
      {
        key: 'business_type',
        label: 'Real Estate Business Type',
        type: 'select',
        required: true,
        options: [
          { value: 'DEVELOPER', label: 'Developer / Builder' },
          { value: 'CONTRACTOR', label: 'Contractor' },
          { value: 'BROKER', label: 'Broker / Agent' },
          { value: 'INVESTOR', label: 'Property Investor' },
          { value: 'INTERIOR', label: 'Interior Designer' }
        ]
      },
      {
        key: 'rera_number',
        label: 'RERA Registration Number',
        type: 'text',
        placeholder: 'RERA registration number',
        required: false,
        validation: { maxLength: 50 }
      },
      {
        key: 'projects_completed',
        label: 'Projects Completed',
        type: 'number',
        placeholder: 'Number of projects completed',
        required: false,
        validation: { min: 0, max: 10000 }
      },
      {
        key: 'current_projects',
        label: 'Current Active Projects',
        type: 'number',
        placeholder: 'Number of ongoing projects',
        required: false,
        validation: { min: 0, max: 1000 }
      },
      {
        key: 'annual_turnover',
        label: 'Annual Turnover',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'years_in_business',
        label: 'Years in Real Estate',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 100 }
      }
    ]
  },

  // =========================================================================
  // MICRO ENTERPRISE
  // =========================================================================
  MICRO_ENTERPRISE: {
    categoryKey: 'MICRO_ENTERPRISE',
    categoryName: 'Micro Enterprise',
    fields: [
      {
        key: 'business_type',
        label: 'Micro Enterprise Type',
        type: 'text',
        placeholder: 'e.g., Street Vending, Tea Stall, Tailoring',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'daily_income',
        label: 'Average Daily Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'location_type',
        label: 'Business Location Type',
        type: 'select',
        required: false,
        options: [
          { value: 'FIXED', label: 'Fixed Location' },
          { value: 'MOBILE', label: 'Mobile / Moving' },
          { value: 'HOME_BASED', label: 'Home Based' }
        ]
      },
      {
        key: 'svanidhi_id',
        label: 'PM SVANidhi ID',
        type: 'text',
        placeholder: 'SVANidhi vendor ID (if applicable)',
        required: false,
        validation: { maxLength: 30 },
        helpText: 'For street vendors availing PM SVANidhi scheme'
      },
      {
        key: 'udyam_number',
        label: 'Udyam Registration Number',
        type: 'text',
        placeholder: 'UDYAM-XX-XX-XXXXXXX',
        required: false,
        validation: { maxLength: 30 }
      },
      {
        key: 'years_in_business',
        label: 'Years in Business',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 100 }
      },
      {
        key: 'monthly_expenses',
        label: 'Monthly Business Expenses',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      }
    ]
  },

  // =========================================================================
  // ARTISAN / CRAFTSMEN
  // =========================================================================
  ARTISAN_CRAFTSMEN: {
    categoryKey: 'ARTISAN_CRAFTSMEN',
    categoryName: 'Artisan / Craftsmen',
    fields: [
      {
        key: 'craft_type',
        label: 'Craft / Art Type',
        type: 'text',
        placeholder: 'e.g., Weaving, Pottery, Woodcarving',
        required: true,
        validation: { maxLength: 200 }
      },
      {
        key: 'artisan_card_number',
        label: 'Artisan Card Number',
        type: 'text',
        placeholder: 'Artisan identity card number',
        required: false,
        validation: { maxLength: 30 }
      },
      {
        key: 'raw_material',
        label: 'Primary Raw Material',
        type: 'text',
        placeholder: 'e.g., Silk, Clay, Wood, Metal',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'monthly_production_value',
        label: 'Monthly Production Value',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'market_type',
        label: 'Primary Market',
        type: 'select',
        required: false,
        options: [
          { value: 'LOCAL', label: 'Local Market' },
          { value: 'DOMESTIC', label: 'Domestic (Pan-India)' },
          { value: 'EXPORT', label: 'Export' },
          { value: 'ONLINE', label: 'Online (E-Commerce)' },
          { value: 'MIXED', label: 'Mixed' }
        ]
      },
      {
        key: 'cooperative_member',
        label: 'Cooperative / Society Member',
        type: 'select',
        required: false,
        options: [
          { value: 'YES', label: 'Yes' },
          { value: 'NO', label: 'No' }
        ]
      },
      {
        key: 'years_of_experience',
        label: 'Years of Experience',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 80 }
      }
    ]
  },

  // =========================================================================
  // AGENT / DSA
  // =========================================================================
  AGENT: {
    categoryKey: 'AGENT',
    categoryName: 'Agent / DSA',
    fields: [
      {
        key: 'agency_type',
        label: 'Agency Type',
        type: 'select',
        required: true,
        options: [
          { value: 'INSURANCE', label: 'Insurance Agent' },
          { value: 'MUTUAL_FUND', label: 'Mutual Fund Distributor' },
          { value: 'DSA', label: 'DSA (Direct Selling Agent)' },
          { value: 'COMMISSION', label: 'Commission Agent' },
          { value: 'REAL_ESTATE', label: 'Real Estate Agent' },
          { value: 'TRAVEL', label: 'Travel Agent' },
          { value: 'OTHER', label: 'Other Agent' }
        ]
      },
      {
        key: 'license_number',
        label: 'License / Registration Number',
        type: 'text',
        placeholder: 'Agent license or registration number',
        required: false,
        validation: { maxLength: 50 }
      },
      {
        key: 'issuing_authority',
        label: 'Issuing Authority',
        type: 'text',
        placeholder: 'e.g., IRDA, AMFI, Bank Name',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'principal_companies',
        label: 'Principal Companies',
        type: 'text',
        placeholder: 'Companies you represent (comma separated)',
        required: false,
        validation: { maxLength: 500 }
      },
      {
        key: 'monthly_commission',
        label: 'Average Monthly Commission',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'years_as_agent',
        label: 'Years as Agent',
        type: 'number',
        placeholder: 'Number of years',
        required: false,
        validation: { min: 0, max: 70 }
      },
      {
        key: 'gst_number',
        label: 'GST Number',
        type: 'text',
        placeholder: '15-digit GST number (if applicable)',
        required: false,
        validation: { pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$', patternMessage: 'Invalid GST format' }
      }
    ]
  },

  // =========================================================================
  // INSTITUTIONAL
  // =========================================================================
  INSTITUTIONAL: {
    categoryKey: 'INSTITUTIONAL',
    categoryName: 'Institutional',
    fields: [
      {
        key: 'institution_type',
        label: 'Institution Type',
        type: 'select',
        required: true,
        options: [
          { value: 'TRUST', label: 'Trust' },
          { value: 'SOCIETY', label: 'Society' },
          { value: 'COOPERATIVE', label: 'Cooperative' },
          { value: 'NGO', label: 'NGO' },
          { value: 'EDUCATIONAL', label: 'Educational Institution' },
          { value: 'RELIGIOUS', label: 'Religious Institution' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'registration_number',
        label: 'Registration Number',
        type: 'text',
        placeholder: 'Institution registration number',
        required: true,
        validation: { maxLength: 50 }
      },
      {
        key: 'registration_authority',
        label: 'Registration Authority',
        type: 'text',
        placeholder: 'e.g., Charity Commissioner, RoS',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'annual_budget',
        label: 'Annual Budget / Corpus',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'number_of_beneficiaries',
        label: 'Number of Beneficiaries',
        type: 'number',
        placeholder: 'Approximate beneficiaries',
        required: false,
        validation: { min: 0, max: 10000000 }
      },
      {
        key: 'funding_sources',
        label: 'Funding Sources',
        type: 'textarea',
        placeholder: 'Describe primary funding sources (grants, donations, fees)',
        required: false,
        validation: { maxLength: 500 },
        gridCols: 1
      }
    ]
  },

  // =========================================================================
  // SPECIAL CATEGORY
  // =========================================================================
  SPECIAL: {
    categoryKey: 'SPECIAL',
    categoryName: 'Special Category',
    fields: [
      {
        key: 'special_category',
        label: 'Special Category',
        type: 'select',
        required: true,
        options: [
          { value: 'SC_ST', label: 'SC/ST' },
          { value: 'OBC', label: 'OBC' },
          { value: 'EWS', label: 'Economically Weaker Section' },
          { value: 'MINORITY', label: 'Minority' },
          { value: 'DIFFERENTLY_ABLED', label: 'Differently Abled' },
          { value: 'EX_SERVICEMEN', label: 'Ex-Servicemen' },
          { value: 'SENIOR_CITIZEN', label: 'Senior Citizen' },
          { value: 'OTHER', label: 'Other Special Category' }
        ]
      },
      {
        key: 'certificate_number',
        label: 'Certificate Number',
        type: 'text',
        placeholder: 'Category certificate number',
        required: false,
        validation: { maxLength: 50 },
        helpText: 'Caste / disability / EWS certificate number'
      },
      {
        key: 'issuing_authority',
        label: 'Certificate Issuing Authority',
        type: 'text',
        placeholder: 'Authority that issued the certificate',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'monthly_income_source',
        label: 'Primary Income Source',
        type: 'text',
        placeholder: 'Describe your primary income source',
        required: false,
        validation: { maxLength: 200 }
      },
      {
        key: 'income_amount',
        label: 'Monthly Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: false,
        validation: { min: 0 }
      },
      {
        key: 'government_scheme',
        label: 'Government Scheme Availing',
        type: 'text',
        placeholder: 'e.g., Stand-Up India, PMEGP, MUDRA',
        required: false,
        validation: { maxLength: 200 }
      }
    ]
  },

  // =========================================================================
  // OTHER
  // =========================================================================
  OTHER: {
    categoryKey: 'OTHER',
    categoryName: 'Other Income Sources',
    fields: [
      {
        key: 'income_type',
        label: 'Primary Income Type',
        type: 'select',
        required: true,
        options: [
          { value: 'HOMEMAKER', label: 'Homemaker with Income' },
          { value: 'STUDENT', label: 'Student with Income' },
          { value: 'FREELANCER', label: 'Freelancer / Gig Worker' },
          { value: 'INVESTOR', label: 'Investor / Dividend Income' },
          { value: 'ROYALTY_INCOME', label: 'Royalty / IP Income' },
          { value: 'OTHER', label: 'Other' }
        ]
      },
      {
        key: 'income_source',
        label: 'Income Source Description',
        type: 'textarea',
        placeholder: 'Describe your income source',
        required: true,
        validation: { minLength: 10, maxLength: 500 },
        gridCols: 1
      },
      {
        key: 'monthly_income',
        label: 'Monthly Income',
        type: 'currency',
        placeholder: 'Enter amount in INR',
        required: true,
        validation: { min: 0 }
      },
      {
        key: 'income_frequency',
        label: 'Income Frequency',
        type: 'select',
        required: false,
        options: [
          { value: 'REGULAR', label: 'Regular (Monthly)' },
          { value: 'QUARTERLY', label: 'Quarterly' },
          { value: 'ANNUAL', label: 'Annual' },
          { value: 'IRREGULAR', label: 'Irregular' }
        ]
      },
      {
        key: 'supporting_documents',
        label: 'Available Supporting Documents',
        type: 'text',
        placeholder: 'e.g., Bank statements, ITR, Investment proofs',
        required: false,
        validation: { maxLength: 500 }
      }
    ]
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get fields for a specific category
 */
export const getFieldsForCategory = (categoryKey: string): EmploymentField[] => {
  return EMPLOYMENT_FIELDS[categoryKey]?.fields || []
}

/**
 * Get category info
 */
export const getCategoryInfo = (categoryKey: string): CategoryFields | undefined => {
  return EMPLOYMENT_FIELDS[categoryKey]
}

/**
 * Get all categories
 */
export const getAllCategories = (): CategoryFields[] => {
  return Object.values(EMPLOYMENT_FIELDS)
}

/**
 * Get required fields for a category
 */
export const getRequiredFields = (categoryKey: string): EmploymentField[] => {
  return getFieldsForCategory(categoryKey).filter(field => field.required)
}

/**
 * Validate employment data against category fields
 */
export const validateEmploymentData = (
  categoryKey: string,
  data: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } => {
  const fields = getFieldsForCategory(categoryKey)
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const value = data[field.key]

    // Check required
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.key] = `${field.label} is required`
      continue
    }

    // Skip validation if empty and not required
    if (value === undefined || value === null || value === '') continue

    // Type-specific validation
    if (field.validation) {
      if (field.validation.minLength && typeof value === 'string' && value.length < field.validation.minLength) {
        errors[field.key] = `${field.label} must be at least ${field.validation.minLength} characters`
      }
      if (field.validation.maxLength && typeof value === 'string' && value.length > field.validation.maxLength) {
        errors[field.key] = `${field.label} must be at most ${field.validation.maxLength} characters`
      }
      if (field.validation.min !== undefined && typeof value === 'number' && value < field.validation.min) {
        errors[field.key] = `${field.label} must be at least ${field.validation.min}`
      }
      if (field.validation.max !== undefined && typeof value === 'number' && value > field.validation.max) {
        errors[field.key] = `${field.label} must be at most ${field.validation.max}`
      }
      if (field.validation.pattern && typeof value === 'string') {
        const regex = new RegExp(field.validation.pattern)
        if (!regex.test(value)) {
          errors[field.key] = field.validation.patternMessage || `${field.label} has invalid format`
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Get empty employment data template for a category
 */
export const getEmptyEmploymentData = (categoryKey: string): Record<string, unknown> => {
  const fields = getFieldsForCategory(categoryKey)
  const data: Record<string, unknown> = {}

  for (const field of fields) {
    switch (field.type) {
      case 'number':
      case 'currency':
        data[field.key] = null
        break
      case 'select':
        data[field.key] = ''
        break
      default:
        data[field.key] = ''
    }
  }

  return data
}

// ============================================================================
// CATEGORY KEY MAPPING
// Maps frontend subrole keys (from customer-subroles.ts) to employment-fields keys
// ============================================================================

export const CATEGORY_TO_EMPLOYMENT_KEY: Record<string, string> = {
  'INDIVIDUAL': 'INDIVIDUAL',
  'SALARIED': 'SALARIED',
  'PROFESSIONAL': 'SELF_EMPLOYED_PROFESSIONAL',
  'SERVICE': 'SERVICE',
  'MANUFACTURER': 'MANUFACTURER',
  'TRADER': 'TRADER',
  'AGRICULTURE': 'AGRICULTURE',
  'PENSIONER': 'PENSIONER',
  'RETIRED': 'RETIRED',
  'NRI': 'NRI',
  'WOMEN': 'WOMEN',
  'STUDENT': 'STUDENT',
  'GIG_ECONOMY': 'GIG_ECONOMY',
  'INSTITUTIONAL': 'INSTITUTIONAL',
  'SPECIAL': 'SPECIAL',
  'STARTUP': 'STARTUP',
  'REAL_ESTATE': 'REAL_ESTATE',
  'MICRO_ENTERPRISE': 'MICRO_ENTERPRISE',
  'ARTISAN_CRAFTSMEN': 'ARTISAN_CRAFTSMEN',
  'AGENT': 'AGENT',
}

/**
 * Resolve a subrole key to the correct employment fields key
 */
export const resolveEmploymentKey = (categoryKey: string): string => {
  return CATEGORY_TO_EMPLOYMENT_KEY[categoryKey] || categoryKey
}
