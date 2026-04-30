
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch verification status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') || 'INDIVIDUAL'

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access to this profile
    if (profileType === 'INDIVIDUAL') {
      const { data: individual } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    } else {
      const { data: membership } = await supabase
        .from('entity_members')
        .select('id')
        .eq('entity_id', profileId)
        .eq('status', 'ACTIVE')
        .eq('individual.auth_user_id', userId)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Fetch document statistics
    const { data: documents, error: docsError } = await supabase
      .from('profile_documents')
      .select('verification_status')
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)
      .is('deleted_at', null)

    if (docsError) {
      apiLogger.error('Error fetching documents', docsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Calculate document stats
    const documents_verified = documents.filter(d => d.verification_status === 'VERIFIED').length
    const documents_pending = documents.filter(d => d.verification_status === 'PENDING').length
    const documents_rejected = documents.filter(d => d.verification_status === 'REJECTED').length
    const total_documents = documents.length

    // Fetch profile to get verification status
    let overall_status = 'NOT_VERIFIED'
    let kyc_status
    let verification_status
    let last_verified_at
    let profile_completion = 0

    if (profileType === 'INDIVIDUAL') {
      const { data: profile } = await supabase
        .from('individuals')
        .select('kyc_status, kyc_verified_at, profile_photo_url, pan_number, aadhaar_number, email, phone, date_of_birth')
        .eq('id', profileId)
        .maybeSingle()

      if (profile) {
        kyc_status = profile.kyc_status || 'NOT_VERIFIED'
        overall_status = kyc_status
        last_verified_at = profile.kyc_verified_at

        // Calculate profile completion
        let completed_fields = 0
        const total_fields = 8
        if (profile.profile_photo_url) completed_fields++
        if (profile.pan_number) completed_fields++
        if (profile.aadhaar_number) completed_fields++
        if (profile.email) completed_fields++
        if (profile.phone) completed_fields++
        if (profile.date_of_birth) completed_fields++
        if (documents_verified > 0) completed_fields++
        if (profile.kyc_status === 'VERIFIED') completed_fields++

        profile_completion = Math.round((completed_fields / total_fields) * 100)
      }
    } else {
      const { data: profile } = await supabase
        .from('entities')
        .select('verification_status, verified_at, logo_url, gst_number, pan_number, cin_number')
        .eq('id', profileId)
        .maybeSingle()

      if (profile) {
        verification_status = profile.verification_status || 'NOT_VERIFIED'
        overall_status = verification_status
        last_verified_at = profile.verified_at

        // Calculate profile completion
        let completed_fields = 0
        const total_fields = 6
        if (profile.logo_url) completed_fields++
        if (profile.gst_number) completed_fields++
        if (profile.pan_number) completed_fields++
        if (profile.cin_number) completed_fields++
        if (documents_verified > 0) completed_fields++
        if (profile.verification_status === 'VERIFIED') completed_fields++

        profile_completion = Math.round((completed_fields / total_fields) * 100)
      }
    }

    // Generate verification steps based on profile type
    const verificationSteps = profileType === 'INDIVIDUAL'
      ? await generateIndividualSteps(supabase, profileId, documents)
      : await generateEntitySteps(supabase, profileId, documents)

    return NextResponse.json({
      success: true,
      verificationStatus: {
        overall_status,
        kyc_status,
        verification_status,
        last_verified_at,
        documents_verified,
        documents_pending,
        documents_rejected,
        total_documents,
        profile_completion
      },
      verificationSteps
    })
  } catch (error) {
    apiLogger.error('Error in verification API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function generateIndividualSteps(supabase: unknown, profileId: string, documents: unknown[]) {
  const { data: profile } = await supabase
    .from('individuals')
    .select('full_name, date_of_birth, email, phone, pan_number, aadhaar_number')
    .eq('id', profileId)
    .maybeSingle()

  const steps = []

  // Step 1: Profile Information
  const profileComplete = profile && profile.full_name && profile.date_of_birth && profile.email && profile.phone
  steps.push({
    id: '1',
    step_name: 'Profile Information',
    description: 'Complete your basic profile information',
    status: profileComplete ? 'COMPLETED' : 'PENDING',
    completed_at: profileComplete ? new Date().toISOString() : undefined,
    required: true
  })

  // Step 2: Identity Documents
  const panDoc = documents.find(d => d.verification_status === 'VERIFIED' && (d.document_type === 'PAN_CARD' || profile.pan_number))
  const aadhaarDoc = documents.find(d => d.verification_status === 'VERIFIED' && (d.document_type === 'AADHAAR_CARD' || profile.aadhaar_number))
  const identityComplete = panDoc && aadhaarDoc
  steps.push({
    id: '2',
    step_name: 'Identity Documents',
    description: 'Upload PAN Card and Aadhaar Card',
    status: identityComplete ? 'COMPLETED' : (panDoc || aadhaarDoc ? 'PENDING' : 'NOT_STARTED'),
    completed_at: identityComplete ? new Date().toISOString() : undefined,
    required: true
  })

  // Step 3: Address Verification
  const { data: addresses } = await supabase
    .from('addresses')
    .select('id')
    .eq('profile_id', profileId)
    .eq('profile_type', 'INDIVIDUAL')
    .eq('is_verified', true)

  const addressComplete = addresses && addresses.length > 0
  steps.push({
    id: '3',
    step_name: 'Address Verification',
    description: 'Upload address proof documents',
    status: addressComplete ? 'COMPLETED' : (addresses && addresses.length > 0 ? 'PENDING' : 'NOT_STARTED'),
    required: true
  })

  // Step 4: Income Verification
  const incomeDoc = documents.find(d => d.verification_status === 'VERIFIED' &&
    ['SALARY_SLIP', 'BANK_STATEMENT', 'ITR'].includes(d.document_type))
  steps.push({
    id: '4',
    step_name: 'Income Verification',
    description: 'Upload salary slips or bank statements',
    status: incomeDoc ? 'COMPLETED' : 'NOT_STARTED',
    completed_at: incomeDoc ? new Date().toISOString() : undefined,
    required: false
  })

  return steps
}

async function generateEntitySteps(supabase: unknown, profileId: string, documents: unknown[]) {
  const { data: profile } = await supabase
    .from('entities')
    .select('legal_name, incorporation_date, gst_number, pan_number')
    .eq('id', profileId)
    .maybeSingle()

  const steps = []

  // Step 1: Entity Information
  const entityInfoComplete = profile && profile.legal_name && profile.incorporation_date
  steps.push({
    id: '1',
    step_name: 'Entity Information',
    description: 'Complete entity basic information',
    status: entityInfoComplete ? 'COMPLETED' : 'PENDING',
    completed_at: entityInfoComplete ? new Date().toISOString() : undefined,
    required: true
  })

  // Step 2: Registration Documents
  const incorporationDoc = documents.find(d => d.verification_status === 'VERIFIED' && d.document_type === 'INCORPORATION_CERTIFICATE')
  const gstDoc = documents.find(d => d.verification_status === 'VERIFIED' && (d.document_type === 'GST_CERTIFICATE' || profile.gst_number))
  const registrationComplete = incorporationDoc && gstDoc
  steps.push({
    id: '2',
    step_name: 'Registration Documents',
    description: 'Upload incorporation certificate and GST',
    status: registrationComplete ? 'COMPLETED' : (incorporationDoc || gstDoc ? 'PENDING' : 'NOT_STARTED'),
    completed_at: registrationComplete ? new Date().toISOString() : undefined,
    required: true
  })

  // Step 3: Address Verification
  const { data: addresses } = await supabase
    .from('addresses')
    .select('id')
    .eq('profile_id', profileId)
    .eq('profile_type', 'ENTITY')
    .eq('is_verified', true)

  const addressComplete = addresses && addresses.length > 0
  steps.push({
    id: '3',
    step_name: 'Address Verification',
    description: 'Upload registered office address proof',
    status: addressComplete ? 'COMPLETED' : (addresses && addresses.length > 0 ? 'PENDING' : 'NOT_STARTED'),
    required: true
  })

  // Step 4: Director/Partner Details
  const { data: members } = await supabase
    .from('entity_members')
    .select('id')
    .eq('entity_id', profileId)
    .eq('status', 'ACTIVE')

  const membersComplete = members && members.length > 0
  steps.push({
    id: '4',
    step_name: 'Director/Partner Details',
    description: 'Add and verify director/partner information',
    status: membersComplete ? 'COMPLETED' : 'NOT_STARTED',
    completed_at: membersComplete ? new Date().toISOString() : undefined,
    required: true
  })

  // Step 5: Bank Account Verification
  const bankDoc = documents.find(d => d.verification_status === 'VERIFIED' &&
    ['BANK_STATEMENT', 'CANCELLED_CHEQUE'].includes(d.document_type))
  steps.push({
    id: '5',
    step_name: 'Bank Account Verification',
    description: 'Upload cancelled cheque or bank statement',
    status: bankDoc ? 'COMPLETED' : 'NOT_STARTED',
    completed_at: bankDoc ? new Date().toISOString() : undefined,
    required: false
  })

  return steps
}
