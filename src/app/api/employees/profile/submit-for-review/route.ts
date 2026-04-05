export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { calculateProfileCompletion } from '@/lib/utils/profile-completion'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const runtime = 'nodejs'

/**
 * Verify employee authentication (reused pattern)
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

  const roleUpper = sessionData.role?.toUpperCase()
  if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
    return { authorized: false, error: 'Forbidden - Employee access required' }
  }

  return { authorized: true, userId: sessionData.userId }
}

/**
 * POST /api/employees/profile/submit-for-review
 * Employee submits their completed profile for HR review
 * Changes employee_status from PENDING_ONBOARDING to PENDING_PROFILE_REVIEW
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
    const auth = await verifyEmployee(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.error?.startsWith('Forbidden') ? 403 : 401 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch current employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, employee_status, department_id, sub_role, reporting_manager_id')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Only allow submission from PENDING_ONBOARDING or NEEDS_PROFILE_CORRECTION status
    const allowedStatuses = ['PENDING_ONBOARDING', 'NEEDS_PROFILE_CORRECTION']
    if (!allowedStatuses.includes(employee.employee_status)) {
      return NextResponse.json(
        { success: false, error: `Cannot submit for review from status: ${employee.employee_status}` },
        { status: 400 }
      )
    }

    // Fetch profile to calculate completion
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', auth.userId)
      .maybeSingle()

    // Fetch user data for name/email
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', auth.userId)
      .maybeSingle()

    // Calculate profile completion
    const completionData = calculateProfileCompletion({
      full_name: userData?.full_name,
      date_of_birth: profile?.date_of_birth,
      gender: profile?.gender,
      blood_group: profile?.blood_group,
      mobile_number: profile?.mobile,
      personal_email: userData?.email,
      work_email: profile?.professional_mail || userData?.email,
      emergency_contact_name: profile?.emergency_contact_name,
      emergency_contact_number: profile?.emergency_contact_phone,
      emergency_contact_relation: profile?.emergency_contact_relationship,
      present_address: profile?.address_current,
      permanent_address: profile?.address_permanent,
      pan_number: profile?.pan_number,
      pan_card_url: profile?.pan_card_copy_url,
      aadhaar_number: profile?.aadhaar_number,
      aadhaar_card_url: profile?.aadhaar_card_copy_url,
      bank_account_number: profile?.bank_account_number,
      bank_name: profile?.bank_name,
      ifsc_code: profile?.bank_ifsc_code,
      cancelled_cheque_url: profile?.cancelled_cheque_url,
      department_id: employee.department_id,
      sub_role: employee.sub_role,
      reporting_manager_id: profile?.reporting_manager_id || employee.reporting_manager_id,
      present_address_proof_url: profile?.present_address_proof_url,
      permanent_address_proof_url: profile?.permanent_address_proof_url,
      reference1_name: profile?.reference1_name,
      reference1_contact: profile?.reference1_contact,
      reference2_name: profile?.reference2_name,
      reference2_contact: profile?.reference2_contact,
    })

    // Require all mandatory fields to be filled
    if (!completionData.mandatoryComplete) {
      return NextResponse.json({
        success: false,
        error: 'Profile is not complete. Please fill all mandatory fields before submitting.',
        missingFields: completionData.missingFields,
        completion: completionData.percentage,
      }, { status: 400 })
    }

    // Update employee status to PENDING_PROFILE_REVIEW
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        employee_status: 'PENDING_PROFILE_REVIEW',
        updated_at: new Date().toISOString(),
      })
      .eq('id', employee.id)

    if (updateError) {
      logger.error('Error updating employee status for review:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to submit profile for review' },
        { status: 500 }
      )
    }

    logger.info(`Employee ${employee.employee_id} submitted profile for HR review`)

    // CROSS-2: Create in-app notification for HR about the profile submission
    try {
      // Find HR users to notify
      const { data: hrUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'EMPLOYEE')
        .in('sub_role', ['HR_MANAGER', 'HR_EXECUTIVE', 'HR'])
        .limit(10)

      if (hrUsers && hrUsers.length > 0) {
        // Create a system notification for each HR user
        const notificationInserts = hrUsers.map(hr => ({
          user_id: hr.id,
          admin_id: hr.id,
          recipient_id: hr.id,
          title: `Profile Review Request: ${userData?.full_name || 'Employee'}`,
          message: `${userData?.full_name || 'An employee'} (${employee.employee_id}) has submitted their profile for review. Profile completion: ${completionData.percentage}%.`,
          type: 'onboarding',
          category: 'profile_review',
          priority: 'normal',
          action_url: `/employees/hr/profile-reviews`,
          action_label: 'Review Profile',
          is_read: false,
          created_at: new Date().toISOString(),
        }))

        await supabase
          .from('in_app_notifications')
          .insert(notificationInserts)
          .then(() => {})
          .catch((err: Error) => logger.warn('Failed to create HR notification', err))
      }

      // Also create a confirmation notification for the employee
      await supabase
        .from('in_app_notifications')
        .insert({
          user_id: auth.userId,
          admin_id: auth.userId,
          recipient_id: auth.userId,
          title: 'Profile Submitted for Review',
          message: 'Your profile has been submitted for HR review. You will be notified once the review is complete.',
          type: 'system',
          category: 'profile_review',
          priority: 'normal',
          is_read: false,
          created_at: new Date().toISOString(),
        })
        .then(() => {})
        .catch((err: Error) => logger.warn('Failed to create employee confirmation notification', err))
    } catch (notifError) {
      // Non-critical: don't fail the submission if notification fails
      logger.warn('Failed to send profile review notifications', notifError)
    }

    return NextResponse.json({
      success: true,
      message: 'Profile submitted for HR review successfully. You will be notified once reviewed.',
      data: {
        employee_id: employee.employee_id,
        new_status: 'PENDING_PROFILE_REVIEW',
        completion_percentage: completionData.percentage,
      }
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/profile/submit-for-review:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
