/**
 * OTP/2FA Service
 * Handles OTP generation, sending, and verification
 * Ready for SMS provider integration (Twilio, MSG91, etc.)
 *
 * Usage:
 *   import { sendOTP, verifyOTP } from '@/lib/integrations/otp-service'
 *   await sendOTP(mobile, 'PROFILE_EDIT')
 *   const isValid = await verifyOTP(mobile, code, 'PROFILE_EDIT')
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type OTPPurpose =
  | 'PROFILE_EDIT'
  | 'LOAN_SUBMIT'
  | 'DOCUMENT_DELETE'
  | 'PASSWORD_CHANGE'
  | 'BANK_DETAILS_UPDATE'

interface OTPResult {
  success: boolean
  message: string
  expiresIn?: number
}

/**
 * Generate and send OTP to mobile number
 * Currently stores OTP in database for verification
 * TODO: Connect to SMS provider (Twilio/MSG91) for actual SMS delivery
 */
export async function sendOTP(
  mobile: string,
  purpose: OTPPurpose,
  userId: string
): Promise<OTPResult> {
  const adminClient = createAdminClient()

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min expiry

  // Store OTP in database
  const { error } = await adminClient
    .from('otp_verifications')
    .upsert({
      user_id: userId,
      mobile,
      otp_code: otp,
      purpose,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      is_verified: false,
    }, {
      onConflict: 'user_id,purpose',
    })

  if (error) {
    return { success: false, message: 'Failed to generate OTP' }
  }

  // TODO: Send via SMS provider
  // await smsProvider.send(mobile, `Your LOANZ 360 OTP is: ${otp}. Valid for 5 minutes.`)

  return {
    success: true,
    message: 'OTP sent successfully',
    expiresIn: 300,
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  userId: string,
  code: string,
  purpose: OTPPurpose
): Promise<OTPResult> {
  const adminClient = createAdminClient()

  const { data: otpRecord, error } = await adminClient
    .from('otp_verifications')
    .select('*')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .eq('is_verified', false)
    .maybeSingle()

  if (error || !otpRecord) {
    return { success: false, message: 'No pending OTP found. Please request a new one.' }
  }

  // Check expiry
  if (new Date(otpRecord.expires_at) < new Date()) {
    return { success: false, message: 'OTP has expired. Please request a new one.' }
  }

  // Check max attempts
  if (otpRecord.attempts >= 3) {
    return { success: false, message: 'Maximum attempts exceeded. Please request a new OTP.' }
  }

  // Increment attempts
  await adminClient
    .from('otp_verifications')
    .update({ attempts: otpRecord.attempts + 1 })
    .eq('id', otpRecord.id)

  // Verify code
  if (otpRecord.otp_code !== code) {
    return { success: false, message: 'Invalid OTP. Please try again.' }
  }

  // Mark as verified
  await adminClient
    .from('otp_verifications')
    .update({ is_verified: true })
    .eq('id', otpRecord.id)

  return { success: true, message: 'OTP verified successfully' }
}
