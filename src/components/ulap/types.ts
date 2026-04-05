/**
 * ULAP Dynamic Form - Type Definitions
 * Unified Loan Application Platform
 */

// =====================================================
// FIELD TYPES
// =====================================================

export type ULAPFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'pan'
  | 'aadhaar'
  | 'pincode'
  | 'currency'
  | 'percentage'
  | 'file';

export type ULAPFieldSection =
  | 'applicant'
  | 'coapplicant'
  | 'loan'
  | 'other';

export type ULAPLeadSource =
  | 'BA'           // Business Associate
  | 'BP'           // Banking Partner
  | 'DSE'          // Direct Sales Executive
  | 'TELECALLER'   // Tele-sales
  | 'FIELD_SALES'  // Field Sales
  | 'CUSTOMER'     // Customer Direct
  | 'REFERRAL'     // Customer Referral
  | 'WEBSITE'      // Website Lead
  | 'WALK_IN';     // Walk-in Customer

// =====================================================
// DATABASE TYPES (from ulap_profile_fields table)
// =====================================================

export interface ULAPProfileField {
  id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  field_name: string;
  field_label: string;
  field_type: ULAPFieldType;
  field_section: ULAPFieldSection;
  placeholder?: string | null;
  is_required: boolean;
  validation_rules?: ValidationRules | null;
  options?: SelectOption[] | null;
  display_order: number;
  is_active: boolean;
  is_base_field: boolean;
  help_text?: string | null;
  created_at?: string;
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  customValidator?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

// =====================================================
// FORM STATE TYPES
// =====================================================

export interface ULAPFormData {
  [key: string]: unknown;
}

export interface ULAPFormErrors {
  [key: string]: string;
}

export interface ULAPVerificationStatus {
  [key: string]: 'pending' | 'verifying' | 'verified' | 'failed';
}

// =====================================================
// GROUPED FIELDS (API Response)
// =====================================================

export interface ULAPGroupedFields {
  applicant: ULAPProfileField[];
  coapplicant: ULAPProfileField[];
  loan: ULAPProfileField[];
  other: ULAPProfileField[];
}

export interface ULAPProfileFieldsResponse {
  fields: ULAPGroupedFields;
  all: ULAPProfileField[];
}

// =====================================================
// LOAN TYPE CONFIGURATION
// =====================================================

export interface ULAPLoanCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  display_order: number;
  is_active: boolean;
}

export interface ULAPLoanSubcategory {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  min_amount?: number;
  max_amount?: number;
  min_tenure_months?: number;
  max_tenure_months?: number;
  interest_rate_range?: string;
  processing_fee_range?: string;
  is_active: boolean;
  display_order: number;
}

// =====================================================
// COMPONENT PROPS
// =====================================================

