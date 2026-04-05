export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { calculateProfileCompletion } from '@/lib/utils/profile-completion'
import { sanitizeText } from '@/lib/validations/input-sanitization'
import { logEmployeeActivity } from '@/lib/services/employee-audit'

export const runtime = 'nodejs'

/**
 * Verify employee authentication
 */
async function verifyEmployee(_request: NextRequest): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return { authorized: false, error: 'Unauthorized - No authentication token' }
  }

  const sessionData = verifySessionToken(authToken)
  if (!sessionData) {
    return { authorized: false, error: 'Unauthorized - Invalid or expired token' }
  }

  const [tokenBlacklisted, sessionRevoked] = await Promise.all([
    isTokenBlacklisted(authToken),
    isSessionRevoked(sessionData.sessionId)
  ])

  if (tokenBlacklisted || sessionRevoked) {
    return { authorized: false, error: 'Unauthorized - Session invalidated' }
  }

  // Allow both EMPLOYEE and HR roles to access employee self-service features
  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
    return { authorized: false, error: 'Forbidden - Employee access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * GET /api/employees/profile
 * Fetch employee profile and professional details
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name, email, sub_role, role, avatar_url')
      .eq('id', auth.userId)
      .maybeSingle()

    if (userError) {
      logger.error('Error fetching user data', userError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        employee_id,
        department,
        designation,
        professional_mail,
        location,
        languages_known,
        reporting_manager_id,
        reporting_manager_name,
        department_join_date,
        mobile,
        professional_mobile,
        date_of_birth,
        gender,
        blood_group,
        pan_number,
        aadhaar_number,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relationship,
        reference1_name,
        reference1_contact,
        reference1_relationship,
        reference2_name,
        reference2_contact,
        reference2_relationship,
        bank_account_number,
        bank_name,
        bank_branch,
        bank_ifsc_code,
        bank_micr_code,
        address_current,
        address_permanent,
        present_address_proof_url,
        permanent_address_proof_url,
        pan_card_copy_url,
        aadhaar_card_copy_url,
        cancelled_cheque_url,
        avatar_url,
        last_updated_timestamp
      `)
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('Error fetching profile data', profileError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch profile data' },
        { status: 500 }
      )
    }

    // Fetch employee record for status and completion tracking
    const { data: employeeRecord } = await supabase
      .from('employees')
      .select('employee_id, employee_status, profile_completed, first_login_completed, department_id, sub_role, reporting_manager_id, date_of_joining')
      .eq('user_id', auth.userId)
      .maybeSingle()

    // Combine data - return null for empty fields instead of empty strings for consistency
    const profileData = {
      // Employee Info
      employeeId: employeeRecord?.employee_id || profile?.employee_id || `EMP${auth.userId?.slice(0, 4).toUpperCase()}`,
      fullName: userData.full_name || '',
      email: userData.email || '',
      subRole: userData.sub_role || null,
      avatarUrl: profile?.avatar_url || userData.avatar_url || null,

      // Professional Details
      department: profile?.department || null,
      designation: profile?.designation || null,
      professionalMail: profile?.professional_mail || null,
      location: profile?.location || null,
      languagesKnown: profile?.languages_known || [],
      reportingManagerId: profile?.reporting_manager_id || null,
      reportingManagerName: profile?.reporting_manager_name || null,
      departmentJoinDate: profile?.department_join_date || null,

      // Personal Details - Basic
      mobile: profile?.mobile || null,
      professionalMobile: profile?.professional_mobile || null,
      dateOfBirth: profile?.date_of_birth || null,
      gender: profile?.gender || null,
      bloodGroup: profile?.blood_group || null,

      // Personal Details - Identity
      panNumber: profile?.pan_number || null,
      aadhaarNumber: profile?.aadhaar_number || null,

      // Personal Details - Emergency Contact
      emergencyContactName: profile?.emergency_contact_name || null,
      emergencyContactPhone: profile?.emergency_contact_phone || null,
      emergencyContactRelationship: profile?.emergency_contact_relationship || null,

      // Personal Details - References
      reference1Name: profile?.reference1_name || null,
      reference1Contact: profile?.reference1_contact || null,
      reference1Relationship: profile?.reference1_relationship || null,
      reference2Name: profile?.reference2_name || null,
      reference2Contact: profile?.reference2_contact || null,
      reference2Relationship: profile?.reference2_relationship || null,

      // Personal Details - Bank
      bankAccountNumber: profile?.bank_account_number || null,
      bankName: profile?.bank_name || null,
      bankBranch: profile?.bank_branch || null,
      bankIfscCode: profile?.bank_ifsc_code || null,
      bankMicrCode: profile?.bank_micr_code || null,

      // Address
      addressCurrent: profile?.address_current || null,
      addressPermanent: profile?.address_permanent || null,

      // Document URLs
      presentAddressProofUrl: profile?.present_address_proof_url || null,
      permanentAddressProofUrl: profile?.permanent_address_proof_url || null,
      panCardCopyUrl: profile?.pan_card_copy_url || null,
      aadhaarCardCopyUrl: profile?.aadhaar_card_copy_url || null,
      cancelledChequeUrl: profile?.cancelled_cheque_url || null,

      // Metadata
      lastUpdated: profile?.last_updated_timestamp || null
    }

    // Calculate profile completion using the utility
    const completionData = calculateProfileCompletion({
      full_name: profileData.fullName,
      date_of_birth: profileData.dateOfBirth || undefined,
      gender: profileData.gender || undefined,
      blood_group: profileData.bloodGroup || undefined,
      mobile_number: profileData.mobile || undefined,
      personal_email: profileData.email || undefined,
      work_email: profileData.professionalMail || profileData.email || undefined,
      emergency_contact_name: profileData.emergencyContactName || undefined,
      emergency_contact_number: profileData.emergencyContactPhone || undefined,
      emergency_contact_relation: profileData.emergencyContactRelationship || undefined,
      present_address: profileData.addressCurrent || undefined,
      permanent_address: profileData.addressPermanent || undefined,
      pan_number: profileData.panNumber || undefined,
      pan_card_url: profileData.panCardCopyUrl || undefined,
      aadhaar_number: profileData.aadhaarNumber || undefined,
      aadhaar_card_url: profileData.aadhaarCardCopyUrl || undefined,
      bank_account_number: profileData.bankAccountNumber || undefined,
      bank_name: profileData.bankName || undefined,
      ifsc_code: profileData.bankIfscCode || undefined,
      cancelled_cheque_url: profileData.cancelledChequeUrl || undefined,
      department_id: employeeRecord?.department_id || undefined,
      sub_role: employeeRecord?.sub_role || profileData.subRole || undefined,
      reporting_manager_id: profileData.reportingManagerId || employeeRecord?.reporting_manager_id || undefined,
      present_address_proof_url: profileData.presentAddressProofUrl || undefined,
      permanent_address_proof_url: profileData.permanentAddressProofUrl || undefined,
      reference1_name: profileData.reference1Name || undefined,
      reference1_contact: profileData.reference1Contact || undefined,
      reference2_name: profileData.reference2Name || undefined,
      reference2_contact: profileData.reference2Contact || undefined,
    })

    return NextResponse.json({
      success: true,
      data: profileData,
      completion: {
        percentage: completionData.percentage,
        mandatoryComplete: completionData.mandatoryComplete,
        missingFields: completionData.missingFields,
        sections: completionData.sections,
      },
      employeeStatus: employeeRecord?.employee_status || 'PENDING_ONBOARDING',
      profileCompleted: employeeRecord?.profile_completed || false,
    })
  } catch (error) {
    logger.error('Error in GET /api/employees/profile', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/profile
 * Update employee profile and professional details
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const body = await request.json()
    const {
      // Professional details
      department,
      designation,
      professionalMail,
      location,
      languagesKnown,
      reportingManagerName,
      reportingManagerId,
      departmentJoinDate,
      // Personal details - Basic
      mobile,
      professionalMobile,
      dateOfBirth,
      gender,
      bloodGroup,
      // Personal details - Identity
      panNumber,
      aadhaarNumber,
      // Personal details - Emergency Contact
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      // Personal details - References
      reference1Name,
      reference1Contact,
      reference1Relationship,
      reference2Name,
      reference2Contact,
      reference2Relationship,
      // Personal details - Bank
      bankAccountNumber,
      bankName,
      bankBranch,
      bankIfscCode,
      bankMicrCode,
      // Address
      addressCurrent,
      addressPermanent,
      // Document URLs
      presentAddressProofUrl,
      permanentAddressProofUrl,
      panCardCopyUrl,
      aadhaarCardCopyUrl,
      cancelledChequeUrl
    } = body

    // Server-side validation
    const validationErrors: string[] = []

    if (mobile !== undefined && mobile && !/^\d{10}$/.test(mobile.replace(/[\s\-+]/g, '').slice(-10))) {
      validationErrors.push('Invalid mobile number format')
    }
    if (professionalMobile !== undefined && professionalMobile && !/^\d{10}$/.test(professionalMobile.replace(/[\s\-+]/g, '').slice(-10))) {
      validationErrors.push('Invalid professional mobile number format')
    }
    if (panNumber !== undefined && panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber.toUpperCase())) {
      validationErrors.push('Invalid PAN number format (expected: ABCDE1234F)')
    }
    if (aadhaarNumber !== undefined && aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ''))) {
      validationErrors.push('Invalid Aadhaar number (must be 12 digits)')
    }
    if (bankIfscCode !== undefined && bankIfscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfscCode.toUpperCase())) {
      validationErrors.push('Invalid IFSC code format (expected: ABCD0123456)')
    }
    if (professionalMail !== undefined && professionalMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(professionalMail)) {
      validationErrors.push('Invalid professional email format')
    }
    if (emergencyContactPhone !== undefined && emergencyContactPhone && !/^\d{10}$/.test(emergencyContactPhone.replace(/[\s\-+]/g, '').slice(-10))) {
      validationErrors.push('Invalid emergency contact phone number')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Sanitize text inputs to prevent XSS
    const s = (val: string | undefined) => val !== undefined ? sanitizeText(val) : undefined

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      last_updated_by: auth.userId,
      last_updated_timestamp: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Add professional fields if provided
    if (department !== undefined) updateData.department = s(department)
    if (designation !== undefined) updateData.designation = s(designation)
    if (professionalMail !== undefined) updateData.professional_mail = professionalMail
    if (location !== undefined) updateData.location = s(location)
    if (languagesKnown !== undefined) updateData.languages_known = languagesKnown
    if (reportingManagerId !== undefined) updateData.reporting_manager_id = reportingManagerId || null
    if (reportingManagerName !== undefined) updateData.reporting_manager_name = s(reportingManagerName)
    if (departmentJoinDate !== undefined) updateData.department_join_date = departmentJoinDate

    // Add personal fields - Basic (normalize empty strings to null for consistency)
    if (mobile !== undefined) updateData.mobile = mobile || null
    if (professionalMobile !== undefined) updateData.professional_mobile = professionalMobile || null
    if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth
    if (gender !== undefined) updateData.gender = gender
    if (bloodGroup !== undefined) updateData.blood_group = bloodGroup

    // Add personal fields - Identity (normalize PAN to uppercase)
    if (panNumber !== undefined) updateData.pan_number = panNumber ? panNumber.toUpperCase() : null
    if (aadhaarNumber !== undefined) updateData.aadhaar_number = aadhaarNumber ? aadhaarNumber.replace(/\s/g, '') : null

    // Add personal fields - Emergency Contact
    if (emergencyContactName !== undefined) updateData.emergency_contact_name = s(emergencyContactName)
    if (emergencyContactPhone !== undefined) updateData.emergency_contact_phone = emergencyContactPhone
    if (emergencyContactRelationship !== undefined) updateData.emergency_contact_relationship = s(emergencyContactRelationship)

    // Add personal fields - References
    if (reference1Name !== undefined) updateData.reference1_name = s(reference1Name)
    if (reference1Contact !== undefined) updateData.reference1_contact = reference1Contact
    if (reference1Relationship !== undefined) updateData.reference1_relationship = s(reference1Relationship)
    if (reference2Name !== undefined) updateData.reference2_name = s(reference2Name)
    if (reference2Contact !== undefined) updateData.reference2_contact = reference2Contact
    if (reference2Relationship !== undefined) updateData.reference2_relationship = s(reference2Relationship)

    // Add personal fields - Bank
    if (bankAccountNumber !== undefined) updateData.bank_account_number = bankAccountNumber
    if (bankName !== undefined) updateData.bank_name = s(bankName)
    if (bankBranch !== undefined) updateData.bank_branch = s(bankBranch)
    if (bankIfscCode !== undefined) updateData.bank_ifsc_code = bankIfscCode ? bankIfscCode.toUpperCase() : null
    if (bankMicrCode !== undefined) updateData.bank_micr_code = bankMicrCode || null

    // Add address fields (stored as JSONB)
    if (addressCurrent !== undefined) updateData.address_current = typeof addressCurrent === 'string' ? s(addressCurrent) : addressCurrent
    if (addressPermanent !== undefined) updateData.address_permanent = typeof addressPermanent === 'string' ? s(addressPermanent) : addressPermanent

    // Add document URLs
    if (presentAddressProofUrl !== undefined) updateData.present_address_proof_url = presentAddressProofUrl
    if (permanentAddressProofUrl !== undefined) updateData.permanent_address_proof_url = permanentAddressProofUrl
    if (panCardCopyUrl !== undefined) updateData.pan_card_copy_url = panCardCopyUrl
    if (aadhaarCardCopyUrl !== undefined) updateData.aadhaar_card_copy_url = aadhaarCardCopyUrl
    if (cancelledChequeUrl !== undefined) updateData.cancelled_cheque_url = cancelledChequeUrl

    // Check if profile has been submitted for review - if so, validate completeness isn't broken
    const { data: employeeCheck } = await supabase
      .from('employees')
      .select('profile_completed')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (employeeCheck?.profile_completed) {
      // If profile was already submitted for review, don't allow clearing required fields
      const requiredFieldsBeingCleared = []
      if (mobile === '') requiredFieldsBeingCleared.push('mobile')
      if (panNumber === '') requiredFieldsBeingCleared.push('PAN number')
      if (aadhaarNumber === '') requiredFieldsBeingCleared.push('Aadhaar number')
      if (bankAccountNumber === '') requiredFieldsBeingCleared.push('bank account number')
      if (bankIfscCode === '') requiredFieldsBeingCleared.push('IFSC code')
      if (emergencyContactName === '') requiredFieldsBeingCleared.push('emergency contact name')
      if (emergencyContactPhone === '') requiredFieldsBeingCleared.push('emergency contact phone')

      if (requiredFieldsBeingCleared.length > 0) {
        return NextResponse.json(
          { success: false, error: `Cannot clear required fields on a submitted profile: ${requiredFieldsBeingCleared.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (!existingProfile) {
      // Create new profile if it doesn't exist
      updateData.user_id = auth.userId
      const { error: insertError } = await supabase
        .from('profiles')
        .insert(updateData)

      if (insertError) {
        logger.error('Error creating profile', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to create profile' },
          { status: 500 }
        )
      }
    } else {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', auth.userId)

      if (updateError) {
        logger.error('Error updating profile', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        )
      }
    }

    logger.info('Profile updated successfully', { userId: auth.userId })

    // Audit trail: log which fields were updated
    const updatedFields = Object.keys(updateData).filter(k => !['last_updated_by', 'last_updated_timestamp', 'updated_at'].includes(k))
    if (updatedFields.length > 0) {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', auth.userId)
        .maybeSingle()

      if (empRecord) {
        logEmployeeActivity({
          employeeId: empRecord.id,
          action: 'PROFILE_UPDATED',
          actionDetails: { fields_updated: updatedFields },
          performedBy: auth.userId!,
          performedByRole: 'EMPLOYEE',
        }).catch(() => { /* Non-critical side effect */ }) // non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    logger.error('Error in PUT /api/employees/profile', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
