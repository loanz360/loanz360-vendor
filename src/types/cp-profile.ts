/**
 * Channel Partner Profile Types - Enterprise Grade
 * Comprehensive type definitions for CP MyProfile module
 * Aligned with Fortune 500 standards and RBI/AML/KYC compliance
 *
 * Channel Partner Role:
 * - Independently sources, processes, and disburses loans
 * - Uses Loans360 company code to disburse cases in Banks & NBFCs
 * - Reports post-disbursement data into Loans360
 * - Claims payouts/commissions for disbursements
 * - Requires financial transparency, compliance tracking, and payout reconciliation
 *
 * DOES NOT:
 * - Source business FOR Loans360
 * - Enter customer or loan data for processing
 * - Recruit Business Associates
 * - Use Loans360 BDE / processing services
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

export type CPStatus =
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'PENDING_VERIFICATION'
  | 'UNDER_REVIEW'

export type OnboardingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'COMPLIANCE_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUIRED'

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH'

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

export type LenderType = 'BANK' | 'NBFC' | 'HFC'

export type CodeStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'

export type PayoutModel = 'PERCENTAGE' | 'FLAT' | 'SLAB'

export type DisbursementValidationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED'

export type CommissionStatus = 'PENDING' | 'PROCESSED' | 'PAID' | 'DISPUTED'

export type ReconciliationStatus = 'PENDING' | 'MATCHED' | 'MISMATCH' | 'RESOLVED'

export type SubUserRole = 'FINANCE' | 'COMPLIANCE' | 'OPERATIONS' | 'VIEWER'

export type SubUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export type ReportingMethod = 'MANUAL_ENTRY' | 'FILE_UPLOAD' | 'API'

export type IncomeTaxCategory = 'INDIVIDUAL' | 'HUF' | 'FIRM' | 'COMPANY' | 'LLP'

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
  | 'MOA_AOA'
  | 'BOARD_RESOLUTION'
  | 'MASTER_AGREEMENT'
  | 'TRIPARTITE_AGREEMENT'
  | 'DIGITAL_SIGNATURE'
  | 'CANCELLED_CHEQUE'
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
  | 'DISBURSEMENT_SUBMIT'
  | 'DISBURSEMENT_BULK_UPLOAD'
  | 'PAYOUT_DISPUTE'
  | 'SUBUSER_ADD'
  | 'SUBUSER_REMOVE'
  | 'SESSION_REVOKE'
  | 'IP_WHITELIST_ADD'
  | 'IP_WHITELIST_REMOVE'

export type LoanProductType =
  | 'PERSONAL_LOAN'
  | 'HOME_LOAN'
  | 'BUSINESS_LOAN'
  | 'LAP'
  | 'AUTO_LOAN'
  | 'CREDIT_CARD'
  | 'GOLD_LOAN'
  | 'EDUCATION_LOAN'
  | 'WORKING_CAPITAL'
  | 'MSME_LOAN'
  | 'OTHERS'

// CP Profile Tab IDs
export type CPProfileTab =
  | 'overview'
  | 'personal'
  | 'entity'
  | 'compliance'
  | 'lender-mapping'
  | 'disbursement-config'
  | 'payout'
  | 'access-control'
  | 'notifications'
  | 'agreements'
  | 'activity'

// ============================================
// SECTION INTERFACES
// ============================================

/**
 * Section 1: Identity & Account Overview (System Controlled)
 */
export interface CPAccountOverview {
  cp_id: string // System Generated: CP001, CP002
  partner_nature: PartnerNature // Individual or Business Entity
  registration_status: CPStatus
  onboarding_status: OnboardingStatus
  risk_category: RiskCategory
  date_of_registration: string // ISO DateTime
  last_profile_update: string // ISO DateTime
  profile_completion_percentage: number // 0-100

  // Verification Status
  is_email_verified: boolean
  is_mobile_verified: boolean
  is_kyc_verified: boolean
  is_bank_verified: boolean

  // Summary Metrics
  linked_banks_count: number
  total_disbursement_value: number // Lifetime
  total_disbursement_count: number

