
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type {
  CPProfileData,
  CPAccountOverview,
  CPPersonalDetails,
  CPEntityDetails,
  CPComplianceStatus,
  CPLenderAssociation,
  CPReportingConfig,
  CPPayoutConfig,
  CPAccessControl,
  CPNotificationPreferences,
  CPAgreement,
  CPDocument,
  CPPendingChange,
  PartnerNature,
  VerificationStatus,
  CPStatus,
  OnboardingStatus,
  RiskCategory,
  SettlementFrequency,
  ReportingMethod,
} from '@/types/cp-profile'
import { apiLogger } from '@/lib/utils/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Generic database row from Supabase queries */
type DBRow = Record<string, unknown>

/** Expiry alert shape */
interface ExpiryAlert {
  document_type: unknown
  document_name: unknown
  expiry_date: unknown
  days_until_expiry: number
  alert_level: 'EXPIRED' | 'CRITICAL' | 'WARNING'
}

/**
 * GET /api/partners/cp/profile/enhanced
 * Fetches comprehensive CP (Channel Partner) profile with all sections
 *
 * Channel Partner Role:
 * - Independently sources, processes, and disburses loans
 * - Uses Loans360 company code with Banks & NBFCs
 * - Reports post-disbursement data into Loans360
 * - Claims payouts/commissions for disbursements
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError && partnerError.code !== 'PGRST116') {
      apiLogger.error('Error fetching CP profile', partnerError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // If no partner profile exists, return empty profile structure
    if (!partner) {
      return NextResponse.json({
        success: true,
        data: buildEmptyProfile(user),
        message: 'No profile found. Please complete your profile.'
      })
    }

    // Fetch all CP-specific related data in parallel
    const [
      lenderAssociationsResult,
      complianceResult,
      subUsersResult,
      ipWhitelistResult,
      sessionsResult,
      agreementsResult,
      documentsResult,
      pendingChangesResult,
      notificationPrefsResult,
      auditSummaryResult
    ] = await Promise.all([
      // Lender associations
      supabase
        .from('cp_lender_associations')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),

      // Compliance tracking
      supabase
        .from('cp_compliance_tracking')
        .select('*')
        .eq('partner_id', partner.id),

      // Sub-users
      supabase
        .from('cp_sub_users')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),

      // IP whitelist
      supabase
        .from('cp_ip_whitelist')
        .select('*')
        .eq('partner_id', partner.id)
        .eq('is_active', true),

      // Active sessions (mock - would come from auth provider)
      Promise.resolve({ data: [] }),

      // Agreements
      supabase
        .from('cp_agreements')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),

      // Documents
      supabase
        .from('partner_documents')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false }),

      // Pending change requests
      supabase
        .from('partner_profile_change_requests')
        .select('*')
        .eq('partner_id', partner.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false }),

      // Notification preferences
      supabase
        .from('cp_notification_preferences')
        .select('*')
        .eq('partner_id', partner.id)
        .maybeSingle(),

      // Audit summary (last 30 days count)
      supabase
        .from('cp_audit_logs')
        .select('id', { count: 'exact' })
        .eq('partner_id', partner.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

    // Calculate disbursement metrics
    const { data: disbursementMetrics } = await supabase
      .rpc('get_cp_disbursement_metrics', { cp_partner_id: partner.id })
      .maybeSingle()

    // Build comprehensive profile response
    const profileData = buildProfileData(
      partner,
      user,
      lenderAssociationsResult.data || [],
      complianceResult.data || [],
      subUsersResult.data || [],
      ipWhitelistResult.data || [],
      sessionsResult.data || [],
      agreementsResult.data || [],
      documentsResult.data || [],
      pendingChangesResult.data || [],
      notificationPrefsResult.data,
      disbursementMetrics
    )

    return NextResponse.json({
      success: true,
      data: profileData
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/cp/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/cp/profile/enhanced
 * Updates CP partner profile with section-specific data
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { section, data: updateData } = body

    if (!section || !updateData) {
      return NextResponse.json(
        { success: false, error: 'Missing section or data in request body' },
        { status: 400 }
      )
    }

    // Check if profile exists
    const { data: existingPartner, error: findError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (findError && findError.code !== 'PGRST116') {
      apiLogger.error('Error finding CP profile', findError)
      return NextResponse.json(
        { success: false, error: 'Failed to find profile' },
        { status: 500 }
      )
    }

    // Build update payload based on section
    const updatePayload = buildUpdatePayload(section, updateData, user)

    if (!updatePayload) {
      return NextResponse.json(
        { success: false, error: 'Invalid section specified' },
        { status: 400 }
      )
    }

    // Check if update requires approval (sensitive fields)
    const requiresApproval = checkIfRequiresApproval(section, updateData)

    if (requiresApproval && existingPartner) {
      // Create change request instead of direct update
      const { data: changeRequest, error: changeError } = await supabase
        .from('partner_profile_change_requests')
        .insert({
          partner_id: existingPartner.id,
          section: section,
          field_changes: updateData,
          status: 'PENDING',
          requested_at: new Date().toISOString(),
          requested_by: user.id
        })
        .select()
        .maybeSingle()

      if (changeError) {
        apiLogger.error('Error creating change request', changeError)
        return NextResponse.json(
          { success: false, error: 'Failed to create change request' },
          { status: 500 }
        )
      }

      // Log audit trail
      await logAuditEntry(
        supabase,
        existingPartner.id,
        'UPDATE',
        section,
        'Change request created for approval',
        user.id,
        request
      )

      return NextResponse.json({
        success: true,
        message: 'Your changes have been submitted for approval',
        requires_approval: true,
        change_request_id: changeRequest.id
      })
    }

    // Perform direct update
    let result
    if (existingPartner) {
      // Update existing profile
      const { data, error } = await supabase
        .from('partners')
        .update({
          ...updatePayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPartner.id)
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error updating CP profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile'},
          { status: 500 }
        )
      }
      result = data
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('partners')
        .insert({
          user_id: user.id,
          partner_type: 'CHANNEL_PARTNER',
          ...updatePayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error creating CP profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile'},
          { status: 500 }
        )
      }
      result = data
    }

    // Log audit trail
    await logAuditEntry(
      supabase,
      result.id,
      existingPartner ? 'UPDATE' : 'CREATE',
      section,
      `Profile ${section} ${existingPartner ? 'updated' : 'created'}`,
      user.id,
      request
    )

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: { partner_id: result.partner_id }
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/cp/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build empty profile structure for new users
 */
