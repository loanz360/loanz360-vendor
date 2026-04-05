/**
 * Loan Application Module - Type Definitions
 * Premium Design System Types
 */

// =====================================================
// LOAN TYPE DEFINITIONS
// =====================================================

export type LoanCategory =
  | 'CONSUMER'
  | 'BUSINESS'
  | 'PROPERTY'
  | 'PROFESSIONAL'
  | 'NRI';

export type LoanTypeCode =
  // Consumer Loans
  | 'PERSONAL_LOAN'
  | 'HOME_LOAN'
  | 'NEW_CAR_LOAN'
  | 'USED_CAR_LOAN'
  | 'BUSINESS_LOAN'
  | 'EDUCATION_LOAN'
  | 'LAP'
  | 'GOLD_LOAN'
  | 'CREDIT_CARD'
  // Business & Working Capital
  | 'WORKING_CAPITAL'
  | 'MACHINERY_LOAN'
  | 'BILL_DISCOUNTING'
  | 'OVERDRAFT'
  | 'CASH_CREDIT'
  // Property & Asset-Backed
  | 'MORTGAGE_LOAN'
  | 'LOAN_AGAINST_SHARES'
  | 'LEASE_RENTAL_DISCOUNTING'
  | 'REFINANCE'
  | 'BALANCE_TRANSFER'
  | 'TOPUP_VEHICLE_LOAN'
  // Professional-Specific
  | 'LOAN_TO_DOCTORS'
  | 'LOAN_TO_HOSPITALS'
  | 'LOAN_TO_EDUCATIONAL_INSTITUTIONS'
  | 'LOAN_TO_BUILDERS'
  | 'LOAN_TO_PROFESSIONALS'
  // NRI
  | 'NRI_LOAN';

export interface LoanTypeConfig {
  code: LoanTypeCode;
  name: string;
  shortName: string;
  category: LoanCategory;
  icon: string;
  color: string;
  gradient: string;
  description: string;
  tagline: string;
  features: string[];
  minAmount: number;
  maxAmount: number;
  minTenure: number;
  maxTenure: number;
  interestRateRange: string;
  processingTime: string;
  requiresCollateral: boolean;
  requiresCoApplicant: boolean;
  popularityRank: number;
  formSteps: FormStepConfig[];
  requiredDocuments: DocumentType[];
}

export interface LoanCategoryConfig {
  id: LoanCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  gradient: string;
  loanTypes: LoanTypeCode[];
}

// =====================================================
// FORM STEP DEFINITIONS
// =====================================================

export type FormStepType =
  | 'welcome'
  | 'customer_details'
  | 'employment_details'
  | 'income_details'
  | 'loan_requirements'
  | 'property_details'
  | 'vehicle_details'
  | 'business_details'
  | 'gst_details'
  | 'course_details'
  | 'gold_details'
  | 'collateral_details'
  | 'professional_details'
  | 'existing_loans'
  | 'co_applicant'
  | 'documents'
  | 'review'
  | 'success';

export interface FormStepConfig {
  id: FormStepType;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  estimatedTime: string;
  isOptional: boolean;
  fields: FormFieldConfig[];
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[];
  defaultValue?: unknown;
  conditionalDisplay?: ConditionalDisplay;
  integration?: IntegrationConfig;
  gridColumn?: 'full' | 'half' | 'third';
}

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'checkbox'
  | 'toggle'
  | 'textarea'
  | 'file'
  | 'pan'
  | 'aadhaar'
  | 'gstin'
  | 'pincode'
  | 'address'
  | 'slider'
  | 'range';

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: string | number;
  message: string;
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  disabled?: boolean;
}

export interface ConditionalDisplay {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'exists';
  value: unknown;
}

export interface IntegrationConfig {
  type: 'pan_verify' | 'aadhaar_ekyc' | 'gst_fetch' | 'itr_fetch' | 'cibil' | 'penny_drop';
  autoFetch: boolean;
  fields?: string[];
}