  // Source Tracking
  created_by: string // ADMIN / SELF_REGISTRATION / REFERRAL
  created_by_reference: string | null // Admin ID or Referral Code

  // Profile Picture
  profile_photograph_url: string | null
}

/**
 * Section 2: Personal Details (For Individuals)
 */
export interface CPPersonalDetails {
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
 * Section 2B: Entity Details (For Business Entities)
 */
export interface CPEntityDetails {
  legal_entity_name: string
  trade_name: string | null // Brand Name
  entity_type: PartnerEntityType
  date_of_incorporation: string | null // YYYY-MM-DD

  // Registration
  cin_llpin: string | null // CIN or LLPIN or Registration Number
  cin_verification_status: VerificationStatus
  cin_document_url: string | null

  // Business PAN
  business_pan: string | null
  business_pan_verification_status: VerificationStatus
  business_pan_document_url: string | null

  // GST
  gst_applicable: boolean
  gstin: string | null
  gst_verification_status: VerificationStatus
  gst_certificate_url: string | null

  // Entity Documents
  partnership_deed_url: string | null
  llp_agreement_url: string | null
  moa_aoa_url: string | null
  board_resolution_url: string | null

  // Authorized Signatory
  authorized_signatory_name: string | null
  authorized_signatory_designation: string | null
  authorized_signatory_pan: string | null
  authorized_signatory_aadhaar_masked: string | null
  is_signatory_same_as_personal: boolean

  // Registered Office Address
  registered_address_line1: string | null
  registered_address_line2: string | null
  registered_city: string | null
  registered_state: string | null
  registered_pincode: string | null
}

/**
 * Section 3: Compliance & KYC Management
 */
export interface CPComplianceStatus {
  // KYC Status
  pan_verification_status: VerificationStatus
  gst_verification_status: VerificationStatus
  aadhaar_verification_status: VerificationStatus

  // CKYC (Central KYC)
  ckyc_reference: string | null
  ckyc_verification_status: VerificationStatus

  // AML (Anti-Money Laundering)
  aml_risk_score: number // 0-100
  aml_risk_category: RiskCategory
  aml_flags: string[]
  aml_last_checked: string | null

  // Document Expiry Alerts
  expiry_alerts: CPExpiryAlert[]

  // Compliance Items
  compliance_items: CPComplianceItem[]
}

export interface CPComplianceItem {
  compliance_type: string
  reference_number: string | null
  document_url: string | null
  verification_status: VerificationStatus
  verification_method: 'API' | 'MANUAL' | 'SYSTEM' | null
  verified_at: string | null
  valid_from: string | null
  valid_until: string | null
}

export interface CPExpiryAlert {
  document_type: string
  document_name: string
  expiry_date: string
  days_until_expiry: number
  alert_level: 'WARNING' | 'CRITICAL' | 'EXPIRED'
}

/**
 * Section 4: Bank & NBFC Association Mapping (CP-EXCLUSIVE)
 */
export interface CPLenderAssociation {
  id: string
  lender_id: string | null
  lender_name: string
  lender_type: LenderType

  // Agreement Details
  agreement_reference_number: string
  agreement_document_url: string | null
  agreement_signed_date: string | null
  agreement_expiry_date: string | null
  agreement_version: string | null

  // Code Details
  loans360_code: string
  code_activation_date: string
  code_status: CodeStatus
  code_suspension_reason: string | null
  code_suspension_date: string | null

  // Product Configuration
  enabled_products: LoanProductType[]

  // Payout Configuration (view-only)
  payout_model: PayoutModel | null
  payout_percentage: number | null
  payout_flat_amount: number | null
  payout_slabs: CPPayoutSlab[]