function buildEmptyProfile(user: DBRow): Partial<CPProfileData> {
  const now = new Date().toISOString()

  return {
    account: {
      cp_id: '',
      partner_nature: 'INDIVIDUAL' as PartnerNature,
      registration_status: 'PENDING_VERIFICATION' as CPStatus,
      onboarding_status: 'DRAFT' as OnboardingStatus,
      risk_category: 'LOW' as RiskCategory,
      date_of_registration: now,
      last_profile_update: now,
      profile_completion_percentage: 0,
      is_email_verified: !!user.email_confirmed_at,
      is_mobile_verified: false,
      is_kyc_verified: false,
      is_bank_verified: false,
      linked_banks_count: 0,
      total_disbursement_value: 0,
      total_disbursement_count: 0,
      created_by: 'SELF_REGISTRATION',
      created_by_reference: null,
      profile_photograph_url: null
    },
    personal: {
      full_name: user.user_metadata?.full_name || '',
      date_of_birth: null,
      gender: null,
      mobile_number: '',
      mobile_verified: false,
      mobile_verified_at: null,
      alternate_mobile: null,
      country_code: '+91',
      email_id: user.email || '',
      email_verified: !!user.email_confirmed_at,
      email_verified_at: user.email_confirmed_at || null,
      pan_number: null,
      pan_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      pan_document_url: null,
      pan_verified_at: null,
      aadhaar_number_masked: null,
      aadhaar_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      aadhaar_document_url: null,
      nationality: 'Indian',
      residential_status: 'RESIDENT',
      residential_address_line1: '',
      residential_address_line2: null,
      residential_city: '',
      residential_district: '',
      residential_state: '',
      residential_state_code: '',
      residential_pincode: '',
      residential_country: 'India',
      address_proof_type: null,
      address_proof_url: null,
      address_verification_status: 'NOT_SUBMITTED' as VerificationStatus
    },
    entity: null,
    compliance: {
      pan_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      gst_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      aadhaar_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      ckyc_reference: null,
      ckyc_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      aml_risk_score: 0,
      aml_risk_category: 'LOW' as RiskCategory,
      aml_flags: [],
      aml_last_checked: null,
      expiry_alerts: [],
      compliance_items: []
    },
    lender_associations: [],
    reporting_config: {
      reporting_method: 'MANUAL_ENTRY' as ReportingMethod,
      mandatory_fields: [
        'loan_account_number',
        'customer_name',
        'disbursement_date',
        'disbursement_amount',
        'product_type'
      ],
      reporting_sla_days: 7,
      late_submission_penalty_percentage: 0,
      accepted_file_formats: ['xlsx', 'csv'],
      validation_rules: [],
      auto_rejection_summary: {
        period: 'Last 30 days',
        duplicate_entries: 0,
        invalid_loan_numbers: 0,
        missing_mandatory_fields: 0,
        other_errors: 0
      }
    },
    payout: {
      primary_account: {
        id: '',
        account_holder_name: '',
        bank_name: '',
        branch_name: '',
        account_number: '',
        account_number_masked: '',
        ifsc_code: '',
        micr_code: null,
        account_type: 'SAVINGS',
        cancelled_cheque_url: null,
        bank_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
        bank_verification_method: null,
        bank_verified_at: null,
        is_primary: true,
        priority: 1,
        bank_change_approval_status: 'NOT_REQUIRED',
        bank_change_requested_at: null
      },
      alternate_accounts: [],
      tds_applicable: true,
      tds_percentage: 5,
      gst_on_commission: false,
      gstin: null,
      gst_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      income_tax_category: null,
      settlement_frequency: 'MONTHLY' as SettlementFrequency,
      payout_cycle_day: 15,
      payout_summary: null
    },
    access_control: {
      primary_owner: {
        name: user.user_metadata?.full_name || '',
        email: user.email || '',
        mobile: '',
        last_login_at: null,
        last_login_location: null,
        last_login_ip: null
      },
      sub_users: [],
      max_sub_users: 5,
      sub_users_enabled: true,
      ip_whitelist_enabled: false,
      ip_whitelist: [],
      active_sessions: []
    },
    notifications: {
      email_notifications_enabled: true,
      sms_alerts_enabled: true,
      whatsapp_updates_enabled: false,
      push_notifications_enabled: true,
      alert_preferences: [
        { alert_type: 'DISBURSEMENT_VALIDATED', email: true, sms: true, whatsapp: false },
        { alert_type: 'DISBURSEMENT_REJECTED', email: true, sms: true, whatsapp: false },
        { alert_type: 'PAYOUT_PROCESSED', email: true, sms: true, whatsapp: false },
        { alert_type: 'DOCUMENT_EXPIRY', email: true, sms: false, whatsapp: false },
        { alert_type: 'COMPLIANCE_ALERT', email: true, sms: true, whatsapp: false }
      ],
      unread_mandatory_items: [],
      policy_acknowledgements: []
    },
    agreements: [],
    documents: [],
    pending_changes: [],
    created_at: now,
    updated_at: now
  }
}

