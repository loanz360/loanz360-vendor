/**
 * Business Partner Profile Types - Enterprise Grade
 * Comprehensive type definitions for BP MyProfile module
 * Aligned with Fortune 500 standards and RBI/AML/KYC compliance
 *
 * Business Partner Role:
 * - Sources loan business directly for Loans360
 * - Recruits and manages Business Associates
 * - Earns commissions from self-sourced and team-sourced business
 * - Can operate as Individual or Business Entity
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PartnerNature = 'INDIVIDUAL' | 'BUSINESS_ENTITY'

export type PartnerEntityType =
  | 'INDIVIDUAL'
  | 'PROPRIETORSHIP'
  | 'PARTNERSHIP'
  | 'LLP'
  | 'PRIVATE_LIMITED'
  | 'PUBLIC_LIMITED'

export type PartnerStatus =
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'PENDING_VERIFICATION'

export type OnboardingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'COMPLIANCE_REVIEW'
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

export type BankAccountType = 'SAVINGS' | 'CURRENT'

export type PayoutMethod = 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'

export type SettlementFrequency = 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'ON_DEMAND'

export type TwoFactorMethod = 'SMS' | 'EMAIL' | 'AUTHENTICATOR_APP'

export type DocumentType =
  | 'PAN_CARD'
  | 'AADHAAR_CARD'
  | 'PHOTOGRAPH'
  | 'ADDRESS_PROOF'
  | 'BANK_PROOF'
  | 'GST_CERTIFICATE'
  | 'CIN_CERTIFICATE'
  | 'PARTNERSHIP_DEED'
  | 'LLP_AGREEMENT'
  | 'INCORPORATION_CERTIFICATE'
  | 'PARTNER_AGREEMENT'
  | 'DIGITAL_SIGNATURE'
  | 'BUSINESS_REGISTRATION'
  | 'PROFESSIONAL_CERTIFICATE'
  | 'PASSPORT'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID'
  | 'ITR_DOCUMENT'
  | 'CANCELLED_CHEQUE'
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
  | 'TEAM_MEMBER_ADD'
  | 'TEAM_MEMBER_REMOVE'

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

export type IndustrySpecialization =
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
  | 'SALARIED'
  | 'SELF_EMPLOYED'
  | 'OTHERS'

export type SourcingChannel =
  | 'DIRECT'
  | 'DIGITAL'
  | 'REFERRAL'
  | 'CORPORATE_TIEUPS'
  | 'WALK_IN'
  | 'TELECALLING'
  | 'FIELD_SALES'

export type LeadVolumeRange =
  | 'LESS_THAN_10'
  | '10_TO_50'
  | '50_TO_100'
  | '100_TO_500'
  | 'MORE_THAN_500'

export type AssociateApprovalFlow = 'MANUAL' | 'AUTO'

export type IncomeTaxCategory = 'INDIVIDUAL' | 'HUF' | 'FIRM' | 'COMPANY' | 'LLP'

// ============================================
// SECTION INTERFACES
// ============================================

/**
 * Section 1: Partner Account Overview (System Controlled)
 */
export interface BPAccountOverview {
  bp_id: string // System Generated: BP001, BP002
  partner_nature: PartnerNature // Individual or Business Entity
  partner_status: PartnerStatus
  onboarding_status: OnboardingStatus
  date_of_registration: string // ISO DateTime
  last_profile_update: string // ISO DateTime
  reporting_super_admin: string | null // Super Admin ID
  reporting_super_admin_name: string | null
  partner_hierarchy_level: number // 1 = BP (above BA)
  profile_completion_percentage: number // 0-100
  is_email_verified: boolean
  is_mobile_verified: boolean
  is_kyc_verified: boolean
  is_bank_verified: boolean
  created_by: string // ADMIN / SELF_REGISTRATION / REFERRAL
  created_by_reference: string | null // Admin ID or Referral Code
}

/**
 * Section 2: Personal Details (Mandatory even for entities)
 * Required because Business Partners source business personally
 */
export interface BPPersonalDetails {
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

  // Profile Picture
  profile_photograph_url: string | null
  photograph_uploaded_at: string | null

  // Identity
  pan_number: string | null
  pan_verification_status: VerificationStatus
  pan_document_url: string | null
  pan_verified_at: string | null

