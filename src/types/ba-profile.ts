/**
 * Business Associate Profile Types - Enterprise Grade
 * Comprehensive type definitions for BA MyProfile module
 * Aligned with Fortune 500 standards and RBI/AML/KYC compliance
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PartnerEntityType =
  | 'INDIVIDUAL'
  | 'PROPRIETORSHIP'
  | 'PARTNERSHIP'
  | 'LLP'
  | 'PRIVATE_LIMITED'
  | 'PUBLIC_LIMITED'

export type AccountStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'BLACKLISTED'
  | 'PENDING_VERIFICATION'

export type OnboardingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUIRED'

export type VerificationStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REJECTED'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'

export type ResidentialStatus = 'RESIDENT' | 'NRI' | 'FOREIGN_NATIONAL'

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'SEPARATED'

export type BusinessCategory =
  | 'DSA'
  | 'LOAN_AGENT'
  | 'CHANNEL_PARTNER'
  | 'FRANCHISE'
  | 'CORPORATE_PARTNER'
  | 'REFERRAL_PARTNER'

export type LeadVolumeRange =
  | 'LESS_THAN_10'
  | '10_TO_50'
  | '50_TO_100'
  | '100_TO_500'
  | 'MORE_THAN_500'

export type OfficeSetupType =
  | 'HOME_OFFICE'
  | 'SHARED_OFFICE'
  | 'DEDICATED_OFFICE'
  | 'VIRTUAL_OFFICE'

export type BankAccountType = 'SAVINGS' | 'CURRENT'

export type PayoutPreference = 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY' | 'ON_DEMAND'

export type TwoFactorMethod = 'SMS' | 'EMAIL' | 'AUTHENTICATOR_APP'

export type DocumentType =
  | 'PAN_CARD'
  | 'AADHAAR_CARD'
  | 'PHOTOGRAPH'
  | 'ADDRESS_PROOF'
  | 'BANK_PROOF'
  | 'GST_CERTIFICATE'
  | 'PARTNER_AGREEMENT'
  | 'DIGITAL_SIGNATURE'
  | 'BUSINESS_REGISTRATION'
  | 'PROFESSIONAL_CERTIFICATE'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID'
  | 'ITR_DOCUMENT'
  | 'OTHER'

export type AddressProofType =
  | 'UTILITY_BILL'
  | 'BANK_STATEMENT'
  | 'RENT_AGREEMENT'
  | 'PROPERTY_DOCUMENT'
  | 'AADHAAR_CARD'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID'

export type ApprovalStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DELETE'
  | 'PROFILE_EXPORT'

export type LoanProductType =
  | 'PERSONAL_LOAN'
  | 'HOME_LOAN'
  | 'BUSINESS_LOAN'
  | 'LAP'
  | 'AUTO_LOAN'
  | 'CREDIT_CARD'
  | 'GOLD_LOAN'
  | 'EDUCATION_LOAN'
  | 'OTHERS'

export type IndustryDomain =
  | 'BANKING'
  | 'NBFC'
  | 'INSURANCE'
  | 'REAL_ESTATE'
  | 'AUTOMOBILE'
  | 'RETAIL'
  | 'IT_SERVICES'
  | 'MANUFACTURING'
  | 'HEALTHCARE'
  | 'EDUCATION'
  | 'OTHERS'

export type EmergencyContactRelation =
  | 'PARENT'
  | 'SPOUSE'
  | 'SIBLING'
  | 'CHILD'
  | 'FRIEND'
  | 'COLLEAGUE'
  | 'OTHER'

// ============================================
// SECTION INTERFACES
// ============================================

/**
 * Section 1: Account Overview (Header)
 */
export interface BAAccountInfo {
  ba_id: string // Auto-generated: BA001, BA002
  partner_type: 'BUSINESS_ASSOCIATE'
  entity_type: PartnerEntityType
  account_status: AccountStatus
  onboarding_status: OnboardingStatus
  registration_date: string // ISO DateTime
  last_profile_update: string // ISO DateTime
  created_by: string // Source: ADMIN / REFERRAL / CAMPAIGN / SELF_REGISTRATION
  created_by_reference?: string // Admin ID or Referral Code
  profile_completion_percentage: number // 0-100
  is_email_verified: boolean
  is_mobile_verified: boolean
  is_kyc_verified: boolean
  is_bank_verified: boolean
}