/**
 * Build profile data from database records
 */
function buildProfileData(
  partner: DBRow,
  user: DBRow,
  lenderAssociations: DBRow[],
  complianceItems: DBRow[],
  subUsers: DBRow[],
  ipWhitelist: DBRow[],
  sessions: DBRow[],
  agreements: DBRow[],
  documents: DBRow[],
  pendingChanges: DBRow[],
  notificationPrefs: DBRow | null,
  disbursementMetrics: DBRow | null
): Partial<CPProfileData> {
  // Parse JSON fields safely
  const parseJsonArray = (field: unknown): unknown[] => {
    if (!field) return []
    if (Array.isArray(field)) return field
    try {
      return JSON.parse(field)
    } catch {
      return []
    }
  }

  // Calculate profile completion percentage
  const completionPercentage = calculateProfileCompletion(partner)

  // Build lender associations with computed metrics
  const formattedLenderAssociations: CPLenderAssociation[] = (lenderAssociations || []).map((la: DBRow) => ({
    id: la.id,
    lender_id: la.lender_id,
    lender_name: la.lender_name,
    lender_type: la.lender_type,
    agreement_reference_number: la.agreement_reference_number || '',
    agreement_document_url: la.agreement_document_url,
    agreement_signed_date: la.agreement_signed_date,
    agreement_expiry_date: la.agreement_expiry_date,
    agreement_version: la.agreement_version,
    loans360_code: la.loans360_code || '',
    code_activation_date: la.code_activation_date,
    code_status: la.code_status || 'ACTIVE',
    code_suspension_reason: la.code_suspension_reason,
    code_suspension_date: la.code_suspension_date,
    enabled_products: parseJsonArray(la.enabled_products),
    payout_model: la.payout_model,
    payout_percentage: la.payout_percentage,
    payout_flat_amount: la.payout_flat_amount,
    payout_slabs: parseJsonArray(la.payout_slabs),
    total_disbursements_count: la.total_disbursements_count || 0,
    total_disbursement_value: la.total_disbursement_value || 0,
    last_disbursement_date: la.last_disbursement_date,
    last_disbursement_amount: la.last_disbursement_amount
  }))

  return {
    account: {
      cp_id: partner.partner_id || '',
      partner_nature: (partner.partner_nature || 'INDIVIDUAL') as PartnerNature,
      registration_status: (partner.status || 'PENDING_VERIFICATION') as CPStatus,
      onboarding_status: (partner.onboarding_status || 'DRAFT') as OnboardingStatus,
      risk_category: (partner.risk_category || 'LOW') as RiskCategory,
      date_of_registration: partner.created_at,
      last_profile_update: partner.updated_at,
      profile_completion_percentage: completionPercentage,
      is_email_verified: !!partner.email_verified_at || !!user.email_confirmed_at,
      is_mobile_verified: !!partner.mobile_verified_at,
      is_kyc_verified: partner.pan_verification_status === 'VERIFIED' && partner.aadhaar_verification_status === 'VERIFIED',
      is_bank_verified: partner.bank_verification_status === 'VERIFIED',
      linked_banks_count: formattedLenderAssociations.filter(la => la.code_status === 'ACTIVE').length,
      total_disbursement_value: disbursementMetrics?.total_value || 0,
      total_disbursement_count: disbursementMetrics?.total_count || 0,
      created_by: partner.created_by || 'SELF_REGISTRATION',
      created_by_reference: partner.created_by_reference,
      profile_photograph_url: partner.profile_picture_url
    },
    personal: {
      full_name: partner.full_name || '',
      date_of_birth: partner.date_of_birth,
      gender: partner.gender,
      mobile_number: partner.mobile_number || '',
      mobile_verified: !!partner.mobile_verified_at,
      mobile_verified_at: partner.mobile_verified_at,
      alternate_mobile: partner.alternate_mobile,
      country_code: partner.country_code || '+91',
      email_id: partner.work_email || user.email || '',
      email_verified: !!partner.email_verified_at || !!user.email_confirmed_at,
      email_verified_at: partner.email_verified_at || user.email_confirmed_at,
      pan_number: partner.pan_number,
      pan_verification_status: (partner.pan_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      pan_document_url: partner.pan_document_url,
      pan_verified_at: partner.pan_verified_at,
      aadhaar_number_masked: partner.aadhaar_number_masked,
      aadhaar_verification_status: (partner.aadhaar_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      aadhaar_document_url: partner.aadhaar_document_url,
      nationality: partner.nationality || 'Indian',
      residential_status: partner.residential_status || 'RESIDENT',
      residential_address_line1: partner.present_address || '',
      residential_address_line2: partner.present_address_line2,
      residential_city: partner.city || '',
      residential_district: partner.district || '',
      residential_state: partner.state_name || '',
      residential_state_code: partner.state_code || '',
      residential_pincode: partner.pincode || '',
      residential_country: 'India',
      address_proof_type: partner.present_address_proof_type,
      address_proof_url: partner.present_address_proof_url,
      address_verification_status: (partner.address_verification_status || 'NOT_SUBMITTED') as VerificationStatus
    },
    entity: partner.partner_nature === 'BUSINESS_ENTITY' ? {
      legal_entity_name: partner.legal_entity_name || '',
      trade_name: partner.trade_name,
      entity_type: partner.entity_type || 'PROPRIETORSHIP',
      date_of_incorporation: partner.date_of_incorporation,
      cin_llpin: partner.cin_llpin,
      cin_verification_status: (partner.cin_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      cin_document_url: partner.cin_document_url,
      business_pan: partner.business_pan,
      business_pan_verification_status: (partner.business_pan_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      business_pan_document_url: partner.business_pan_document_url,
      gst_applicable: partner.gst_applicable || false,
      gstin: partner.business_gstin,
      gst_verification_status: (partner.business_gst_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      gst_certificate_url: partner.business_gst_certificate_url,
      partnership_deed_url: partner.partnership_deed_url,
      llp_agreement_url: partner.llp_agreement_url,
      moa_aoa_url: partner.moa_aoa_url,
      board_resolution_url: partner.board_resolution_url,
      authorized_signatory_name: partner.authorized_signatory_name,
      authorized_signatory_designation: partner.authorized_signatory_designation,
      authorized_signatory_pan: partner.authorized_signatory_pan,
      authorized_signatory_aadhaar_masked: partner.authorized_signatory_aadhaar_masked,
      is_signatory_same_as_personal: partner.is_signatory_same_as_personal || false,
      registered_address_line1: partner.registered_address_line1,
      registered_address_line2: partner.registered_address_line2,
      registered_city: partner.registered_city,
      registered_state: partner.registered_state,
      registered_pincode: partner.registered_pincode
    } : null,
    compliance: {
      pan_verification_status: (partner.pan_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      gst_verification_status: (partner.gst_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      aadhaar_verification_status: (partner.aadhaar_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      ckyc_reference: partner.ckyc_reference,
      ckyc_verification_status: (partner.ckyc_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      aml_risk_score: partner.aml_risk_score || 0,
      aml_risk_category: (partner.aml_risk_category || 'LOW') as RiskCategory,
      aml_flags: parseJsonArray(partner.aml_flags),
      aml_last_checked: partner.aml_last_checked,
      expiry_alerts: buildExpiryAlerts(partner, documents),
      compliance_items: (complianceItems || []).map((ci: DBRow) => ({
        compliance_type: ci.compliance_type,
        reference_number: ci.reference_number,
        document_url: ci.document_url,
        verification_status: ci.verification_status,
        verification_method: ci.verification_method,
        verified_at: ci.verified_at,
        valid_from: ci.valid_from,
        valid_until: ci.valid_until
      }))
    },
    lender_associations: formattedLenderAssociations,
    reporting_config: {
      reporting_method: (partner.reporting_method || 'MANUAL_ENTRY') as ReportingMethod,
      mandatory_fields: parseJsonArray(partner.reporting_mandatory_fields) || [
        'loan_account_number',
        'customer_name',
        'disbursement_date',
        'disbursement_amount',
        'product_type'
      ],
      reporting_sla_days: partner.reporting_sla_days || 7,
      late_submission_penalty_percentage: partner.late_submission_penalty || 0,
      accepted_file_formats: ['xlsx', 'csv'],
      validation_rules: parseJsonArray(partner.validation_rules),
      auto_rejection_summary: {
        period: 'Last 30 days',
        duplicate_entries: disbursementMetrics?.duplicate_count || 0,
        invalid_loan_numbers: disbursementMetrics?.invalid_loan_count || 0,
        missing_mandatory_fields: disbursementMetrics?.missing_fields_count || 0,
        other_errors: disbursementMetrics?.other_errors_count || 0
      }
    },
    payout: {
      primary_account: {
        id: partner.id || '',
        account_holder_name: partner.account_holder_name || '',
        bank_name: partner.bank_name || '',
        branch_name: partner.branch_name || '',
        account_number: partner.account_number || '',
        account_number_masked: maskAccountNumber(partner.account_number),
        ifsc_code: partner.ifsc_code || '',
        micr_code: partner.micr_code,
        account_type: partner.account_type || 'SAVINGS',
        cancelled_cheque_url: partner.cancelled_cheque_url,
        bank_verification_status: (partner.bank_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
        bank_verification_method: partner.bank_verification_method,
        bank_verified_at: partner.bank_verified_at,
        is_primary: true,
        priority: 1,
        bank_change_approval_status: partner.bank_change_approval_status || 'NOT_REQUIRED',
        bank_change_requested_at: partner.bank_change_requested_at
      },
      alternate_accounts: [],
      tds_applicable: partner.tds_applicable ?? true,
      tds_percentage: partner.tds_percentage || 5,
      gst_on_commission: partner.gst_on_commission || false,
      gstin: partner.gstin,
      gst_verification_status: (partner.gst_verification_status || 'NOT_SUBMITTED') as VerificationStatus,
      income_tax_category: partner.income_tax_category,
      settlement_frequency: (partner.settlement_frequency || 'MONTHLY') as SettlementFrequency,
      payout_cycle_day: partner.payout_cycle_day || 15,
      payout_summary: disbursementMetrics ? {
        period: 'Last 6 Months',
        total_expected: disbursementMetrics.total_expected || 0,
        total_received: disbursementMetrics.total_received || 0,
        total_pending: disbursementMetrics.total_pending || 0,
        reconciliation_mismatches: []
      } : null
    },
    access_control: {
      primary_owner: {
        name: partner.full_name || user.user_metadata?.full_name || '',
        email: partner.work_email || user.email || '',
        mobile: partner.mobile_number || '',
        last_login_at: partner.last_login_at,
        last_login_location: partner.last_login_location,
        last_login_ip: partner.last_login_ip
      },
      sub_users: (subUsers || []).map((su: DBRow) => ({
        id: su.id,
        full_name: su.full_name,
        email: su.email,
        mobile: su.mobile,
        role: su.role,
        permissions: parseJsonArray(su.permissions),
        status: su.status,
        invited_at: su.invited_at,
        accepted_at: su.accepted_at,
        last_login_at: su.last_login_at
      })),
      max_sub_users: 5,
      sub_users_enabled: true,
      ip_whitelist_enabled: partner.ip_whitelist_enabled || false,
      ip_whitelist: (ipWhitelist || []).map((ip: DBRow) => ({
        id: ip.id,
        ip_address: ip.ip_address,
        ip_range_start: ip.ip_range_start,
        ip_range_end: ip.ip_range_end,
        description: ip.description,
        is_active: ip.is_active,
        created_at: ip.created_at
      })),
      active_sessions: (sessions || []).map((s: DBRow) => ({
        id: s.id,
        session_id: s.session_id,
        device_type: s.device_type,
        device_name: s.device_name,
        browser: s.browser,
        os: s.os,
        ip_address: s.ip_address,
        location: s.location,
        is_current: s.is_current,
        last_activity_at: s.last_activity_at,
        created_at: s.created_at
      }))
    },
    notifications: notificationPrefs ? {
      email_notifications_enabled: notificationPrefs.email_enabled ?? true,
      sms_alerts_enabled: notificationPrefs.sms_enabled ?? true,
      whatsapp_updates_enabled: notificationPrefs.whatsapp_enabled ?? false,
      push_notifications_enabled: notificationPrefs.push_enabled ?? true,
      alert_preferences: parseJsonArray(notificationPrefs.alert_preferences) || [
        { alert_type: 'DISBURSEMENT_VALIDATED', email: true, sms: true, whatsapp: false },
        { alert_type: 'DISBURSEMENT_REJECTED', email: true, sms: true, whatsapp: false },
        { alert_type: 'PAYOUT_PROCESSED', email: true, sms: true, whatsapp: false }
      ],
      unread_mandatory_items: [],
      policy_acknowledgements: []
    } : {
      email_notifications_enabled: true,
      sms_alerts_enabled: true,
      whatsapp_updates_enabled: false,
      push_notifications_enabled: true,
      alert_preferences: [
        { alert_type: 'DISBURSEMENT_VALIDATED', email: true, sms: true, whatsapp: false },
        { alert_type: 'DISBURSEMENT_REJECTED', email: true, sms: true, whatsapp: false },
        { alert_type: 'PAYOUT_PROCESSED', email: true, sms: true, whatsapp: false }
      ],
      unread_mandatory_items: [],
      policy_acknowledgements: []
    },
    agreements: (agreements || []).map((a: DBRow) => ({
      id: a.id,
      agreement_type: a.agreement_type,
      title: a.title,
      version: a.version,
      lender_name: a.lender_name,
      document_url: a.document_url,
      signed: a.signed,
      signed_date: a.signed_date,
      signed_ip: a.signed_ip,
      signed_by: a.signed_by,
      effective_date: a.effective_date,
      expiry_date: a.expiry_date,
      status: a.status,
      created_at: a.created_at
    })),
    documents: (documents || []).map((doc: DBRow) => ({
      id: doc.id,
      partner_id: doc.partner_id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      verification_status: doc.verification_status || 'NOT_SUBMITTED',
      verified_at: doc.verified_at,
      verified_by: doc.verified_by,
      admin_comments: doc.admin_comments,
      rejection_reason: doc.rejection_reason,
      expiry_date: doc.expiry_date,
      version: doc.version || 1,
      is_latest: doc.is_latest ?? true,
      uploaded_by: doc.uploaded_by === user.id ? 'SELF' : doc.uploaded_by,
      created_at: doc.created_at,
      updated_at: doc.updated_at
    })),
    pending_changes: (pendingChanges || []).map((change: DBRow) => ({
      id: change.id,
      section: change.section,
      field_name: change.field_name,
      old_value: change.old_value,
      new_value: change.new_value,
      requested_at: change.requested_at,
      requested_reason: change.requested_reason,
      status: change.status,
      reviewed_by: change.reviewed_by,
      reviewed_at: change.reviewed_at,
      review_remarks: change.review_remarks
    })),
    created_at: partner.created_at,
    updated_at: partner.updated_at
  }
}

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(partner: DBRow): number {
  const requiredFields = [
    'full_name',
    'mobile_number',
    'work_email',
    'pan_number',
    'present_address',
    'state_name',
    'pincode',
    'bank_name',
    'account_number',
    'ifsc_code',
    'account_holder_name'
  ]

  const completedFields = requiredFields.filter(field => {
    const value = partner[field]
    return value && value.toString().trim() !== ''
  })

  return Math.round((completedFields.length / requiredFields.length) * 100)
}

/**
 * Build expiry alerts from documents
 */
function buildExpiryAlerts(partner: DBRow, documents: DBRow[]): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = []
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Check documents with expiry dates
  for (const doc of documents || []) {
    if (doc.expiry_date) {
      const expiryDate = new Date(doc.expiry_date)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      if (expiryDate < now) {
        alerts.push({
          document_type: doc.document_type,
          document_name: doc.document_name,
          expiry_date: doc.expiry_date,
          days_until_expiry: daysUntilExpiry,
          alert_level: 'EXPIRED'
        })
      } else if (expiryDate < sevenDaysFromNow) {
        alerts.push({
          document_type: doc.document_type,
          document_name: doc.document_name,
          expiry_date: doc.expiry_date,
          days_until_expiry: daysUntilExpiry,
          alert_level: 'CRITICAL'
        })
      } else if (expiryDate < thirtyDaysFromNow) {
        alerts.push({
          document_type: doc.document_type,
          document_name: doc.document_name,
          expiry_date: doc.expiry_date,
          days_until_expiry: daysUntilExpiry,
          alert_level: 'WARNING'
        })
      }
    }
  }

  return alerts.sort((a, b) => a.days_until_expiry - b.days_until_expiry)
}

/**
 * Mask account number for display
 */
function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber || accountNumber.length < 4) return ''
  return 'XXXX' + accountNumber.slice(-4)
}

/**
 * Build update payload based on section
 */
function buildUpdatePayload(section: string, data: DBRow, user: DBRow): Record<string, unknown> | null {
  switch (section) {
    case 'personal':
      return {
        full_name: data.full_name,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        mobile_number: data.mobile_number,
        alternate_mobile: data.alternate_mobile,
        country_code: data.country_code || '+91',
        work_email: data.email_id || user.email,
        nationality: data.nationality || 'Indian',
        residential_status: data.residential_status,
        pan_number: data.pan_number?.toUpperCase(),
        present_address: data.residential_address_line1,
        present_address_line2: data.residential_address_line2,
        city: data.residential_city,
        district: data.residential_district,
        state_name: data.residential_state,
        state_code: data.residential_state_code,
        pincode: data.residential_pincode,
        present_address_proof_type: data.address_proof_type
      }

    case 'entity':
      return {
        partner_nature: 'BUSINESS_ENTITY',
        legal_entity_name: data.legal_entity_name,
        trade_name: data.trade_name,
        entity_type: data.entity_type,
        date_of_incorporation: data.date_of_incorporation,
        cin_llpin: data.cin_llpin?.toUpperCase(),
        business_pan: data.business_pan?.toUpperCase(),
        gst_applicable: data.gst_applicable,
        business_gstin: data.gstin?.toUpperCase(),
        authorized_signatory_name: data.authorized_signatory_name,
        authorized_signatory_designation: data.authorized_signatory_designation,
        authorized_signatory_pan: data.authorized_signatory_pan?.toUpperCase(),
        is_signatory_same_as_personal: data.is_signatory_same_as_personal,
        registered_address_line1: data.registered_address_line1,
        registered_address_line2: data.registered_address_line2,
        registered_city: data.registered_city,
        registered_state: data.registered_state,
        registered_pincode: data.registered_pincode
      }

    case 'payout':
      return {
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        branch_name: data.branch_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code?.toUpperCase(),
        micr_code: data.micr_code,
        account_type: data.account_type,
        settlement_frequency: data.settlement_frequency,
        gst_on_commission: data.gst_on_commission,
        gstin: data.gstin?.toUpperCase(),
        tds_applicable: data.tds_applicable,
        income_tax_category: data.income_tax_category
      }

    case 'notifications':
      return {
        email_notifications_enabled: data.email_notifications_enabled,
        sms_alerts_enabled: data.sms_alerts_enabled,
        whatsapp_updates_enabled: data.whatsapp_updates_enabled,
        push_notifications_enabled: data.push_notifications_enabled
      }

    case 'security':
      return {
        two_factor_enabled: data.two_factor_enabled,
        two_factor_method: data.two_factor_method,
        login_alerts_enabled: data.login_alerts_enabled,
        ip_whitelist_enabled: data.ip_whitelist_enabled
      }

    case 'partner-nature':
      return {
        partner_nature: data.partner_nature
      }

    default:
      return null
  }
}

/**
 * Check if update requires approval
 */
function checkIfRequiresApproval(section: string, data: DBRow): boolean {
  // Bank details changes always require approval
  if (section === 'payout') {
    if (data.account_number || data.ifsc_code || data.bank_name) {
      return true
    }
  }

  // PAN changes require approval
  if (section === 'personal' && data.pan_number) {
    return true
  }

  // Entity changes require approval
  if (section === 'entity') {
    if (data.business_pan || data.cin_llpin || data.gstin) {
      return true
    }
  }

  return false
}

/**
 * Log audit entry
 */
async function logAuditEntry(
  supabase: SupabaseClient,
  partnerId: string,
  action: string,
  section: string,
  description: string,
  userId: string,
  request: NextRequest
): Promise<void> {
  try {
    // Get IP address from request
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    await supabase.from('cp_audit_logs').insert({
      partner_id: partnerId,
      action_type: action,
      action_description: description,
      section: section,
      changed_by: userId,
      source: 'WEB',
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    })
  } catch (error) {
    apiLogger.error('Error logging audit entry', error)
  }
}
