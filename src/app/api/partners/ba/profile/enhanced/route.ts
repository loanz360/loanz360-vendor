
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BAProfileData, BAProfileResponse } from '@/types/ba-profile'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/ba/profile/enhanced
 * Fetches complete enhanced BA partner profile with all sections
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

    // Fetch partner from partners table
    const { data: partner, error: profileError } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      apiLogger.error('Error fetching BA profile', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    // Fetch documents if profile exists
    let documents: Array<Record<string, unknown>> = []
    if (partner?.id) {
      const { data: docs } = await supabase
        .from('partner_documents')
        .select('*')
        .eq('partner_id', partner.id)
        .eq('is_latest', true)
        .order('created_at', { ascending: false })

      documents = docs || []
    }

    // Fetch pending change requests
    let pendingChanges: Array<Record<string, unknown>> = []
    if (partner?.id) {
      const { data: changes } = await supabase
        .from('partner_change_requests')
        .select('*')
        .eq('partner_id', partner.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })

      pendingChanges = changes || []
    }

    // Build comprehensive profile response
    const profileData: BAProfileData = {
      // Account Info
      account: {
        ba_id: partner?.partner_id || '',
        partner_type: 'BUSINESS_ASSOCIATE',
        entity_type: partner?.entity_type || 'INDIVIDUAL',
        account_status: partner?.account_status || 'PENDING_VERIFICATION',
        onboarding_status: partner?.onboarding_status || 'DRAFT',
        registration_date: partner?.created_at || new Date().toISOString(),
        last_profile_update: partner?.updated_at || new Date().toISOString(),
        created_by: partner?.created_by || 'SELF_REGISTRATION',
        created_by_reference: partner?.created_by_reference || undefined,
        profile_completion_percentage: calculateProfileCompletion(partner),
        is_email_verified: partner?.email_verified || false,
        is_mobile_verified: partner?.mobile_verified || false,
        is_kyc_verified: partner?.kyc_verified || false,
        is_bank_verified: partner?.bank_verified || false,
      },

      // Personal Details
      personal: {
        full_name: partner?.full_name || '',
        date_of_birth: partner?.date_of_birth || null,
        gender: partner?.gender || null,
        mobile_number: partner?.mobile_number || '',
        mobile_verified: partner?.mobile_verified || false,
        mobile_verified_at: partner?.mobile_verified_at || null,
        alternate_mobile: partner?.alternate_mobile || null,
        country_code: partner?.country_code || '+91',
        email_id: partner?.work_email || user.email || '',
        email_verified: partner?.email_verified || !!user.email_confirmed_at,
        email_verified_at: partner?.email_verified_at || user.email_confirmed_at || null,
        alternate_email: partner?.alternate_email || null,
        nationality: partner?.nationality || 'Indian',
        residential_status: partner?.residential_status || 'RESIDENT',
        marital_status: partner?.marital_status || null,
        photograph_url: partner?.profile_picture_url || null,
        photograph_uploaded_at: partner?.photograph_uploaded_at || null,
        emergency_contact_name: partner?.emergency_contact_name || null,
        emergency_contact_number: partner?.emergency_contact_number || null,
        emergency_contact_relation: partner?.emergency_contact_relation || null,
      },

      // Identity & KYC
      identity: {
        pan_number: partner?.pan_number || null,
        pan_name: partner?.pan_name || null,
        pan_document_url: partner?.pan_document_url || null,
        pan_verification_status: partner?.pan_verification_status || 'NOT_SUBMITTED',
        pan_verified_at: partner?.pan_verified_at || null,
        pan_verified_by: partner?.pan_verified_by || null,
        pan_rejection_reason: partner?.pan_rejection_reason || null,
        aadhaar_number_masked: partner?.aadhaar_number_masked || null,
        aadhaar_document_url: partner?.aadhaar_document_url || null,
        aadhaar_verification_status: partner?.aadhaar_verification_status || 'NOT_SUBMITTED',
        aadhaar_verified_at: partner?.aadhaar_verified_at || null,
        passport_number: partner?.passport_number || null,
        passport_expiry_date: partner?.passport_expiry_date || null,
        passport_document_url: partner?.passport_document_url || null,
        driving_license_number: partner?.driving_license_number || null,
        driving_license_expiry_date: partner?.driving_license_expiry_date || null,
        driving_license_document_url: partner?.driving_license_document_url || null,
        voter_id_number: partner?.voter_id_number || null,
        voter_id_document_url: partner?.voter_id_document_url || null,
      },

      // Business Details
      business: {
        business_name_legal: partner?.business_name_legal || null,
        trade_name: partner?.trade_name || null,
        business_registration_number: partner?.business_registration_number || null,
        business_registration_date: partner?.business_registration_date || null,
        business_registration_document_url: partner?.business_registration_document_url || null,
        business_category: partner?.business_category || 'DSA',
        years_of_experience: partner?.years_of_experience || 0,
        industry_domains: partner?.industry_domains || [],
        loan_products_handled: partner?.loan_products_handled || [],
        average_monthly_lead_volume: partner?.average_monthly_lead_volume || 'LESS_THAN_10',
        operating_cities: partner?.operating_cities || [],
        operating_states: partner?.operating_states || [],
        office_setup_type: partner?.office_setup_type || null,
        team_size: partner?.team_size || null,
        website_url: partner?.website_url || null,
        linkedin_profile_url: partner?.linkedin_profile_url || null,
      },

      // Address Details
      address: {
        registered_address_line1: partner?.present_address || '',
        registered_address_line2: partner?.registered_address_line2 || null,
        registered_landmark: partner?.registered_landmark || null,
        registered_city: partner?.registered_city || '',
        registered_district: partner?.registered_district || '',
        registered_state: partner?.state_name || '',
        registered_state_code: partner?.state_code || '',
        registered_country: partner?.registered_country || 'India',
        registered_pincode: partner?.pincode || '',
        registered_address_proof_type: partner?.present_address_proof_type || null,
        registered_address_proof_url: partner?.present_address_proof_url || null,
        registered_address_proof_date: partner?.registered_address_proof_date || null,
        registered_address_verification_status: partner?.registered_address_verification_status || 'NOT_SUBMITTED',
        communication_same_as_registered: partner?.communication_same_as_registered ?? true,
        communication_address_line1: partner?.permanent_address || null,
        communication_address_line2: partner?.communication_address_line2 || null,
        communication_landmark: partner?.communication_landmark || null,
        communication_city: partner?.communication_city || null,
        communication_district: partner?.communication_district || null,
        communication_state: partner?.communication_state || null,
        communication_state_code: partner?.communication_state_code || null,
        communication_country: partner?.communication_country || null,
        communication_pincode: partner?.communication_pincode || null,
      },

      // GST & Tax
      gst_tax: {
        gst_applicable: partner?.gst_applicable || false,
        gstin: partner?.gstin || null,
        gst_registration_date: partner?.gst_registration_date || null,
        gst_certificate_url: partner?.gst_certificate_url || null,
        gst_verification_status: partner?.gst_verification_status || 'NOT_SUBMITTED',
        gst_verified_at: partner?.gst_verified_at || null,
        tan_number: partner?.tan_number || null,
        income_tax_filing_status: partner?.income_tax_filing_status || null,
        last_itr_year: partner?.last_itr_year || null,
        itr_document_url: partner?.itr_document_url || null,
      },

      // Bank Details
      bank: {
        account_holder_name: partner?.account_holder_name || '',
        bank_name: partner?.bank_name || '',
        branch_name: partner?.branch_name || '',
        account_number: partner?.account_number || '',
        account_number_masked: maskAccountNumber(partner?.account_number),
        ifsc_code: partner?.ifsc_code || '',
        account_type: partner?.account_type || 'SAVINGS',
        micr_code: partner?.micr_code || null,
        cancelled_cheque_url: partner?.cancelled_cheque_url || null,
        bank_verification_status: partner?.bank_verification_status || 'NOT_SUBMITTED',
        bank_verification_method: partner?.bank_verification_method || null,
        bank_verified_at: partner?.bank_verified_at || null,
        bank_verified_by: partner?.bank_verified_by || null,
        payout_preference: partner?.payout_preference || 'MONTHLY',
        upi_id: partner?.upi_id || null,
        bank_change_approval_status: partner?.bank_change_approval_status || 'NOT_REQUIRED',
        bank_change_requested_at: partner?.bank_change_requested_at || null,
        bank_change_approved_at: partner?.bank_change_approved_at || null,
        bank_change_approved_by: partner?.bank_change_approved_by || null,
      },

      // Agreements
      agreements: {
        agreement_version: partner?.agreement_version || null,
        agreement_document_url: partner?.agreement_document_url || null,
        agreement_signed: partner?.agreement_signed || false,
        agreement_signed_date: partner?.agreement_signed_date || null,
        agreement_signed_ip: partner?.agreement_signed_ip || null,
        agreement_expiry_date: partner?.agreement_expiry_date || null,
        digital_signature_url: partner?.digital_signature_url || null,
        digital_signature_uploaded_at: partner?.digital_signature_uploaded_at || null,
        terms_conditions_accepted: partner?.terms_conditions_accepted || false,
        terms_conditions_accepted_at: partner?.terms_conditions_accepted_at || null,
        terms_conditions_version: partner?.terms_conditions_version || null,
        privacy_policy_accepted: partner?.privacy_policy_accepted || false,
        privacy_policy_accepted_at: partner?.privacy_policy_accepted_at || null,
        privacy_policy_version: partner?.privacy_policy_version || null,
        data_sharing_consent: partner?.data_sharing_consent || false,
        data_sharing_consent_at: partner?.data_sharing_consent_at || null,
        marketing_consent: partner?.marketing_consent || false,
        marketing_consent_at: partner?.marketing_consent_at || null,
        whatsapp_consent: partner?.whatsapp_consent || false,
        whatsapp_consent_at: partner?.whatsapp_consent_at || null,
      },

      // Security
      security: {
        username: user.email || '',
        password_last_changed: partner?.password_last_changed || null,
        password_expiry_date: partner?.password_expiry_date || null,
        password_expires_in_days: calculatePasswordExpiryDays(partner?.password_expiry_date),
        two_factor_enabled: partner?.two_factor_enabled || false,
        two_factor_method: partner?.two_factor_method || null,
        two_factor_setup_at: partner?.two_factor_setup_at || null,
        last_login_at: partner?.last_login_at || user.last_sign_in_at || null,
        last_login_ip: partner?.last_login_ip || null,
        last_login_device: partner?.last_login_device || null,
        last_login_location: partner?.last_login_location || null,
        failed_login_attempts: partner?.failed_login_attempts || 0,
        account_locked: partner?.account_locked || false,
        account_locked_until: partner?.account_locked_until || null,
        login_alerts_enabled: partner?.login_alerts_enabled ?? true,
        suspicious_activity_alerts: partner?.suspicious_activity_alerts ?? true,
      },

      // Documents
      documents: documents.map(doc => ({
        id: doc.id as string,
        document_type: doc.document_type as string,
        document_name: doc.document_name as string,
        file_name: doc.file_name as string,
        file_url: doc.file_url as string,
        file_size: doc.file_size as number,
        mime_type: doc.mime_type as string,
        uploaded_at: doc.created_at as string,
        uploaded_by: doc.uploaded_by as string,
        verification_status: doc.verification_status as string,
        verified_at: doc.verified_at as string | null,
        verified_by: doc.verified_by as string | null,
        rejection_reason: doc.rejection_reason as string | null,
        expiry_date: doc.expiry_date as string | null,
        is_expired: doc.is_expired as boolean,
        version: doc.version as number,
        is_latest: doc.is_latest as boolean,
        previous_version_id: doc.previous_version_id as string | null,
        remarks: doc.remarks as string | null,
      })) as BAProfileData['documents'],

      // Pending Changes
      pending_changes: pendingChanges.map(change => ({
        id: change.id as string,
        ba_id: partner?.partner_id || '',
        field_name: change.field_name as string,
        section: change.section as string,
        old_value: change.old_value as string | null,
        new_value: change.new_value as string,
        requested_at: change.created_at as string,
        requested_reason: change.reason as string | null,
        status: change.status as string,
        reviewed_by: change.reviewed_by as string | null,
        reviewed_at: change.reviewed_at as string | null,
        review_remarks: change.review_remarks as string | null,
      })) as BAProfileData['pending_changes'],

      // Bio
      bio_description: partner?.bio_description || null,

      // Metadata
      created_at: partner?.created_at || new Date().toISOString(),
      updated_at: partner?.updated_at || new Date().toISOString(),
    }

    const response: BAProfileResponse = {
      success: true,
      data: profileData,
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/ba/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/partners/ba/profile/enhanced
 * Updates BA partner profile - handles all sections
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

    const body = await request.json()
    const { section, data, requiresApproval = false } = body

    // Get existing profile
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    // If requires approval, create change request instead of direct update
    if (requiresApproval && existingPartner) {
      const changeRequests = Object.entries(data).map(([field, newValue]) => ({
        partner_id: existingPartner.id,
        field_name: field,
        section: section,
        old_value: existingPartner[field]?.toString() || null,
        new_value: (newValue as string | null)?.toString() || null,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      }))

      const { error: changeError } = await supabase
        .from('partner_change_requests')
        .insert(changeRequests)

      if (changeError) {
        apiLogger.error('Error creating change requests', changeError)
        return NextResponse.json(
          { success: false, error: 'Failed to submit change request' },
          { status: 500 }
        )
      }

      // Log audit entry
      await logAuditEntry(supabase, existingPartner.id, 'UPDATE', section, data, user.id, true)

      return NextResponse.json({
        success: true,
        message: 'Change request submitted for approval',
        requires_approval: true,
      })
    }

    // Direct update
    const updateData = {
      ...data,
      updated_at: new Date().toISOString(),
    }

    // Upsert profile
    const { data: updatedPartner, error: updateError } = await supabase
      .from('partners')
      .upsert({
        user_id: user.id,
        partner_type: 'BUSINESS_ASSOCIATE',
        ...updateData,
      }, {
        onConflict: 'user_id,partner_type'
      })
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating BA profile', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    // Log audit entry
    if (existingPartner) {
      await logAuditEntry(supabase, existingPartner.id, 'UPDATE', section, data, user.id, false)
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedPartner,
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/partners/ba/profile/enhanced', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper Functions

function calculateProfileCompletion(partner: Record<string, unknown> | null): number {
  if (!partner) return 0

  const sections = [
    // Personal - 20%
    { weight: 20, fields: ['full_name', 'date_of_birth', 'gender', 'mobile_number', 'nationality'] },
    // Identity - 20%
    { weight: 20, fields: ['pan_number', 'pan_document_url'] },
    // Business - 15%
    { weight: 15, fields: ['business_category', 'years_of_experience', 'loan_products_handled'] },
    // Address - 15%
    { weight: 15, fields: ['present_address', 'state_name', 'pincode'] },
    // Bank - 20%
    { weight: 20, fields: ['bank_name', 'account_number', 'ifsc_code', 'cancelled_cheque_url'] },
    // Agreements - 10%
    { weight: 10, fields: ['terms_conditions_accepted', 'privacy_policy_accepted'] },
  ]

  let totalScore = 0

  for (const section of sections) {
    const filledFields = section.fields.filter(field => {
      const value = partner[field]
      if (typeof value === 'boolean') return value === true
      if (Array.isArray(value)) return value.length > 0
      return value !== null && value !== undefined && value !== ''
    }).length

    const sectionScore = (filledFields / section.fields.length) * section.weight
    totalScore += sectionScore
  }

  return Math.round(totalScore)
}

function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber || accountNumber.length < 4) return 'XXXX'
  const lastFour = accountNumber.slice(-4)
  const masked = 'X'.repeat(accountNumber.length - 4)
  return masked + lastFour
}

function calculatePasswordExpiryDays(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diffTime = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays > 0 ? diffDays : 0
}

async function logAuditEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  partnerId: string,
  action: string,
  section: string,
  changes: Record<string, unknown>,
  userId: string,
  isPending: boolean
) {
  try {
    await supabase.from('partner_audit_logs').insert({
      partner_id: partnerId,
      action_type: action,
      action_description: `${action} ${section} section`,
      changed_by: userId,
      source: 'WEB',
      approval_status: isPending ? 'PENDING' : 'AUTO_APPROVED',
      metadata: { changes, section },
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error logging audit entry', error)
  }
}
