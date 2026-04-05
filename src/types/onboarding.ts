// =====================================================
// EMPLOYEE ONBOARDING TYPES
// =====================================================

export type OnboardingStatus =
  | 'pending'
  | 'profile_incomplete'
  | 'documents_pending'
  | 'documents_submitted'
  | 'hr_review'
  | 'approved'
  | 'rejected'
  | 'active';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type PaymentFrequency = 'weekly' | 'bi-weekly' | 'monthly';

export interface EmployeeOnboarding {
  id: string;
  user_id: string;
  employee_id: string;
  temporary_password: string | null;
  password_changed: boolean;
  onboarding_status: OnboardingStatus;

  // Personal Information
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  phone: string | null;
  alternate_phone: string | null;
  date_of_birth: string | null;
  gender: Gender | null;

  // Address Information
  current_address: string | null;
  current_city: string | null;
  current_state: string | null;
  current_pincode: string | null;
  permanent_address: string | null;
  permanent_city: string | null;
  permanent_state: string | null;
  permanent_pincode: string | null;
  address_same_as_current: boolean;

  // Emergency Contact
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_email: string | null;

  // Bank Details
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_branch: string | null;

  // Education & Experience
  highest_education: string | null;
  university_institute: string | null;
  year_of_passing: number | null;
  total_experience_years: number | null;
  previous_employer: string | null;
  previous_designation: string | null;

  // Role Assignment
  assigned_role_id: string | null;
  assigned_sub_role_id: string | null;
  assigned_department_id: string | null;
  reporting_manager_id: string | null;

  // Location & Loan Type Assignment
  assigned_location: string | null;
  assigned_city: string | null;
  assigned_state: string | null;
  assigned_loan_types: string[];

  // Dates
  date_of_joining: string | null;
  probation_period_months: number;
  probation_end_date: string | null;

  // Workflow Tracking
  profile_completed_at: string | null;
  documents_submitted_at: string | null;
  hr_reviewed_at: string | null;
  hr_reviewed_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface EmployeeOnboardingWithRelations extends EmployeeOnboarding {
  assigned_role?: {
    id: string;
    role_name: string;
    role_code: string;
    department?: {
      id: string;
      name: string;
    };
  };
  assigned_sub_role?: {
    id: string;
    sub_role_name: string;
    sub_role_code: string;
  };
  assigned_department?: {
    id: string;
    name: string;
    code: string;
  };
  reporting_manager?: {
    id: string;
    name: string;
    email: string;
    designation?: string;
  };
  documents?: EmployeeOnboardingDocument[];
  salary_details?: EmployeeSalary;
  status_log?: EmployeeOnboardingStatusLog[];
}

export interface EmployeeSalary {
  id: string;
  employee_onboarding_id: string;
  user_id: string;

  // Salary Structure
  basic_salary: number;
  hra: number;
  special_allowance: number;
  transport_allowance: number;
  medical_allowance: number;
  other_allowances: number;

  // Deductions
  pf_contribution: number;
  esi_contribution: number;
  professional_tax: number;
  tds: number;

  // Benefits
  benefits: SalaryBenefit[];

  // Totals
  gross_salary: number;
  ctc_annual: number;

  // Configuration
  payment_frequency: PaymentFrequency;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;

  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SalaryBenefit {
  type: string;
  name: string;
  value: number;
  description?: string;
}

export interface OnboardingDocumentType {
  id: string;
  document_name: string;
  document_code: string;
  description: string | null;
  is_mandatory: boolean;
  allowed_formats: string[];
  max_file_size_mb: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_by: string | null;
}

export interface EmployeeOnboardingDocument {
  id: string;
  employee_onboarding_id: string;
  document_type_id: string;

  // Document Details
  document_name: string;
  file_path: string;
  file_size_kb: number | null;
  file_type: string | null;

  // Verification
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  rejection_reason: string | null;