  aadhaar_number_masked: string | null // XXXX-XXXX-1234
  aadhaar_verification_status: VerificationStatus
  aadhaar_document_url: string | null

  // Additional
  nationality: string // Default: Indian
  residential_status: ResidentialStatus

  // Address
  residential_address_line1: string
  residential_address_line2: string | null
  residential_city: string
  residential_district: string
  residential_state: string
  residential_state_code: string
  residential_pincode: string
  residential_country: string // Default: India
  address_proof_type: AddressProofType | null
  address_proof_url: string | null
  address_verification_status: VerificationStatus
}

/**
 * Section 3: Business Entity Details
 * Shown only if partner_nature = BUSINESS_ENTITY
 */
export interface BPBusinessEntityDetails {
  legal_entity_name: string
  trade_name: string | null // Brand Name
  entity_type: PartnerEntityType
  date_of_incorporation: string | null // YYYY-MM-DD
  cin_llpin: string | null // CIN or LLPIN or Registration Number
  cin_verification_status: VerificationStatus
  cin_document_url: string | null

  business_pan: string | null
  business_pan_verification_status: VerificationStatus
  business_pan_document_url: string | null

  gst_applicable: boolean
  gstin: string | null
  gst_verification_status: VerificationStatus
  gst_certificate_url: string | null

  // Entity KYC Documents
  partnership_deed_url: string | null
  llp_agreement_url: string | null
  moa_aoa_url: string | null
  board_resolution_url: string | null

  // Authorized Signatory
  authorized_signatory_name: string | null
  authorized_signatory_designation: string | null
  authorized_signatory_pan: string | null
  authorized_signatory_aadhaar_masked: string | null
  is_signatory_same_as_personal: boolean // Maps to Personal Profile

  // Registered Office Address
  registered_address_line1: string | null
  registered_address_line2: string | null
  registered_city: string | null
  registered_state: string | null
  registered_pincode: string | null
}

/**
 * Section 4: Professional & Sourcing Profile
 */
export interface BPProfessionalProfile {
  years_of_experience: number
  primary_loan_products: LoanProductType[]
  secondary_loan_products: LoanProductType[]
  average_monthly_leads: LeadVolumeRange
  operating_cities: string[]
  operating_states: string[]
  industry_specializations: IndustrySpecialization[]
  sourcing_channels: SourcingChannel[]

  // Online Presence
  website_url: string | null
  linkedin_url: string | null

  // Bio
  bio_description: string | null
}

/**
 * Section 5: Team & Hierarchy Details
 */
export interface BPTeamHierarchy {
  total_business_associates: number
  active_associates_count: number
  inactive_associates_count: number
  suspended_associates_count: number
  associate_onboarding_rights: boolean
  associate_approval_flow: AssociateApprovalFlow
  date_first_associate_onboarded: string | null
  last_associate_onboarded_date: string | null
  team_lead_since: string | null // When became BP
}

/**
 * Section 6: Bank & Payout Details
 */
export interface BPBankDetails {
  account_holder_name: string
  bank_name: string
  branch_name: string
  account_number: string // Encrypted in DB
  account_number_masked: string // XXXX1234
  ifsc_code: string
  micr_code: string | null
  account_type: BankAccountType
  cancelled_cheque_url: string | null

  bank_verification_status: VerificationStatus
  bank_verification_method: 'PENNY_DROP' | 'MANUAL' | null
  bank_verified_at: string | null
  bank_verified_by: string | null

  payout_method: PayoutMethod
  upi_id: string | null
  settlement_frequency: SettlementFrequency

  // Approval tracking
  bank_change_approval_status: ApprovalStatus
  bank_change_requested_at: string | null
}

/**
 * Section 7: Tax & Commission Compliance
 */
export interface BPTaxCompliance {
  gst_on_commission: boolean
  gstin: string | null
  gst_verification_status: VerificationStatus
  gst_certificate_url: string | null

  tds_applicable: boolean
  tds_percentage: number | null // e.g., 5, 10

  income_tax_category: IncomeTaxCategory | null
  tan_number: string | null

  commission_eligibility_status: 'ELIGIBLE' | 'INELIGIBLE' | 'SUSPENDED' | 'PENDING_REVIEW'
  commission_ineligibility_reason: string | null
}