  // Performance Metrics
  total_disbursements_count: number
  total_disbursement_value: number
  last_disbursement_date: string | null
  last_disbursement_amount: number | null
}

export interface CPPayoutSlab {
  slab_name: string
  min_amount: number
  max_amount: number | null
  commission_rate: string // e.g., "0.35%", "Rs. 2500"
  bonus_amount: number | null
}

/**
 * Section 5: Disbursement Reporting Configuration (CP-EXCLUSIVE)
 */
export interface CPReportingConfig {
  reporting_method: ReportingMethod
  mandatory_fields: string[]
  reporting_sla_days: number
  late_submission_penalty_percentage: number
  accepted_file_formats: string[]
  validation_rules: CPValidationRule[]
  auto_rejection_summary: CPAutoRejectionSummary
}

export interface CPValidationRule {
  field: string
  rule_type: string
  rule_value: string
  error_message: string
}

export interface CPAutoRejectionSummary {
  period: string // e.g., "Last 30 days"
  duplicate_entries: number
  invalid_loan_numbers: number
  missing_mandatory_fields: number
  other_errors: number
}

/**
 * Section 6: Payout & Financial Profile
 */
export interface CPPayoutConfig {
  // Primary Bank Account
  primary_account: CPBankAccount
  alternate_accounts: CPBankAccount[]

  // Tax Configuration
  tds_applicable: boolean
  tds_percentage: number | null
  gst_on_commission: boolean
  gstin: string | null
  gst_verification_status: VerificationStatus
  income_tax_category: IncomeTaxCategory | null

  // Settlement
  settlement_frequency: SettlementFrequency
  payout_cycle_day: number // Day of month (1-28)

  // Payout Summary (read-only, aggregated)
  payout_summary: CPPayoutSummary | null
}

export interface CPBankAccount {
  id: string
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

  is_primary: boolean
  priority: number

  // Approval tracking
  bank_change_approval_status: ApprovalStatus
  bank_change_requested_at: string | null
}

export interface CPPayoutSummary {
  period: string // e.g., "Last 6 Months"
  total_expected: number
  total_received: number
  total_pending: number
  reconciliation_mismatches: CPReconciliationMismatch[]
}

export interface CPReconciliationMismatch {
  id: string
  lender_name: string
  period: string
  expected_amount: number
  received_amount: number
  difference: number
  status: ReconciliationStatus
  raised_at: string | null
}

/**
 * Section 7: Permissions & Access Control
 */
export interface CPAccessControl {
  // Primary Owner
  primary_owner: CPPrimaryOwner

  // Sub-Users
  sub_users: CPSubUser[]
  max_sub_users: number
  sub_users_enabled: boolean

  // IP Whitelist
  ip_whitelist_enabled: boolean
  ip_whitelist: CPIPWhitelistEntry[]

  // Active Sessions
  active_sessions: CPSession[]
}

export interface CPPrimaryOwner {
  name: string
  email: string
  mobile: string
  last_login_at: string | null
  last_login_location: string | null
  last_login_ip: string | null
}

export interface CPSubUser {
  id: string
  full_name: string
  email: string
  mobile: string | null
  role: SubUserRole
  permissions: string[]
  status: SubUserStatus
  invited_at: string
  accepted_at: string | null
  last_login_at: string | null
}

export interface CPIPWhitelistEntry {
  id: string
  ip_address: string
  ip_range_start: string | null
  ip_range_end: string | null
  description: string | null
  is_active: boolean
  created_at: string
}

export interface CPSession {
  id: string
  session_id: string
  device_type: string | null
  device_name: string | null
  browser: string | null
  os: string | null
  ip_address: string | null
  location: string | null
  is_current: boolean
  last_activity_at: string
  created_at: string
}

/**
 * Section 8: Communication & Notifications
 */
export interface CPNotificationPreferences {
  // Channel Preferences
  email_notifications_enabled: boolean
  sms_alerts_enabled: boolean
  whatsapp_updates_enabled: boolean
  push_notifications_enabled: boolean

  // Alert Categories
  alert_preferences: CPAlertPreference[]

  // Mandatory Reading
  unread_mandatory_items: CPMandatoryReading[]