  // Metadata
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface EmployeeOnboardingDocumentWithType extends EmployeeOnboardingDocument {
  document_type?: OnboardingDocumentType;
  verified_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface EmployeeRoleAssignmentHistory {
  id: string;
  user_id: string;
  role_id: string | null;
  sub_role_id: string | null;
  department_id: string | null;
  reporting_manager_id: string | null;
  effective_from: string;
  effective_to: string | null;
  assignment_reason: string | null;
  is_current: boolean;
  assigned_by: string | null;
  assigned_at: string;
}

export interface EmployeeLoginCredentials {
  id: string;
  user_id: string;
  employee_onboarding_id: string;
  temporary_password_hash: string | null;
  password_reset_required: boolean;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number;
  account_locked: boolean;
  locked_at: string | null;
  locked_reason: string | null;
  unlock_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeOnboardingStatusLog {
  id: string;
  employee_onboarding_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  metadata: any;
}

export interface EmployeeOnboardingStatusLogWithUser extends EmployeeOnboardingStatusLog {
  changed_by_user?: {
    id: string;
    name: string;
    email: string;
  };
}

// Create Employee Request Types
export interface CreateEmployeeRequest {
  personal_info: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth?: string;
    gender?: Gender;
  };
  role_assignment: {
    assigned_role_id: string;
    assigned_sub_role_id?: string;
    assigned_department_id: string;
    reporting_manager_id: string;
  };
  location_assignment: {
    assigned_location: string;
    assigned_city: string;
    assigned_state: string;
    assigned_loan_types: string[];
  };
  employment_details: {
    date_of_joining: string;
    probation_period_months?: number;
  };
  salary_details: {
    basic_salary: number;
    hra?: number;
    special_allowance?: number;
    transport_allowance?: number;
    medical_allowance?: number;
    other_allowances?: number;
    pf_contribution?: number;
    esi_contribution?: number;
    professional_tax?: number;
    tds?: number;
    benefits?: SalaryBenefit[];
    ctc_annual: number;
    payment_frequency?: PaymentFrequency;
  };
}

export interface CreateEmployeeResponse {
  employee_id: string;
  user_id: string;
  temporary_password: string;
  onboarding_id: string;
  onboarding_status: OnboardingStatus;
  login_url: string;
  credentials_sent_to: string;
}

// Update Profile Request Types
export interface UpdateEmployeeProfileRequest {
  personal_info?: {
    phone?: string;
    alternate_phone?: string;
    date_of_birth?: string;
    gender?: Gender;
  };
  address_info?: {
    current_address?: string;
    current_city?: string;
    current_state?: string;
    current_pincode?: string;
    permanent_address?: string;
    permanent_city?: string;
    permanent_state?: string;
    permanent_pincode?: string;
    address_same_as_current?: boolean;
  };
  emergency_contact?: {
    name?: string;
    relationship?: string;
    phone?: string;
    email?: string;
  };
  bank_details?: {
    bank_name?: string;
    account_number?: string;
    ifsc_code?: string;
    branch?: string;
  };
  education_experience?: {
    highest_education?: string;
    university_institute?: string;
    year_of_passing?: number;
    total_experience_years?: number;
    previous_employer?: string;
    previous_designation?: string;
  };
}

// Profile Completion Status
export interface ProfileCompletionStatus {
  personal_info: number;
  address_info: number;
  emergency_contact: number;
  bank_details: number;
  education_experience: number;
  documents: number;
  overall: number;
}

export interface OnboardingStep {
  step: string;
  status: 'completed' | 'in_progress' | 'pending' | 'locked';
  required: boolean;
  description?: string;
}

export interface OnboardingStatusResponse {
  employee_id: string;
  onboarding_status: OnboardingStatus;
  password_changed: boolean;
  profile_completion: ProfileCompletionStatus;
  required_steps: OnboardingStep[];
  next_action: string;
}

// HR Dashboard Analytics
export interface OnboardingAnalytics {
  summary: {
    total_employees: number;
    pending: number;
    profile_incomplete: number;
    documents_pending: number;
    hr_review: number;
    approved: number;
    rejected: number;
  };
  recent_joiners: EmployeeOnboardingWithRelations[];
  upcoming_joiners: EmployeeOnboardingWithRelations[];
  pending_approvals: EmployeeOnboardingWithRelations[];
  document_verification_pending: number;
  completion_rate: {
    this_month: number;
    last_month: number;
  };
  average_onboarding_time: {
    days: number;
    breakdown: {
      profile_completion: number;
      document_upload: number;
      hr_review: number;
    };
  };
}