/**
 * Section 2: Personal Details
 */
export interface BAPersonalDetails {
  // Basic Information
  full_name: string // As per PAN
  date_of_birth: string | null // YYYY-MM-DD
  gender: Gender | null

  // Contact Information
  mobile_number: string // 10 digits, OTP verified
  mobile_verified: boolean
  mobile_verified_at: string | null
  alternate_mobile: string | null
  country_code: string // Default: +91

  email_id: string // OTP verified
  email_verified: boolean
  email_verified_at: string | null
  alternate_email: string | null

  // Additional Personal Info
  nationality: string // Default: Indian
  residential_status: ResidentialStatus
  marital_status: MaritalStatus | null

  // Profile Picture
  photograph_url: string | null
  photograph_uploaded_at: string | null

  // Emergency Contact
  emergency_contact_name: string | null
  emergency_contact_number: string | null
  emergency_contact_relation: EmergencyContactRelation | null
}

/**
 * Section 3: Identity & KYC Details
 */
export interface BAIdentityKYC {
  // PAN Details
  pan_number: string | null
  pan_name: string | null // Name as per PAN
  pan_document_url: string | null
  pan_verification_status: VerificationStatus
  pan_verified_at: string | null
  pan_verified_by: string | null // 'SYSTEM' or Admin ID
  pan_rejection_reason: string | null

  // Aadhaar Details (Masked)
  aadhaar_number_masked: string | null // XXXX-XXXX-1234
  aadhaar_document_url: string | null
  aadhaar_verification_status: VerificationStatus
  aadhaar_verified_at: string | null

  // Additional IDs
  passport_number: string | null
  passport_expiry_date: string | null
  passport_document_url: string | null

  driving_license_number: string | null
  driving_license_expiry_date: string | null
  driving_license_document_url: string | null

  voter_id_number: string | null
  voter_id_document_url: string | null
}

/**
 * Section 4: Business / Professional Details
 */
export interface BABusinessDetails {
  // Business Information (for non-individual)
  business_name_legal: string | null
  trade_name: string | null
  business_registration_number: string | null
  business_registration_date: string | null
  business_registration_document_url: string | null

  // Professional Details
  business_category: BusinessCategory
  years_of_experience: number
  industry_domains: IndustryDomain[]
  loan_products_handled: LoanProductType[]

  // Operational Details
  average_monthly_lead_volume: LeadVolumeRange
  operating_cities: string[]
  operating_states: string[]
  office_setup_type: OfficeSetupType | null
  team_size: number | null

  // Online Presence
  website_url: string | null
  linkedin_profile_url: string | null
}

/**
 * Section 5: Address Details
 */
export interface BAAddressDetails {
  // Registered Address
  registered_address_line1: string
  registered_address_line2: string | null
  registered_landmark: string | null
  registered_city: string
  registered_district: string
  registered_state: string
  registered_state_code: string
  registered_country: string // Default: India
  registered_pincode: string
  registered_address_proof_type: AddressProofType | null
  registered_address_proof_url: string | null
  registered_address_proof_date: string | null
  registered_address_verification_status: VerificationStatus

  // Communication Address
  communication_same_as_registered: boolean
  communication_address_line1: string | null
  communication_address_line2: string | null
  communication_landmark: string | null
  communication_city: string | null
  communication_district: string | null
  communication_state: string | null
  communication_state_code: string | null
  communication_country: string | null
  communication_pincode: string | null
}

/**
 * Section 6: GST & Tax Details
 */
export interface BAGSTTaxDetails {
  gst_applicable: boolean
  gstin: string | null
  gst_registration_date: string | null
  gst_certificate_url: string | null
  gst_verification_status: VerificationStatus
  gst_verified_at: string | null

  tan_number: string | null

  income_tax_filing_status: 'FILED' | 'NOT_FILED' | 'EXEMPT' | null
  last_itr_year: string | null // e.g., "2023-24"
  itr_document_url: string | null
}

/**
 * Section 7: Bank & Payout Details
 */