// =====================================================
// DOCUMENT DEFINITIONS
// =====================================================

export type DocumentType =
  | 'PAN'
  | 'AADHAAR'
  | 'PASSPORT'
  | 'VOTER_ID'
  | 'DRIVING_LICENSE'
  | 'SALARY_SLIP'
  | 'FORM_16'
  | 'ITR'
  | 'BANK_STATEMENT'
  | 'ADDRESS_PROOF'
  | 'PHOTO'
  | 'PROPERTY_DOCS'
  | 'VEHICLE_RC'
  | 'GST_CERTIFICATE'
  | 'BUSINESS_PROOF'
  | 'FINANCIAL_STATEMENTS'
  | 'GOLD_RECEIPT'
  | 'ADMISSION_LETTER'
  | 'FEE_STRUCTURE'
  | 'PROFESSIONAL_CERT';

export interface DocumentConfig {
  type: DocumentType;
  name: string;
  description: string;
  acceptedFormats: string[];
  maxSize: number;
  isOptional: boolean;
  verificationRequired: boolean;
}

// =====================================================
// APPLICATION STATE
// =====================================================

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'VERIFICATION_IN_PROGRESS'
  | 'CAM_PROCESSING'
  | 'CAM_GENERATED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'WITHDRAWN';

export type VerificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'FAILED'
  | 'MISMATCH'
  | 'SKIPPED';

export interface ApplicationState {
  applicationId?: string;
  loanType: LoanTypeCode | null;
  currentStep: number;
  completedSteps: Set<number>;
  formData: Record<string, unknown>;
  documents: UploadedDocument[];
  verifications: Record<string, VerificationStatus>;
  status: ApplicationStatus;
  isDraft: boolean;
  lastSavedAt?: Date;
  errors: Record<string, string>;
}

export interface UploadedDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  uploadedAt: Date;
  verificationStatus: VerificationStatus;
  extractedData?: Record<string, unknown>;
}

// =====================================================
// USER CONTEXT
// =====================================================

export type UserRole =
  | 'CUSTOMER'
  | 'PARTNER_BA'
  | 'PARTNER_BP'
  | 'EMPLOYEE_BDE'
  | 'EMPLOYEE_CRO'
  | 'EMPLOYEE_BDM'
  | 'ADMIN';

export interface UserContext {
  role: UserRole;
  userId: string;
  userName: string;
  partnerId?: string;
  partnerName?: string;
  branchId?: string;
  branchName?: string;
  permissions: string[];
}

// =====================================================
// COMPONENT PROPS
// =====================================================

export interface LoanApplicationWizardProps {
  userContext: UserContext;
  preSelectedLoanType?: LoanTypeCode;
  referralToken?: string;
  onComplete?: (applicationId: string) => void;
  onCancel?: () => void;
  className?: string;
}

export interface LoanTypeSelectorProps {
  onSelect: (loanType: LoanTypeCode) => void;
  selectedType?: LoanTypeCode;
  showCategories?: boolean;
  className?: string;
}

export interface LoanTypeCardProps {
  config: LoanTypeConfig;
  isSelected: boolean;
  onClick: () => void;
  variant?: 'default' | 'compact' | 'featured';
  className?: string;
}

export interface FormStepProps {
  stepConfig: FormStepConfig;
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  verifications: Record<string, VerificationStatus>;
  onFieldChange: (field: string, value: unknown) => void;
  onVerify: (field: string) => Promise<void>;
  isSubmitting: boolean;
}

export interface ProgressIndicatorProps {
  steps: FormStepConfig[];
  currentStep: number;
  completedSteps: Set<number>;
  variant?: 'horizontal' | 'vertical' | 'compact';
  className?: string;
}

// =====================================================
// ANIMATION CONFIGS
// =====================================================

export interface AnimationConfig {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Record<string, unknown>;
}

export const ANIMATION_PRESETS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  slideIn: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  bounce: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  stagger: {
    animate: { transition: { staggerChildren: 0.08 } },
  },
} as const;