/**
 * Section 8: Commission & Earning Structure (Read-Only)
 * This data comes from Payout Grid module - just displayed here
 */
export interface BPCommissionStructure {
  self_sourcing_commission_model: string | null // e.g., "Percentage", "Flat"
  self_sourcing_commission_rate: string | null // e.g., "2.5%", "Rs. 500"
  team_override_commission_model: string | null
  team_override_percentage: string | null
  slab_based_incentives: boolean
  incentive_slabs: BPIncentiveSlab[]
  effective_from_date: string | null
  admin_remarks: string | null
}

export interface BPIncentiveSlab {
  slab_name: string
  min_amount: number
  max_amount: number | null
  commission_rate: string
  bonus_amount: number | null
}

/**
 * Section 9: Agreements & Consents
 */
export interface BPAgreements {
  agreement_version: string | null // e.g., "v2.1"
  agreement_document_url: string | null
  agreement_signed: boolean
  agreement_signed_date: string | null
  agreement_signed_ip: string | null
  agreement_expiry_date: string | null

  digital_signature_url: string | null
  digital_signature_uploaded_at: string | null

  code_of_conduct_accepted: boolean
  code_of_conduct_accepted_at: string | null

  privacy_policy_accepted: boolean
  privacy_policy_accepted_at: string | null
  privacy_policy_version: string | null

  data_sharing_consent: boolean
  data_sharing_consent_at: string | null

  marketing_consent: boolean
  whatsapp_consent: boolean
}

/**
 * Section 10: Platform Access & Security
 */
export interface BPSecuritySettings {
  username: string // Email-based
  role_type: 'BUSINESS_PARTNER'

  last_login_at: string | null
  last_login_ip: string | null
  last_login_device: string | null
  last_login_location: string | null

  login_ip_history: BPLoginHistory[]
  device_history: BPDeviceHistory[]

  two_factor_enabled: boolean
  two_factor_method: TwoFactorMethod | null
  two_factor_setup_at: string | null

  password_last_updated: string | null
  password_expires_at: string | null

  failed_login_attempts: number
  account_locked: boolean
  account_locked_until: string | null

  login_alerts_enabled: boolean
  suspicious_activity_alerts: boolean
}

export interface BPLoginHistory {
  ip_address: string
  location: string | null
  timestamp: string
  status: 'SUCCESS' | 'FAILED'
  device: string
  browser: string
}

export interface BPDeviceHistory {
  device_id: string
  device_type: string
  device_name: string
  os: string
  browser: string
  last_used_at: string
  is_current: boolean
  is_trusted: boolean
}

/**
 * Section 11: Document Repository
 */
export interface BPDocument {
  id: string
  document_type: DocumentType
  document_name: string
  file_name: string
  file_url: string
  file_size: number // bytes
  mime_type: string

  uploaded_at: string
  uploaded_by: 'SELF' | string // 'SELF' or Admin ID

  verification_status: VerificationStatus
  verified_at: string | null
  verified_by: string | null
  admin_comments: string | null
  rejection_reason: string | null

  expiry_date: string | null
  is_expired: boolean

  version: number
  is_latest: boolean
}

/**
 * Section 12: Audit, Change & Approval Logs
 */
export interface BPAuditLog {
  id: string
  timestamp: string

  action_type: AuditActionType
  action_description: string

  field_name: string | null
  old_value: string | null // Masked for sensitive
  new_value: string | null // Masked for sensitive

  changed_by: 'SELF' | string // 'SELF' or Admin ID
  changed_by_name: string | null

  source: 'WEB' | 'MOBILE' | 'API' | 'ADMIN_PORTAL' | 'SYSTEM'
  ip_address: string | null
  user_agent: string | null

  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  approval_remarks: string | null

  compliance_review_notes: string | null
  system_flags: string[]
}

/**
 * Session Information
 */