export interface BABankDetails {
  account_holder_name: string
  bank_name: string
  branch_name: string
  account_number: string // Encrypted in DB, masked in display
  account_number_masked: string // XXXX1234
  ifsc_code: string
  account_type: BankAccountType
  micr_code: string | null

  cancelled_cheque_url: string | null
  bank_verification_status: VerificationStatus
  bank_verification_method: 'PENNY_DROP' | 'MANUAL' | null
  bank_verified_at: string | null
  bank_verified_by: string | null

  payout_preference: PayoutPreference
  upi_id: string | null

  // Approval tracking for bank changes
  bank_change_approval_status: ApprovalStatus
  bank_change_requested_at: string | null
  bank_change_approved_at: string | null
  bank_change_approved_by: string | null
}

/**
 * Section 8: Agreements & Consents
 */
export interface BAAgreements {
  // Partner Agreement
  agreement_version: string | null // e.g., "v2.1"
  agreement_document_url: string | null
  agreement_signed: boolean
  agreement_signed_date: string | null
  agreement_signed_ip: string | null
  agreement_expiry_date: string | null

  // Digital Signature
  digital_signature_url: string | null
  digital_signature_uploaded_at: string | null

  // Consents
  terms_conditions_accepted: boolean
  terms_conditions_accepted_at: string | null
  terms_conditions_version: string | null

  privacy_policy_accepted: boolean
  privacy_policy_accepted_at: string | null
  privacy_policy_version: string | null

  data_sharing_consent: boolean
  data_sharing_consent_at: string | null

  marketing_consent: boolean
  marketing_consent_at: string | null

  whatsapp_consent: boolean
  whatsapp_consent_at: string | null
}

/**
 * Section 10: Security Settings
 */
export interface BASecuritySettings {
  username: string // Email-based

  password_last_changed: string | null
  password_expiry_date: string | null
  password_expires_in_days: number | null

  two_factor_enabled: boolean
  two_factor_method: TwoFactorMethod | null
  two_factor_setup_at: string | null

  last_login_at: string | null
  last_login_ip: string | null
  last_login_device: string | null
  last_login_location: string | null

  failed_login_attempts: number
  account_locked: boolean
  account_locked_until: string | null

  login_alerts_enabled: boolean
  suspicious_activity_alerts: boolean
}

/**
 * Session Information
 */
export interface BASession {
  session_id: string
  device_type: string
  device_name: string
  browser: string
  os: string
  ip_address: string
  location: string | null
  created_at: string
  last_activity_at: string
  is_current: boolean
}

/**
 * Section 11: Document
 */
export interface BADocument {
  id: string
  document_type: DocumentType
  document_name: string
  file_name: string
  file_url: string
  file_size: number // in bytes
  mime_type: string

  uploaded_at: string
  uploaded_by: 'SELF' | string // 'SELF' or Admin ID

  verification_status: VerificationStatus
  verified_at: string | null
  verified_by: string | null
  rejection_reason: string | null

  expiry_date: string | null
  is_expired: boolean

  version: number
  is_latest: boolean
  previous_version_id: string | null

  remarks: string | null
}

/**
 * Section 12: Audit Log Entry
 */
export interface BAAuditLog {
  id: string
  timestamp: string

  action_type: AuditActionType
  action_description: string

  field_name: string | null
  old_value: string | null // Masked for sensitive fields
  new_value: string | null // Masked for sensitive fields

  changed_by: 'SELF' | string // 'SELF' or Admin ID
  changed_by_name: string | null

  source: 'WEB' | 'MOBILE' | 'API' | 'ADMIN_PORTAL' | 'SYSTEM'
  ip_address: string | null
  user_agent: string | null

  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  approval_remarks: string | null

  metadata: Record<string, unknown> | null
}

/**
 * Profile Change Request (for approval workflow)
 */
export interface BAProfileChangeRequest {
  id: string
  ba_id: string

  field_name: string
  section: string

  old_value: string | null
  new_value: string

  requested_at: string
  requested_reason: string | null

  status: ApprovalStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_remarks: string | null
}

// ============================================
// COMPLETE PROFILE INTERFACE
// ============================================

/**
 * Complete BA Profile Data
 */
export interface BAProfileData {
  // Section 1: Account Overview
  account: BAAccountInfo