  // Policy Acknowledgements
  policy_acknowledgements: CPPolicyAcknowledgement[]
}

export interface CPAlertPreference {
  alert_type: string
  email: boolean
  sms: boolean
  whatsapp: boolean
}

export interface CPMandatoryReading {
  id: string
  title: string
  document_url: string
  effective_date: string
  is_read: boolean
  read_at: string | null
}

export interface CPPolicyAcknowledgement {
  policy_type: string
  policy_version: string
  accepted: boolean
  accepted_at: string | null
}

/**
 * Section 9: Legal & Agreements Vault
 */
export interface CPAgreement {
  id: string
  agreement_type: 'MASTER' | 'TRIPARTITE' | 'ADDENDUM' | 'AMENDMENT'
  title: string
  version: string
  lender_name: string | null // Null for master agreement

  document_url: string
  signed: boolean
  signed_date: string | null
  signed_ip: string | null
  signed_by: string | null

  effective_date: string | null
  expiry_date: string | null
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_SIGNATURE' | 'SUPERSEDED'

  created_at: string
}

export interface CPESignHistory {
  id: string
  document_type: string
  document_name: string
  signed_by: string
  signed_at: string
  signed_ip: string
}

/**
 * Section 10: Activity & Audit Timeline
 */
export interface CPAuditLog {
  id: string
  partner_id: string
  action_type: AuditActionType
  action_description: string

  // Field-level tracking
  section: string | null
  field_name: string | null
  old_value: string | null // Masked for sensitive fields
  new_value: string | null // Masked for sensitive fields

  // Actor
  changed_by: string // 'SELF' or user ID
  changed_by_name: string | null

  // Source
  source: 'WEB' | 'MOBILE' | 'API' | 'ADMIN_PORTAL' | 'SYSTEM'
  ip_address: string | null
  user_agent: string | null
  location: string | null

  // Approval
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  approval_remarks: string | null

  // Compliance
  compliance_review_notes: string | null
  system_flags: string[]

  created_at: string
}

/**
 * Documents
 */
export interface CPDocument {
  id: string
  partner_id: string
  document_type: DocumentType
  document_name: string
  file_name: string
  file_url: string
  file_size: number | null
  mime_type: string | null

  verification_status: VerificationStatus
  verified_at: string | null
  verified_by: string | null
  admin_comments: string | null
  rejection_reason: string | null

  expiry_date: string | null
  version: number
  is_latest: boolean

