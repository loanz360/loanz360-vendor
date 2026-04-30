import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type {
  BPProfileData,
  BPAccountOverview,
  BPPersonalDetails,
  BPBusinessEntityDetails,
  BPProfessionalProfile,
  BPTeamHierarchy,
  BPBankDetails,
  BPTaxCompliance,
  BPCommissionStructure,
  BPAgreements,
  BPSecuritySettings,
  BPDocument,
  BPProfileChangeRequest,
  PartnerNature,
  VerificationStatus,
} from '@/types/bp-profile'
import { apiLogger } from '@/lib/utils/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Generic database row from Supabase queries */
type DBRow = Record<string, unknown>

/**
 * GET /api/partners/bp/profile/enhanced
 * Fetches comprehensive BP partner profile with all sections
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
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError && partnerError.code !== 'PGRST116') {
      apiLogger.error('Error fetching BP profile', partnerError)
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

    // Fetch team stats
    const { data: teamStats } = await supabase
      .rpc('get_bp_team_stats', { bp_id: partner.id })
      .maybeSingle()

    // Fetch documents
    const { data: documents } = await supabase
      .from('partner_documents')
      .select('*')
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    // Fetch pending change requests
    const { data: pendingChanges } = await supabase
      .from('partner_profile_change_requests')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })

    // Fetch commission structure from payout grid
    const { data: commissionData } = await supabase
      .from('partner_commission_structures')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('is_active', true)
      .maybeSingle()

    // Build comprehensive profile response
    const profileData = buildProfileData(partner, user, teamStats, documents, pendingChanges, commissionData)

    return NextResponse.json({
      success: true,
      data: profileData
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/bp/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/bp/profile/enhanced
 * Updates BP partner profile with section-specific data
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
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
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (findError && findError.code !== 'PGRST116') {
      apiLogger.error('Error finding BP profile', findError)
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

    // Check if update requires approval
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
      await logAuditEntry(supabase, existingPartner.id, 'UPDATE', section, 'Change request created', user.id)

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
        apiLogger.error('Error updating BP profile', error)
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
          partner_type: 'BUSINESS_PARTNER',
          ...updatePayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        apiLogger.error('Error creating BP profile', error)
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
      `Profile ${section} updated`,
      user.id
    )

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: { partner_id: result.partner_id }
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/bp/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to build empty profile structure
function buildEmptyProfile(user: DBRow): Partial<BPProfileData> {
  return {
    account: {
      bp_id: '',
      partner_nature: 'INDIVIDUAL' as PartnerNature,
      partner_status: 'PENDING_VERIFICATION',
      onboarding_status: 'DRAFT',
      date_of_registration: new Date().toISOString(),
      last_profile_update: new Date().toISOString(),
      reporting_super_admin: null,
      reporting_super_admin_name: null,
      partner_hierarchy_level: 1,
      profile_completion_percentage: 0,
      is_email_verified: !!user.email_confirmed_at,
      is_mobile_verified: false,
      is_kyc_verified: false,
      is_bank_verified: false,
      created_by: 'SELF_REGISTRATION',
      created_by_reference: null
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
      profile_photograph_url: null,
      photograph_uploaded_at: null,
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
    business_entity: null,
    professional: {
      years_of_experience: 0,
      primary_loan_products: [],
      secondary_loan_products: [],
      average_monthly_leads: 'LESS_THAN_10',
      operating_cities: [],
      operating_states: [],
      industry_specializations: [],
      sourcing_channels: [],
      website_url: null,
      linkedin_url: null,
      bio_description: null
    },
    team: {
      total_business_associates: 0,
      active_associates_count: 0,
      inactive_associates_count: 0,
      suspended_associates_count: 0,
      associate_onboarding_rights: false,
      associate_approval_flow: 'MANUAL',
      date_first_associate_onboarded: null,
      last_associate_onboarded_date: null,
      team_lead_since: null
    },
    bank: {
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
      bank_verified_by: null,
      payout_method: 'BANK_TRANSFER',
      upi_id: null,
      settlement_frequency: 'MONTHLY',
      bank_change_approval_status: 'NOT_REQUIRED',
      bank_change_requested_at: null
    },
    tax_compliance: {
      gst_on_commission: false,
      gstin: null,
      gst_verification_status: 'NOT_SUBMITTED' as VerificationStatus,
      gst_certificate_url: null,
      tds_applicable: true,
      tds_percentage: 5,
      income_tax_category: null,
      tan_number: null,
      commission_eligibility_status: 'PENDING_REVIEW',
      commission_ineligibility_reason: null
    },
    commission: {
      self_sourcing_commission_model: null,
      self_sourcing_commission_rate: null,
      team_override_commission_model: null,
      team_override_percentage: null,
      slab_based_incentives: false,
      incentive_slabs: [],
      effective_from_date: null,
      admin_remarks: null
    },
    agreements: {
      agreement_version: null,
      agreement_document_url: null,
      agreement_signed: false,
      agreement_signed_date: null,
      agreement_signed_ip: null,
      agreement_expiry_date: null,
      digital_signature_url: null,
      digital_signature_uploaded_at: null,
      code_of_conduct_accepted: false,
      code_of_conduct_accepted_at: null,
      privacy_policy_accepted: false,
      privacy_policy_accepted_at: null,
      privacy_policy_version: null,
      data_sharing_consent: false,
      data_sharing_consent_at: null,
      marketing_consent: false,
      whatsapp_consent: false
    },
    security: {
      username: user.email || '',
      role_type: 'BUSINESS_PARTNER',
      last_login_at: null,
      last_login_ip: null,
      last_login_device: null,
      last_login_location: null,
      login_ip_history: [],
      device_history: [],
      two_factor_enabled: false,
      two_factor_method: null,
      two_factor_setup_at: null,
      password_last_updated: null,
      password_expires_at: null,
      failed_login_attempts: 0,
      account_locked: false,
      account_locked_until: null,
      login_alerts_enabled: true,
      suspicious_activity_alerts: true
    },
    documents: [],
    pending_changes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

// Helper function to build profile data from database record
function buildProfileData(
  partner: DBRow,
  user: DBRow,
  teamStats: DBRow | null,
  documents: DBRow[],
  pendingChanges: DBRow[],
  commissionData: DBRow | null
): Partial<BPProfileData> {
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

  return {
    account: {
      bp_id: partner.partner_id || '',
      partner_nature: (partner.partner_nature || 'INDIVIDUAL') as PartnerNature,
      partner_status: partner.status || 'PENDING_VERIFICATION',
      onboarding_status: partner.onboarding_status || 'DRAFT',
      date_of_registration: partner.created_at,
      last_profile_update: partner.updated_at,
      reporting_super_admin: partner.reporting_super_admin,
      reporting_super_admin_name: partner.reporting_super_admin_name,
      partner_hierarchy_level: 1,
      profile_completion_percentage: partner.profile_completion_percentage || 0,
      is_email_verified: !!partner.email_verified_at || !!user.email_confirmed_at,
      is_mobile_verified: !!partner.mobile_verified_at,
      is_kyc_verified: partner.pan_verification_status === 'VERIFIED' && partner.aadhaar_verification_status === 'VERIFIED',
      is_bank_verified: partner.bank_verification_status === 'VERIFIED',
      created_by: partner.created_by || 'SELF_REGISTRATION',
      created_by_reference: partner.created_by_reference
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
      profile_photograph_url: partner.profile_picture_url,
      photograph_uploaded_at: partner.profile_picture_uploaded_at,
      pan_number: partner.pan_number,
      pan_verification_status: partner.pan_verification_status || 'NOT_SUBMITTED',
      pan_document_url: partner.pan_document_url,
      pan_verified_at: partner.pan_verified_at,
      aadhaar_number_masked: partner.aadhaar_number_masked,
      aadhaar_verification_status: partner.aadhaar_verification_status || 'NOT_SUBMITTED',
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
      address_verification_status: partner.address_verification_status || 'NOT_SUBMITTED'
    },
    business_entity: partner.partner_nature === 'BUSINESS_ENTITY' ? {
      legal_entity_name: partner.legal_entity_name || '',
      trade_name: partner.trade_name,
      entity_type: partner.entity_type || 'PROPRIETORSHIP',
      date_of_incorporation: partner.date_of_incorporation,
      cin_llpin: partner.cin_llpin,
      cin_verification_status: partner.cin_verification_status || 'NOT_SUBMITTED',
      cin_document_url: partner.cin_document_url,
      business_pan: partner.business_pan,
      business_pan_verification_status: partner.business_pan_verification_status || 'NOT_SUBMITTED',
      business_pan_document_url: partner.business_pan_document_url,
      gst_applicable: partner.gst_applicable || false,
      gstin: partner.business_gstin,
      gst_verification_status: partner.business_gst_verification_status || 'NOT_SUBMITTED',
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
    professional: {
      years_of_experience: partner.years_of_experience || 0,
      primary_loan_products: parseJsonArray(partner.primary_loan_products),
      secondary_loan_products: parseJsonArray(partner.secondary_loan_products),
      average_monthly_leads: partner.average_monthly_leads || 'LESS_THAN_10',
      operating_cities: parseJsonArray(partner.operating_cities),
      operating_states: parseJsonArray(partner.operating_states),
      industry_specializations: parseJsonArray(partner.industry_specializations),
      sourcing_channels: parseJsonArray(partner.sourcing_channels),
      website_url: partner.website_url,
      linkedin_url: partner.linkedin_url,
      bio_description: partner.bio_description
    },
    team: {
      total_business_associates: teamStats?.total_associates || 0,
      active_associates_count: teamStats?.active_associates || 0,
      inactive_associates_count: teamStats?.inactive_associates || 0,
      suspended_associates_count: teamStats?.suspended_associates || 0,
      associate_onboarding_rights: partner.associate_onboarding_rights ?? true,
      associate_approval_flow: partner.associate_approval_flow || 'MANUAL',
      date_first_associate_onboarded: teamStats?.first_associate_date,
      last_associate_onboarded_date: teamStats?.last_associate_date,
      team_lead_since: partner.team_lead_since
    },
    bank: {
      account_holder_name: partner.account_holder_name || '',
      bank_name: partner.bank_name || '',
      branch_name: partner.branch_name || '',
      account_number: partner.account_number || '',
      account_number_masked: maskAccountNumber(partner.account_number),
      ifsc_code: partner.ifsc_code || '',
      micr_code: partner.micr_code,
      account_type: partner.account_type || 'SAVINGS',
      cancelled_cheque_url: partner.cancelled_cheque_url,
      bank_verification_status: partner.bank_verification_status || 'NOT_SUBMITTED',
      bank_verification_method: partner.bank_verification_method,
      bank_verified_at: partner.bank_verified_at,
      bank_verified_by: partner.bank_verified_by,
      payout_method: partner.payout_method || 'BANK_TRANSFER',
      upi_id: partner.upi_id,
      settlement_frequency: partner.settlement_frequency || 'MONTHLY',
      bank_change_approval_status: partner.bank_change_approval_status || 'NOT_REQUIRED',
      bank_change_requested_at: partner.bank_change_requested_at
    },
    tax_compliance: {
      gst_on_commission: partner.gst_on_commission || false,
      gstin: partner.gstin,
      gst_verification_status: partner.gst_verification_status || 'NOT_SUBMITTED',
      gst_certificate_url: partner.gst_certificate_url,
      tds_applicable: partner.tds_applicable ?? true,
      tds_percentage: partner.tds_percentage || 5,
      income_tax_category: partner.income_tax_category,
      tan_number: partner.tan_number,
      commission_eligibility_status: partner.commission_eligibility_status || 'PENDING_REVIEW',
      commission_ineligibility_reason: partner.commission_ineligibility_reason
    },
    commission: commissionData ? {
      self_sourcing_commission_model: commissionData.self_sourcing_model,
      self_sourcing_commission_rate: commissionData.self_sourcing_rate,
      team_override_commission_model: commissionData.team_override_model,
      team_override_percentage: commissionData.team_override_percentage,
      slab_based_incentives: commissionData.slab_based || false,
      incentive_slabs: parseJsonArray(commissionData.incentive_slabs),
      effective_from_date: commissionData.effective_from,
      admin_remarks: commissionData.admin_remarks
    } : {
      self_sourcing_commission_model: null,
      self_sourcing_commission_rate: null,
      team_override_commission_model: null,
      team_override_percentage: null,
      slab_based_incentives: false,
      incentive_slabs: [],
      effective_from_date: null,
      admin_remarks: null
    },
    agreements: {
      agreement_version: partner.agreement_version,
      agreement_document_url: partner.agreement_document_url,
      agreement_signed: partner.agreement_signed || false,
      agreement_signed_date: partner.agreement_signed_date,
      agreement_signed_ip: partner.agreement_signed_ip,
      agreement_expiry_date: partner.agreement_expiry_date,
      digital_signature_url: partner.digital_signature_url,
      digital_signature_uploaded_at: partner.digital_signature_uploaded_at,
      code_of_conduct_accepted: partner.code_of_conduct_accepted || false,
      code_of_conduct_accepted_at: partner.code_of_conduct_accepted_at,
      privacy_policy_accepted: partner.privacy_policy_accepted || false,
      privacy_policy_accepted_at: partner.privacy_policy_accepted_at,
      privacy_policy_version: partner.privacy_policy_version,
      data_sharing_consent: partner.data_sharing_consent || false,
      data_sharing_consent_at: partner.data_sharing_consent_at,
      marketing_consent: partner.marketing_consent || false,
      whatsapp_consent: partner.whatsapp_consent || false
    },
    security: {
      username: partner.work_email || user.email || '',
      role_type: 'BUSINESS_PARTNER',
      last_login_at: partner.last_login_at,
      last_login_ip: partner.last_login_ip,
      last_login_device: partner.last_login_device,
      last_login_location: partner.last_login_location,
      login_ip_history: parseJsonArray(partner.login_ip_history),
      device_history: parseJsonArray(partner.device_history),
      two_factor_enabled: partner.two_factor_enabled || false,
      two_factor_method: partner.two_factor_method,
      two_factor_setup_at: partner.two_factor_setup_at,
      password_last_updated: partner.password_last_updated,
      password_expires_at: partner.password_expires_at,
      failed_login_attempts: partner.failed_login_attempts || 0,
      account_locked: partner.account_locked || false,
      account_locked_until: partner.account_locked_until,
      login_alerts_enabled: partner.login_alerts_enabled ?? true,
      suspicious_activity_alerts: partner.suspicious_activity_alerts ?? true
    },
    documents: (documents || []).map((doc: DBRow) => ({
      id: doc.id,
      document_type: doc.document_type,
      document_name: doc.document_name,
      file_name: doc.file_name,
      file_url: doc.file_url,
      file_size: doc.file_size || 0,
      mime_type: doc.mime_type,
      uploaded_at: doc.created_at,
      uploaded_by: doc.uploaded_by === user.id ? 'SELF' : doc.uploaded_by,
      verification_status: doc.verification_status || 'NOT_SUBMITTED',
      verified_at: doc.verified_at,
      verified_by: doc.verified_by,
      admin_comments: doc.admin_comments,
      rejection_reason: doc.rejection_reason,
      expiry_date: doc.expiry_date,
      is_expired: doc.expiry_date ? new Date(doc.expiry_date) < new Date() : false,
      version: doc.version || 1,
      is_latest: doc.is_latest ?? true
    })),
    pending_changes: (pendingChanges || []).map((change: DBRow) => ({
      id: change.id,
      bp_id: partner.partner_id,
      field_name: change.field_name,
      section: change.section,
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

// Helper function to mask account number
function maskAccountNumber(accountNumber: string | null): string {
  if (!accountNumber || accountNumber.length < 4) return ''
  return 'XXXX' + accountNumber.slice(-4)
}

// Helper function to build update payload based on section
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

    case 'business-entity':
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

    case 'professional':
      return {
        years_of_experience: parseInt(data.years_of_experience) || 0,
        primary_loan_products: JSON.stringify(data.primary_loan_products || []),
        secondary_loan_products: JSON.stringify(data.secondary_loan_products || []),
        average_monthly_leads: data.average_monthly_leads,
        operating_cities: JSON.stringify(data.operating_cities || []),
        operating_states: JSON.stringify(data.operating_states || []),
        industry_specializations: JSON.stringify(data.industry_specializations || []),
        sourcing_channels: JSON.stringify(data.sourcing_channels || []),
        website_url: data.website_url,
        linkedin_url: data.linkedin_url,
        bio_description: data.bio_description
      }

    case 'team':
      return {
        associate_onboarding_rights: data.associate_onboarding_rights,
        associate_approval_flow: data.associate_approval_flow
      }

    case 'bank':
      return {
        account_holder_name: data.account_holder_name,
        bank_name: data.bank_name,
        branch_name: data.branch_name,
        account_number: data.account_number,
        ifsc_code: data.ifsc_code?.toUpperCase(),
        micr_code: data.micr_code,
        account_type: data.account_type,
        payout_method: data.payout_method,
        upi_id: data.upi_id,
        settlement_frequency: data.settlement_frequency
      }

    case 'tax-compliance':
      return {
        gst_on_commission: data.gst_on_commission,
        gstin: data.gstin?.toUpperCase(),
        tds_applicable: data.tds_applicable,
        tds_percentage: data.tds_percentage ? parseInt(data.tds_percentage) : null,
        income_tax_category: data.income_tax_category,
        tan_number: data.tan_number?.toUpperCase()
      }

    case 'agreements':
      return {
        code_of_conduct_accepted: data.code_of_conduct_accepted,
        code_of_conduct_accepted_at: data.code_of_conduct_accepted ? new Date().toISOString() : null,
        privacy_policy_accepted: data.privacy_policy_accepted,
        privacy_policy_accepted_at: data.privacy_policy_accepted ? new Date().toISOString() : null,
        data_sharing_consent: data.data_sharing_consent,
        data_sharing_consent_at: data.data_sharing_consent ? new Date().toISOString() : null,
        marketing_consent: data.marketing_consent,
        whatsapp_consent: data.whatsapp_consent
      }

    case 'security':
      return {
        two_factor_enabled: data.two_factor_enabled,
        two_factor_method: data.two_factor_method,
        login_alerts_enabled: data.login_alerts_enabled,
        suspicious_activity_alerts: data.suspicious_activity_alerts
      }

    case 'partner-nature':
      return {
        partner_nature: data.partner_nature
      }

    default:
      return null
  }
}

// Helper function to check if update requires approval
function checkIfRequiresApproval(section: string, data: DBRow): boolean {
  // Bank details changes require approval
  if (section === 'bank') {
    return true
  }

  // PAN changes require approval
  if (section === 'personal' && data.pan_number) {
    return true
  }

  return false
}

// Helper function to log audit entry
async function logAuditEntry(
  supabase: SupabaseClient,
  partnerId: string,
  action: string,
  section: string,
  description: string,
  userId: string
): Promise<void> {
  try {
    await supabase.from('partner_audit_logs').insert({
      partner_id: partnerId,
      action_type: action,
      action_description: description,
      section: section,
      changed_by: userId,
      source: 'WEB',
      created_at: new Date().toISOString()
    })
  } catch (error) {
    apiLogger.error('Error logging audit entry', error)
  }
}