  // Section 2: Personal Details
  personal: BAPersonalDetails

  // Section 3: Identity & KYC
  identity: BAIdentityKYC

  // Section 4: Business Details
  business: BABusinessDetails

  // Section 5: Address Details
  address: BAAddressDetails

  // Section 6: GST & Tax
  gst_tax: BAGSTTaxDetails

  // Section 7: Bank & Payout
  bank: BABankDetails

  // Section 8: Agreements
  agreements: BAAgreements

  // Section 10: Security (Section 9 is Commission - external module)
  security: BASecuritySettings

  // Section 11: Documents
  documents: BADocument[]

  // Section 12: Audit Logs (loaded separately)
  // audit_logs: BAAuditLog[]

  // Sessions (loaded separately)
  // sessions: BASession[]

  // Pending Change Requests
  pending_changes: BAProfileChangeRequest[]

  // Bio / Description
  bio_description: string | null

  // Metadata
  created_at: string
  updated_at: string
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface BAProfileResponse {
  success: boolean
  data: BAProfileData | null
  error?: string
  message?: string
}

export interface BAProfileUpdateResponse {
  success: boolean
  data?: Partial<BAProfileData>
  error?: string
  message?: string
  requires_approval?: boolean
  change_request_id?: string
}

export interface BADocumentUploadResponse {
  success: boolean
  document?: BADocument
  error?: string
  message?: string
}

export interface BAAuditLogResponse {
  success: boolean
  data: BAAuditLog[]
  total: number
  page: number
  limit: number
  error?: string
}

export interface BASessionsResponse {
  success: boolean
  data: BASession[]
  error?: string
}

// ============================================
// FORM DATA TYPES (for UI)
// ============================================

export interface BAPersonalDetailsForm {
  full_name: string
  date_of_birth: string
  gender: Gender | ''
  mobile_number: string
  alternate_mobile: string
  country_code: string
  email_id: string
  alternate_email: string
  nationality: string
  residential_status: ResidentialStatus | ''
  marital_status: MaritalStatus | ''
  emergency_contact_name: string
  emergency_contact_number: string
  emergency_contact_relation: EmergencyContactRelation | ''
}

export interface BAIdentityKYCForm {
  pan_number: string
  pan_name: string
  aadhaar_number: string // Will be masked on save
  passport_number: string
  passport_expiry_date: string
  driving_license_number: string
  driving_license_expiry_date: string
  voter_id_number: string
}

export interface BABusinessDetailsForm {
  business_name_legal: string
  trade_name: string
  business_category: BusinessCategory | ''
  years_of_experience: string
  industry_domains: IndustryDomain[]
  loan_products_handled: LoanProductType[]
  average_monthly_lead_volume: LeadVolumeRange | ''
  operating_cities: string[]
  operating_states: string[]
  office_setup_type: OfficeSetupType | ''
  team_size: string
  website_url: string
  linkedin_profile_url: string
}

export interface BAAddressForm {
  registered_address_line1: string
  registered_address_line2: string
  registered_landmark: string
  registered_city: string
  registered_district: string
  registered_state: string
  registered_pincode: string
  registered_address_proof_type: AddressProofType | ''

  communication_same_as_registered: boolean
  communication_address_line1: string
  communication_address_line2: string
  communication_landmark: string
  communication_city: string
  communication_district: string
  communication_state: string
  communication_pincode: string
}

export interface BAGSTTaxForm {
  gst_applicable: boolean
  gstin: string
  gst_registration_date: string
  tan_number: string
  income_tax_filing_status: 'FILED' | 'NOT_FILED' | 'EXEMPT' | ''
  last_itr_year: string
}

export interface BABankDetailsForm {
  account_holder_name: string
  bank_name: string
  branch_name: string
  account_number: string
  confirm_account_number: string
  ifsc_code: string
  account_type: BankAccountType | ''
  micr_code: string
  payout_preference: PayoutPreference | ''
  upi_id: string
}

export interface BAAgreementsForm {
  terms_conditions_accepted: boolean
  privacy_policy_accepted: boolean
  data_sharing_consent: boolean
  marketing_consent: boolean
  whatsapp_consent: boolean
}

export interface BASecurityForm {
  two_factor_enabled: boolean
  two_factor_method: TwoFactorMethod | ''
  login_alerts_enabled: boolean
  suspicious_activity_alerts: boolean
}

// ============================================
// VALIDATION PATTERNS
// ============================================

export const BA_VALIDATION_PATTERNS = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAAR: /^[0-9]{12}$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  TAN: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  MICR: /^[0-9]{9}$/,
  MOBILE: /^[6-9][0-9]{9}$/,
  PINCODE: /^[1-9][0-9]{5}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSPORT: /^[A-Z][0-9]{7}$/,
  VOTER_ID: /^[A-Z]{3}[0-9]{7}$/,
  UPI: /^[\w.-]+@[\w]+$/,
  URL: /^https?:\/\/.+/,
  LINKEDIN: /^https?:\/\/(www\.)?linkedin\.com\/.+/,
  ACCOUNT_NUMBER: /^[0-9]{9,18}$/,
}