  uploaded_by: string
  created_at: string
  updated_at: string
}

/**
 * Pending Profile Change Requests
 */
export interface CPPendingChange {
  id: string
  section: string
  field_name: string
  old_value: string | null
  new_value: string
  requested_at: string
  requested_reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewed_by: string | null
  reviewed_at: string | null
  review_remarks: string | null
}

// ============================================
// COMPLETE PROFILE DATA STRUCTURE
// ============================================

export interface CPProfileData {
  account: CPAccountOverview
  personal: CPPersonalDetails | null
  entity: CPEntityDetails | null
  compliance: CPComplianceStatus
  lender_associations: CPLenderAssociation[]
  reporting_config: CPReportingConfig
  payout: CPPayoutConfig
  access_control: CPAccessControl
  notifications: CPNotificationPreferences
  agreements: CPAgreement[]
  documents: CPDocument[]
  pending_changes: CPPendingChange[]
  created_at: string
  updated_at: string
}

// ============================================
// FORM DATA INTERFACES (For editing)
// ============================================

export interface CPPersonalDetailsForm {
  full_name: string
  date_of_birth: string
  gender: string
  mobile_number: string
  alternate_mobile: string
  country_code: string
  email_id: string
  pan_number: string
  aadhaar_number: string
  nationality: string
  residential_status: string
  residential_address_line1: string
  residential_address_line2: string
  residential_city: string
  residential_district: string
  residential_state: string
  residential_pincode: string
  address_proof_type: string
}

export interface CPEntityDetailsForm {
  legal_entity_name: string
  trade_name: string
  entity_type: string
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

export interface CPBankDetailsForm {
  account_holder_name: string
  bank_name: string
  branch_name: string
  account_number: string
  confirm_account_number: string
  ifsc_code: string
  micr_code: string
  account_type: string
}

export interface CPPayoutConfigForm {
  tds_applicable: boolean
  gst_on_commission: boolean
  gstin: string
  settlement_frequency: string
}

export interface CPNotificationForm {
  email_notifications_enabled: boolean
  sms_alerts_enabled: boolean
  whatsapp_updates_enabled: boolean
  push_notifications_enabled: boolean
}

export interface CPSubUserForm {
  full_name: string
  email: string
  mobile: string
  role: SubUserRole
  permissions: string[]
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CPProfileResponse {
  success: boolean
  data: CPProfileData
  message?: string
}

export interface CPProfileUpdateRequest {
  section: 'personal' | 'entity' | 'payout' | 'notifications'
  data: Record<string, unknown>
}

export interface CPDisbursementSubmitRequest {
  lender_association_id: string
  loan_account_number: string
  customer_name: string
  disbursement_date: string // YYYY-MM-DD
  disbursement_amount: number
  product_type: LoanProductType
  co_applicant_name?: string
  property_location?: string
  loan_tenure_months?: number
  roi?: number
}

export interface CPDisbursementBulkUploadResponse {
  success: boolean
  total_records: number
  validated: number
  rejected: number
  errors: Array<{
    row: number
    field: string
    error: string
  }>
}

export interface CPReconciliationDisputeRequest {
  reconciliation_id: string
  dispute_reason: string
  supporting_documents?: string[]
}

// ============================================
// CONSTANTS
// ============================================

export const PARTNER_NATURE_LABELS: Record<PartnerNature, string> = {
  INDIVIDUAL: 'Individual',
  BUSINESS_ENTITY: 'Business Entity',
}

export const CP_STATUS_LABELS: Record<CPStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  PENDING_VERIFICATION: 'Pending Verification',
  UNDER_REVIEW: 'Under Review',
}

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  LOW: 'Low Risk',
  MEDIUM: 'Medium Risk',
  HIGH: 'High Risk',
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  REJECTED: 'Rejected',
}

export const LENDER_TYPE_LABELS: Record<LenderType, string> = {
  BANK: 'Bank',
  NBFC: 'NBFC',
  HFC: 'Housing Finance Company',
}

export const CODE_STATUS_LABELS: Record<CodeStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
}

export const PAYOUT_MODEL_LABELS: Record<PayoutModel, string> = {
  PERCENTAGE: 'Percentage Based',
  FLAT: 'Flat Amount',
  SLAB: 'Slab Based',
}

export const SUBUSER_ROLE_LABELS: Record<SubUserRole, string> = {
  FINANCE: 'Finance',
  COMPLIANCE: 'Compliance',
  OPERATIONS: 'Operations',
  VIEWER: 'Viewer',
}

export const REPORTING_METHOD_LABELS: Record<ReportingMethod, string> = {
  MANUAL_ENTRY: 'Manual Entry',
  FILE_UPLOAD: 'File Upload',
  API: 'API Integration',
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
  WORKING_CAPITAL: 'Working Capital',
  MSME_LOAN: 'MSME Loan',
  OTHERS: 'Others',
}

export const SETTLEMENT_FREQUENCY_LABELS: Record<SettlementFrequency, string> = {
  WEEKLY: 'Weekly',
  BI_WEEKLY: 'Bi-Weekly',
  MONTHLY: 'Monthly',
  ON_DEMAND: 'On Demand',
}

// Default empty values for forms
export const DEFAULT_CP_PERSONAL_DETAILS: CPPersonalDetailsForm = {
  full_name: '',
  date_of_birth: '',
  gender: '',
  mobile_number: '',
  alternate_mobile: '',
  country_code: '+91',
  email_id: '',
  pan_number: '',
  aadhaar_number: '',
  nationality: 'Indian',
  residential_status: 'RESIDENT',
  residential_address_line1: '',
  residential_address_line2: '',
  residential_city: '',
  residential_district: '',
  residential_state: '',
  residential_pincode: '',
  address_proof_type: '',
}