export interface BPSession {
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
 * Profile Change Request
 */
export interface BPProfileChangeRequest {
  id: string
  bp_id: string
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

/**
 * Business Associate Summary (for Team tab)
 */
export interface BATeamMember {
  ba_id: string
  full_name: string
  mobile_number: string
  email_id: string
  profile_photo_url: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING'
  onboarding_date: string
  total_leads_submitted: number
  total_leads_converted: number
  conversion_rate: number
  total_commission_earned: number
  last_lead_date: string | null
  city: string | null
  state: string | null
  performance_rating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | null
}

// ============================================
// COMPLETE PROFILE INTERFACE
// ============================================

/**
 * Complete BP Profile Data
 */
export interface BPProfileData {
  // Section 1: Account Overview
  account: BPAccountOverview

  // Section 2: Personal Details
  personal: BPPersonalDetails

  // Section 3: Business Entity (null if Individual)
  business_entity: BPBusinessEntityDetails | null

  // Section 4: Professional Profile
  professional: BPProfessionalProfile

  // Section 5: Team & Hierarchy
  team: BPTeamHierarchy

  // Section 6: Bank Details
  bank: BPBankDetails

  // Section 7: Tax & Compliance
  tax_compliance: BPTaxCompliance

  // Section 8: Commission Structure (Read-Only, from Payout Grid)
  commission: BPCommissionStructure

  // Section 9: Agreements
  agreements: BPAgreements

  // Section 10: Security
  security: BPSecuritySettings

  // Section 11: Documents
  documents: BPDocument[]

  // Section 12: Audit Logs (loaded separately)
  // audit_logs: BPAuditLog[]

  // Sessions (loaded separately)
  // sessions: BPSession[]

  // Pending Changes
  pending_changes: BPProfileChangeRequest[]