// ============================================
// CONSTANTS
// ============================================

export const BA_CONSTANTS = {
  MAX_PROFILE_PICTURE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_DOCUMENT_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_SIGNATURE_SIZE: 2 * 1024 * 1024, // 2MB

  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png'],
  ALLOWED_DOCUMENT_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  ALLOWED_SIGNATURE_TYPES: ['image/png'],

  MIN_PROFILE_PICTURE_DIMENSION: 200,
  MIN_AGE: 18,
  MAX_AGE: 100,

  PASSWORD_EXPIRY_DAYS: 90,
  MAX_FAILED_LOGIN_ATTEMPTS: 5,
  SESSION_TIMEOUT_MINUTES: 30,
  MAX_CONCURRENT_SESSIONS: 3,

  BIO_MAX_LENGTH: 1000,
  ADDRESS_MAX_LENGTH: 500,
}

// ============================================
// HELPER TYPES
// ============================================

export type BAProfileSection =
  | 'account'
  | 'personal'
  | 'identity'
  | 'business'
  | 'address'
  | 'gst_tax'
  | 'bank'
  | 'agreements'
  | 'security'
  | 'documents'
  | 'activity'

export type BAProfileTab =
  | 'overview'
  | 'personal'
  | 'identity'
  | 'business'
  | 'address'
  | 'gst-tax'
  | 'bank'
  | 'agreements'
  | 'commission'
  | 'security'
  | 'documents'
  | 'activity'

export interface BAProfileCompletionItem {
  section: BAProfileSection
  label: string
  completed: boolean
  required: boolean
  percentage: number
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_BA_PERSONAL_DETAILS: BAPersonalDetailsForm = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  mobile_number: '',
  alternate_mobile: '',
  country_code: '+91',
  email_id: '',
  alternate_email: '',
  nationality: 'Indian',
  residential_status: 'RESIDENT',
  marital_status: '',
  emergency_contact_name: '',
  emergency_contact_number: '',
  emergency_contact_relation: '',
}

export const DEFAULT_BA_IDENTITY_KYC: BAIdentityKYCForm = {
  pan_number: '',
  pan_name: '',
  aadhaar_number: '',
  passport_number: '',
  passport_expiry_date: '',
  driving_license_number: '',
  driving_license_expiry_date: '',
  voter_id_number: '',
}

export const DEFAULT_BA_BUSINESS_DETAILS: BABusinessDetailsForm = {
  business_name_legal: '',
  trade_name: '',
  business_category: '',
  years_of_experience: '',
  industry_domains: [],
  loan_products_handled: [],
  average_monthly_lead_volume: '',
  operating_cities: [],
  operating_states: [],
  office_setup_type: '',
  team_size: '',
  website_url: '',
  linkedin_profile_url: '',
}

export const DEFAULT_BA_ADDRESS: BAAddressForm = {
  registered_address_line1: '',
  registered_address_line2: '',
  registered_landmark: '',
  registered_city: '',
  registered_district: '',
  registered_state: '',
  registered_pincode: '',
  registered_address_proof_type: '',
  communication_same_as_registered: true,
  communication_address_line1: '',
  communication_address_line2: '',
  communication_landmark: '',
  communication_city: '',
  communication_district: '',
  communication_state: '',
  communication_pincode: '',
}