export const DEFAULT_CP_ENTITY_DETAILS: CPEntityDetailsForm = {
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

export const DEFAULT_CP_BANK_DETAILS: CPBankDetailsForm = {
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  confirm_account_number: '',
  ifsc_code: '',
  micr_code: '',
  account_type: 'SAVINGS',
}

// ============================================
// PERMISSIONS (For RBAC)
// ============================================

export enum CPPermission {
  // Profile
  PROFILE_VIEW = 'cp.profile.view',
  PROFILE_EDIT = 'cp.profile.edit',
  PROFILE_EDIT_SENSITIVE = 'cp.profile.edit_sensitive',

  // Lender Associations
  LENDER_VIEW = 'cp.lender.view',
  LENDER_VIEW_PAYOUT = 'cp.lender.view_payout',

  // Disbursements
  DISBURSEMENT_VIEW = 'cp.disbursement.view',
  DISBURSEMENT_SUBMIT = 'cp.disbursement.submit',
  DISBURSEMENT_BULK_UPLOAD = 'cp.disbursement.bulk_upload',

  // Payout
  PAYOUT_VIEW = 'cp.payout.view',
  PAYOUT_VIEW_DETAILED = 'cp.payout.view_detailed',
  PAYOUT_RAISE_DISPUTE = 'cp.payout.raise_dispute',

  // Sub-Users
  SUBUSER_VIEW = 'cp.subuser.view',
  SUBUSER_MANAGE = 'cp.subuser.manage',

  // Security
  SECURITY_VIEW = 'cp.security.view',
  SECURITY_MANAGE = 'cp.security.manage',
  SESSION_REVOKE = 'cp.session.revoke',

  // Documents
  DOCUMENT_VIEW = 'cp.document.view',
  DOCUMENT_UPLOAD = 'cp.document.upload',
  DOCUMENT_DELETE = 'cp.document.delete',

  // Audit
  AUDIT_VIEW = 'cp.audit.view',
  AUDIT_EXPORT = 'cp.audit.export',
  COMPLIANCE_REPORT = 'cp.compliance.report',
}

// Role-Permission mapping
export const SUBUSER_ROLE_PERMISSIONS: Record<SubUserRole, CPPermission[]> = {
  FINANCE: [
    CPPermission.PROFILE_VIEW,
    CPPermission.LENDER_VIEW,
    CPPermission.LENDER_VIEW_PAYOUT,
    CPPermission.DISBURSEMENT_VIEW,
    CPPermission.PAYOUT_VIEW,
    CPPermission.PAYOUT_VIEW_DETAILED,
    CPPermission.PAYOUT_RAISE_DISPUTE,
    CPPermission.DOCUMENT_VIEW,
    CPPermission.AUDIT_VIEW,
    CPPermission.AUDIT_EXPORT,
  ],
  COMPLIANCE: [
    CPPermission.PROFILE_VIEW,
    CPPermission.LENDER_VIEW,
    CPPermission.DISBURSEMENT_VIEW,
    CPPermission.DOCUMENT_VIEW,
    CPPermission.DOCUMENT_UPLOAD,
    CPPermission.AUDIT_VIEW,
    CPPermission.AUDIT_EXPORT,
    CPPermission.COMPLIANCE_REPORT,
  ],
  OPERATIONS: [
    CPPermission.PROFILE_VIEW,
    CPPermission.LENDER_VIEW,
    CPPermission.DISBURSEMENT_VIEW,
    CPPermission.DISBURSEMENT_SUBMIT,
    CPPermission.DISBURSEMENT_BULK_UPLOAD,
    CPPermission.DOCUMENT_VIEW,
    CPPermission.AUDIT_VIEW,
  ],
  VIEWER: [
    CPPermission.PROFILE_VIEW,
    CPPermission.LENDER_VIEW,
    CPPermission.DISBURSEMENT_VIEW,
    CPPermission.DOCUMENT_VIEW,
    CPPermission.AUDIT_VIEW,
  ],
}