  // Metadata
  created_at: string
  updated_at: string
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface BPProfileResponse {
  success: boolean
  data: BPProfileData | null
  error?: string
  message?: string
}

export interface BPProfileUpdateResponse {
  success: boolean
  data?: Partial<BPProfileData>
  error?: string
  message?: string
  requires_approval?: boolean
  change_request_id?: string
}

export interface BPDocumentUploadResponse {
  success: boolean
  document?: BPDocument
  error?: string
  message?: string
}

export interface BPAuditLogResponse {
  success: boolean
  data: BPAuditLog[]
  total: number
  page: number
  limit: number
  error?: string
}

export interface BPSessionsResponse {
  success: boolean
  data: BPSession[]
  error?: string
}

export interface BPTeamMembersResponse {
  success: boolean
  data: BATeamMember[]
  total: number
  active: number
  inactive: number
  error?: string
}

// ============================================
// FORM DATA TYPES (for UI)
// ============================================

export interface BPPersonalDetailsForm {
  full_name: string
  date_of_birth: string
  gender: Gender | ''
  mobile_number: string
  alternate_mobile: string
  country_code: string
  email_id: string
  nationality: string
  residential_status: ResidentialStatus | ''
  pan_number: string
  aadhaar_number: string // Will be masked
  residential_address_line1: string
  residential_address_line2: string
  residential_city: string
  residential_district: string
  residential_state: string
  residential_pincode: string
  address_proof_type: AddressProofType | ''
}

export interface BPBusinessEntityForm {
  legal_entity_name: string
  trade_name: string
  entity_type: PartnerEntityType | ''
  date_of_incorporation: string
  cin_llpin: string
  business_pan: string
  gst_applicable: boolean
  gstin: string
  authorized_signatory_name: string
  authorized_signatory_designation: string
  authorized_signatory_pan: string
  is_signatory_same_as_personal: boolean
  registered_address_line1: string
  registered_address_line2: string
  registered_city: string
  registered_state: string
  registered_pincode: string
}

export interface BPProfessionalProfileForm {
  years_of_experience: string
  primary_loan_products: LoanProductType[]
  secondary_loan_products: LoanProductType[]
  average_monthly_leads: LeadVolumeRange | ''
  operating_cities: string[]
  operating_states: string[]
  industry_specializations: IndustrySpecialization[]
  sourcing_channels: SourcingChannel[]
  website_url: string
  linkedin_url: string
  bio_description: string
}

export interface BPBankDetailsForm {
  account_holder_name: string
  bank_name: string
  branch_name: string
  account_number: string
  confirm_account_number: string
  ifsc_code: string
  micr_code: string
  account_type: BankAccountType | ''
  payout_method: PayoutMethod | ''
  upi_id: string
  settlement_frequency: SettlementFrequency | ''
}

export interface BPTaxComplianceForm {
  gst_on_commission: boolean
  gstin: string
  tds_applicable: boolean
  tds_percentage: string
  income_tax_category: IncomeTaxCategory | ''
  tan_number: string
}

export interface BPAgreementsForm {
  code_of_conduct_accepted: boolean
  privacy_policy_accepted: boolean
  data_sharing_consent: boolean
  marketing_consent: boolean
  whatsapp_consent: boolean
}

export interface BPSecurityForm {
  two_factor_enabled: boolean
  two_factor_method: TwoFactorMethod | ''
  login_alerts_enabled: boolean
  suspicious_activity_alerts: boolean
}

// ============================================
// VALIDATION PATTERNS
// ============================================

export const BP_VALIDATION_PATTERNS = {
  PAN: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
  AADHAAR: /^[0-9]{12}$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  TAN: /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/,
  CIN: /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/,
  LLPIN: /^[A-Z]{3}-[0-9]{4}$/,
  IFSC: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  MICR: /^[0-9]{9}$/,
  MOBILE: /^[6-9][0-9]{9}$/,
  PINCODE: /^[1-9][0-9]{5}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UPI: /^[\w.-]+@[\w]+$/,
  URL: /^https?:\/\/.+/,
  LINKEDIN: /^https?:\/\/(www\.)?linkedin\.com\/.+/,
  ACCOUNT_NUMBER: /^[0-9]{9,18}$/,
}

// ============================================
// CONSTANTS
// ============================================

export const BP_CONSTANTS = {
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
// TAB DEFINITIONS
// ============================================

export type BPProfileTab =
  | 'overview'
  | 'personal'
  | 'business-entity'
  | 'professional'
  | 'team'
  | 'bank'
  | 'tax-compliance'
  | 'payout-grid'
  | 'my-team'
  | 'agreements'
  | 'security'
  | 'documents'
  | 'activity'

export interface BPProfileTabConfig {
  id: BPProfileTab
  label: string
  icon: string
  requiresEntityType?: boolean // Only show for Business Entity
  isReadOnly?: boolean
  badge?: {
    text: string
    variant: 'success' | 'warning' | 'error' | 'default'
  }
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_BP_PERSONAL_DETAILS: BPPersonalDetailsForm = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  mobile_number: '',
  alternate_mobile: '',
  country_code: '+91',
  email_id: '',
  nationality: 'Indian',
  residential_status: 'RESIDENT',
  pan_number: '',
  aadhaar_number: '',
  residential_address_line1: '',
  residential_address_line2: '',
  residential_city: '',
  residential_district: '',
  residential_state: '',
  residential_pincode: '',
  address_proof_type: '',
}

export const DEFAULT_BP_BUSINESS_ENTITY: BPBusinessEntityForm = {
  legal_entity_name: '',
  trade_name: '',
  entity_type: '',
  date_of_incorporation: '',
  cin_llpin: '',
  business_pan: '',
  gst_applicable: false,
  gstin: '',
  authorized_signatory_name: '',
  authorized_signatory_designation: '',
  authorized_signatory_pan: '',
  is_signatory_same_as_personal: false,
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_state: '',
  registered_pincode: '',
}

export const DEFAULT_BP_PROFESSIONAL: BPProfessionalProfileForm = {
  years_of_experience: '',
  primary_loan_products: [],
  secondary_loan_products: [],
  average_monthly_leads: '',
  operating_cities: [],
  operating_states: [],
  industry_specializations: [],
  sourcing_channels: [],
  website_url: '',
  linkedin_url: '',
  bio_description: '',
}

export const DEFAULT_BP_BANK_DETAILS: BPBankDetailsForm = {
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  confirm_account_number: '',
  ifsc_code: '',
  micr_code: '',
  account_type: '',
  payout_method: 'BANK_TRANSFER',
  upi_id: '',
  settlement_frequency: 'MONTHLY',
}

export const DEFAULT_BP_TAX_COMPLIANCE: BPTaxComplianceForm = {
  gst_on_commission: false,
  gstin: '',
  tds_applicable: true,
  tds_percentage: '5',
  income_tax_category: '',
  tan_number: '',
}

export const DEFAULT_BP_AGREEMENTS: BPAgreementsForm = {
  code_of_conduct_accepted: false,
  privacy_policy_accepted: false,
  data_sharing_consent: false,
  marketing_consent: false,
  whatsapp_consent: false,
}

export const DEFAULT_BP_SECURITY: BPSecurityForm = {
  two_factor_enabled: false,
  two_factor_method: '',
  login_alerts_enabled: true,
  suspicious_activity_alerts: true,
}

// ============================================
// LABEL MAPPINGS
// ============================================

export const PARTNER_NATURE_LABELS: Record<PartnerNature, string> = {
  INDIVIDUAL: 'Individual',
  BUSINESS_ENTITY: 'Business Entity',
}

export const ENTITY_TYPE_LABELS: Record<PartnerEntityType, string> = {
  INDIVIDUAL: 'Individual',
  PROPRIETORSHIP: 'Proprietorship',
  PARTNERSHIP: 'Partnership',
  LLP: 'Limited Liability Partnership (LLP)',
  PRIVATE_LIMITED: 'Private Limited Company',
  PUBLIC_LIMITED: 'Public Limited Company',
}

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  PENDING_VERIFICATION: 'Pending Verification',
}

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  COMPLIANCE_REVIEW: 'Compliance Review',
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

export const INDUSTRY_SPECIALIZATION_LABELS: Record<IndustrySpecialization, string> = {
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
  SALARIED: 'Salaried Professionals',
  SELF_EMPLOYED: 'Self Employed',
  OTHERS: 'Others',
}

export const SOURCING_CHANNEL_LABELS: Record<SourcingChannel, string> = {
  DIRECT: 'Direct',
  DIGITAL: 'Digital',
  REFERRAL: 'Referral',
  CORPORATE_TIEUPS: 'Corporate Tie-ups',
  WALK_IN: 'Walk-in',
  TELECALLING: 'Telecalling',
  FIELD_SALES: 'Field Sales',
}

export const LEAD_VOLUME_LABELS: Record<LeadVolumeRange, string> = {
  LESS_THAN_10: 'Less than 10',
  '10_TO_50': '10 - 50',
  '50_TO_100': '50 - 100',
  '100_TO_500': '100 - 500',
  MORE_THAN_500: 'More than 500',
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PAN_CARD: 'PAN Card',
  AADHAAR_CARD: 'Aadhaar Card',
  PHOTOGRAPH: 'Photograph',
  ADDRESS_PROOF: 'Address Proof',
  BANK_PROOF: 'Bank Proof (Cancelled Cheque)',
  GST_CERTIFICATE: 'GST Certificate',
  CIN_CERTIFICATE: 'CIN Certificate',
  PARTNERSHIP_DEED: 'Partnership Deed',
  LLP_AGREEMENT: 'LLP Agreement',
  INCORPORATION_CERTIFICATE: 'Incorporation Certificate',
  PARTNER_AGREEMENT: 'Partner Agreement',
  DIGITAL_SIGNATURE: 'Digital Signature',
  BUSINESS_REGISTRATION: 'Business Registration',
  PROFESSIONAL_CERTIFICATE: 'Professional Certificate',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  VOTER_ID: 'Voter ID',
  ITR_DOCUMENT: 'ITR Document',
  CANCELLED_CHEQUE: 'Cancelled Cheque',
  OTHER: 'Other Document',
}

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  SAVINGS: 'Savings Account',
  CURRENT: 'Current Account',
}

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  BANK_TRANSFER: 'Bank Transfer (NEFT/IMPS)',
  UPI: 'UPI',
  CHEQUE: 'Cheque',
}

export const SETTLEMENT_FREQUENCY_LABELS: Record<SettlementFrequency, string> = {
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-Weekly',
  MONTHLY: 'Monthly',
  ON_DEMAND: 'On Demand',
}

export const INCOME_TAX_CATEGORY_LABELS: Record<IncomeTaxCategory, string> = {
  INDIVIDUAL: 'Individual',
  HUF: 'Hindu Undivided Family',
  FIRM: 'Partnership Firm',
  COMPANY: 'Company',
  LLP: 'LLP',
}

export const TWO_FACTOR_METHOD_LABELS: Record<TwoFactorMethod, string> = {
  SMS: 'SMS',
  EMAIL: 'Email',
  AUTHENTICATOR_APP: 'Authenticator App',
}