export const DEFAULT_BA_GST_TAX: BAGSTTaxForm = {
  gst_applicable: false,
  gstin: '',
  gst_registration_date: '',
  tan_number: '',
  income_tax_filing_status: '',
  last_itr_year: '',
}

export const DEFAULT_BA_BANK_DETAILS: BABankDetailsForm = {
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  confirm_account_number: '',
  ifsc_code: '',
  account_type: '',
  micr_code: '',
  payout_preference: 'MONTHLY',
  upi_id: '',
}

export const DEFAULT_BA_AGREEMENTS: BAAgreementsForm = {
  terms_conditions_accepted: false,
  privacy_policy_accepted: false,
  data_sharing_consent: false,
  marketing_consent: false,
  whatsapp_consent: false,
}

export const DEFAULT_BA_SECURITY: BASecurityForm = {
  two_factor_enabled: false,
  two_factor_method: '',
  login_alerts_enabled: true,
  suspicious_activity_alerts: true,
}

// ============================================
// LABEL MAPPINGS
// ============================================

export const ENTITY_TYPE_LABELS: Record<PartnerEntityType, string> = {
  INDIVIDUAL: 'Individual',
  PROPRIETORSHIP: 'Proprietorship',
  PARTNERSHIP: 'Partnership',
  LLP: 'Limited Liability Partnership (LLP)',
  PRIVATE_LIMITED: 'Private Limited Company',
  PUBLIC_LIMITED: 'Public Limited Company',
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  BLACKLISTED: 'Blacklisted',
  PENDING_VERIFICATION: 'Pending Verification',
}

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RESUBMISSION_REQUIRED: 'Resubmission Required',
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING: 'Pending Verification',
  VERIFIED: 'Verified',
  FAILED: 'Verification Failed',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
}

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  DSA: 'Direct Selling Agent (DSA)',
  LOAN_AGENT: 'Loan Agent',
  CHANNEL_PARTNER: 'Channel Partner',
  FRANCHISE: 'Franchise',
  CORPORATE_PARTNER: 'Corporate Partner',
  REFERRAL_PARTNER: 'Referral Partner',
}

export const LEAD_VOLUME_LABELS: Record<LeadVolumeRange, string> = {
  LESS_THAN_10: 'Less than 10',
  '10_TO_50': '10 - 50',
  '50_TO_100': '50 - 100',
  '100_TO_500': '100 - 500',
  MORE_THAN_500: 'More than 500',
}

export const LOAN_PRODUCT_LABELS: Record<LoanProductType, string> = {
  PERSONAL_LOAN: 'Personal Loan',
  HOME_LOAN: 'Home Loan',
  BUSINESS_LOAN: 'Business Loan',
  LAP: 'Loan Against Property',
  AUTO_LOAN: 'Auto Loan',
  CREDIT_CARD: 'Credit Card',
  GOLD_LOAN: 'Gold Loan',
  EDUCATION_LOAN: 'Education Loan',
  OTHERS: 'Others',
}

export const INDUSTRY_DOMAIN_LABELS: Record<IndustryDomain, string> = {
  BANKING: 'Banking',
  NBFC: 'NBFC',
  INSURANCE: 'Insurance',
  REAL_ESTATE: 'Real Estate',
  AUTOMOBILE: 'Automobile',
  RETAIL: 'Retail',
  IT_SERVICES: 'IT Services',
  MANUFACTURING: 'Manufacturing',
  HEALTHCARE: 'Healthcare',
  EDUCATION: 'Education',
  OTHERS: 'Others',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PAN_CARD: 'PAN Card',
  AADHAAR_CARD: 'Aadhaar Card',
  PHOTOGRAPH: 'Photograph',
  ADDRESS_PROOF: 'Address Proof',
  BANK_PROOF: 'Bank Proof (Cancelled Cheque)',
  GST_CERTIFICATE: 'GST Certificate',
  PARTNER_AGREEMENT: 'Partner Agreement',
  DIGITAL_SIGNATURE: 'Digital Signature',
  BUSINESS_REGISTRATION: 'Business Registration',
  PROFESSIONAL_CERTIFICATE: 'Professional Certificate',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  VOTER_ID: 'Voter ID',
  ITR_DOCUMENT: 'ITR Document',
  OTHER: 'Other Document',
}