export interface ULAPDynamicFormProps {
  /** Lead source - BA, BP, DSE, Customer, etc. */
  source: ULAPLeadSource;
  /** Loan subcategory ID for loading specific fields */
  subcategoryId?: string;
  /** Pre-filled form data (for editing) */
  initialData?: ULAPFormData;
  /** Callback when form is submitted */
  onSubmit: (data: ULAPFormData) => Promise<void>;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Callback when draft is saved */
  onSaveDraft?: (data: ULAPFormData) => Promise<void>;
  /** Whether to show co-applicant section */
  showCoApplicant?: boolean;
  /** Whether form is in read-only mode */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface ULAPFieldRendererProps {
  field: ULAPProfileField;
  value: unknown;
  error?: string;
  verification?: 'pending' | 'verifying' | 'verified' | 'failed';
  onChange: (value: unknown) => void;
  onVerify?: () => void;
  disabled?: boolean;
}

export interface ULAPSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  fields: ULAPProfileField[];
  formData: ULAPFormData;
  errors: ULAPFormErrors;
  verifications: ULAPVerificationStatus;
  onFieldChange: (fieldName: string, value: unknown) => void;
  onVerify?: (fieldName: string) => void;
  disabled?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// =====================================================
// STEP CONFIGURATION
// =====================================================

export interface ULAPFormStep {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  sections: ULAPFieldSection[];
  isOptional?: boolean;
}

export const DEFAULT_FORM_STEPS: ULAPFormStep[] = [
  {
    id: 'applicant',
    title: 'Applicant Details',
    shortTitle: 'Applicant',
    description: 'Basic information about the applicant',
    icon: 'User',
    sections: ['applicant'],
  },
  {
    id: 'loan',
    title: 'Loan Requirements',
    shortTitle: 'Loan',
    description: 'Loan amount, tenure, and purpose',
    icon: 'Currency',
    sections: ['loan'],
  },
  {
    id: 'coapplicant',
    title: 'Co-Applicant Details',
    shortTitle: 'Co-Applicant',
    description: 'Information about co-applicant (if any)',
    icon: 'Users',
    sections: ['coapplicant'],
    isOptional: true,
  },
  {
    id: 'other',
    title: 'Additional Information',
    shortTitle: 'Additional',
    description: 'Other relevant details',
    icon: 'FileText',
    sections: ['other'],
    isOptional: true,
  },
];

// =====================================================
// VALIDATION PATTERNS
// =====================================================

export const VALIDATION_PATTERNS = {
  email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  phone: /^[6-9]\d{9}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  aadhaar: /^\d{12}$/,
  pincode: /^\d{6}$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  accountNumber: /^\d{9,18}$/,
};

export const VALIDATION_MESSAGES = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid 10-digit mobile number',
  pan: 'Please enter a valid PAN (e.g., ABCDE1234F)',
  aadhaar: 'Please enter a valid 12-digit Aadhaar number',
  pincode: 'Please enter a valid 6-digit PIN code',
  gstin: 'Please enter a valid GSTIN',
  minLength: (min: number) => `Minimum ${min} characters required`,
  maxLength: (max: number) => `Maximum ${max} characters allowed`,
  min: (min: number) => `Value must be at least ${min}`,
  max: (max: number) => `Value must not exceed ${max}`,
};

// =====================================================
// SOURCE CONFIGURATION
// =====================================================

export const SOURCE_CONFIG: Record<ULAPLeadSource, {
  name: string;
  color: string;
  icon: string;
  features: string[];
}> = {
  BA: {
    name: 'Business Associate',
    color: 'from-blue-500 to-blue-600',
    icon: 'Building2',
    features: ['commission_tracking', 'payout_management'],
  },
  BP: {
    name: 'Business Partner',
    color: 'from-purple-500 to-purple-600',
    icon: 'Briefcase',
    features: ['commission_tracking', 'payout_management'],
  },
  DSE: {
    name: 'Direct Sales Executive',
    color: 'from-green-500 to-green-600',
    icon: 'UserCircle',
    features: ['incentive_tracking', 'target_management'],
  },
  TELECALLER: {
    name: 'Tele-Sales',
    color: 'from-orange-500 to-orange-600',
    icon: 'Phone',
    features: ['call_logging', 'script_access'],
  },
  FIELD_SALES: {
    name: 'Field Sales',
    color: 'from-teal-500 to-teal-600',
    icon: 'MapPin',
    features: ['location_tracking', 'visit_logging'],
  },
  CUSTOMER: {
    name: 'Customer Direct',
    color: 'from-brand-primary to-orange-500',
    icon: 'User',
    features: ['self_service', 'document_upload'],
  },
  REFERRAL: {
    name: 'Customer Referral',
    color: 'from-pink-500 to-pink-600',
    icon: 'Gift',
    features: ['referral_bonus', 'tracking'],
  },
  WEBSITE: {
    name: 'Website Lead',
    color: 'from-cyan-500 to-cyan-600',
    icon: 'Globe',
    features: ['auto_capture', 'instant_callback'],
  },
  WALK_IN: {
    name: 'Walk-in Customer',
    color: 'from-amber-500 to-amber-600',
    icon: 'Store',
    features: ['instant_processing', 'document_scan'],
  },
};
