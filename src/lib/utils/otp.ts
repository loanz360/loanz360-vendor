/**
 * OTP (One-Time Password) Utilities
 * For customer authentication and password reset
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * OTP Configuration
 */
const OTP_CONFIG = {
  length: 6, // 6-digit OTP
  expiryMinutes: 10, // OTP valid for 10 minutes
  maxAttempts: 3, // Maximum verification attempts
  blockDurationMinutes: 30, // Block for 30 minutes after max attempts
  resendDelaySeconds: 60, // Can resend after 60 seconds
}

/**
 * Generate random OTP code
 */
export function generateOTP(length: number = OTP_CONFIG.length): string {
  // Generate cryptographically secure random number
  const min = Math.pow(10, length - 1)
  const max = Math.pow(10, length) - 1

  const randomBuffer = crypto.randomBytes(4)
  const randomNumber = randomBuffer.readUInt32BE(0)

  // Map to desired range
  const otp = min + (randomNumber % (max - min + 1))

  return otp.toString().padStart(length, '0')
}

/**
 * Create OTP record in database
 */
export async function createOTP(params: {
  customerId?: string
  mobile?: string
  email?: string
  otpType: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'MOBILE_VERIFICATION'
  purpose?: string
}): Promise<{
  success: boolean
  otpId?: string
  otpCode?: string
  expiresAt?: Date
  error?: string
}> {
  try {
    // Validate input
    if (!params.mobile && !params.email) {
      return {
        success: false,
        error: 'Mobile or email is required',
      }
    }

    // Check if there's an existing valid OTP
    const { data: existingOTP } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('mobile', params.mobile || '')
      .eq('otp_type', params.otpType)
      .eq('is_verified', false)
      .eq('is_expired', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // If OTP was created recently, return rate limit error
    if (existingOTP) {
      const createdAt = new Date(existingOTP.created_at)
      const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000

      if (secondsSinceCreation < OTP_CONFIG.resendDelaySeconds) {
        return {
          success: false,
          error: `Please wait ${Math.ceil(OTP_CONFIG.resendDelaySeconds - secondsSinceCreation)} seconds before requesting a new OTP`,
        }
      }
    }

    // Mark existing OTPs as expired
    if (params.mobile) {
      await supabase
        .from('otp_verifications')
        .update({ is_expired: true })
        .eq('mobile', params.mobile)
        .eq('otp_type', params.otpType)
        .eq('is_verified', false)
    }

    // Generate OTP code
    const otpCode = generateOTP()

    // Calculate expiry
    const expiresAt = new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000)

    // Create OTP record
    const { data, error } = await supabase
      .from('otp_verifications')
      .insert({
        customer_id: params.customerId,
        mobile: params.mobile,
        email: params.email,
        otp_code: otpCode,
        otp_type: params.otpType,
        purpose: params.purpose,
        expires_at: expiresAt.toISOString(),
        max_attempts: OTP_CONFIG.maxAttempts,
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error('Create OTP Error:', error)
      return {
        success: false,
        error: `Failed to create OTP: ${error.message}`,
      }
    }

    // Send OTP via SMS (only if mobile is provided)
    if (params.mobile) {
      try {
        // Dynamically import SMS service (to avoid circular dependencies)
        const { smsService } = await import('@/lib/communication/unified-sms-service')

        // Determine template code based on OTP type
        let templateCode = 'OTP_LOGIN'
        if (params.otpType === 'PASSWORD_RESET') {
          templateCode = 'OTP_PASSWORD_RESET'
        }

        // Send SMS
        await smsService.sendOTP({
          phone: params.mobile,
          otp: otpCode,
          validity: OTP_CONFIG.expiryMinutes,
          templateCode,
          userId: params.customerId
        })

      } catch (smsError) {
        console.error('Failed to send OTP SMS:', smsError)
        // Don't fail the OTP creation if SMS fails
        // In dev mode, still return the OTP code
      }
    }

    // TODO: Send OTP via Email (when email is provided)
    if (params.email) {
    }

    return {
      success: true,
      otpId: data.id,
      otpCode: process.env.NODE_ENV === 'development' ? otpCode : undefined,
      expiresAt,
    }
  } catch (error) {
    console.error('Create OTP Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(params: {
  mobile?: string
  email?: string
  otpCode: string
  otpType: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'MOBILE_VERIFICATION'
  verificationIp?: string
  verificationUserAgent?: string
}): Promise<{
  success: boolean
  verified: boolean
  customerId?: string
  otpId?: string
  requiresPasswordSetup?: boolean
  error?: string
}> {
  try {
    // Find OTP record
    let query = supabase
      .from('otp_verifications')
      .select('*')
      .eq('otp_type', params.otpType)
      .eq('is_verified', false)
      .eq('is_expired', false)
      .order('created_at', { ascending: false })
      .limit(1)

    if (params.mobile) {
      query = query.eq('mobile', params.mobile)
    } else if (params.email) {
      query = query.eq('email', params.email)
    } else {
      return {
        success: false,
        verified: false,
        error: 'Mobile or email is required',
      }
    }

    const { data: otpRecord, error: fetchError } = await query.maybeSingle()

    if (fetchError || !otpRecord) {
      return {
        success: false,
        verified: false,
        error: 'OTP not found or expired',
      }
    }

    // Check if blocked
    if (otpRecord.is_blocked && otpRecord.blocked_until) {
      const blockedUntil = new Date(otpRecord.blocked_until)
      if (blockedUntil > new Date()) {
        const minutesRemaining = Math.ceil(
          (blockedUntil.getTime() - Date.now()) / 1000 / 60
        )
        return {
          success: false,
          verified: false,
          error: `Too many incorrect attempts. Please try again in ${minutesRemaining} minutes`,
        }
      }
    }

    // Check expiry
    const expiresAt = new Date(otpRecord.expires_at)
    if (expiresAt < new Date()) {
      await supabase
        .from('otp_verifications')
        .update({ is_expired: true })
        .eq('id', otpRecord.id)

      return {
        success: false,
        verified: false,
        error: 'OTP has expired. Please request a new one',
      }
    }

    // Verify code
    if (otpRecord.otp_code !== params.otpCode) {
      // Increment attempt count
      const newAttemptCount = otpRecord.attempt_count + 1

      // Check if max attempts reached
      if (newAttemptCount >= otpRecord.max_attempts) {
        const blockedUntil = new Date(
          Date.now() + OTP_CONFIG.blockDurationMinutes * 60 * 1000
        )

        await supabase
          .from('otp_verifications')
          .update({
            attempt_count: newAttemptCount,
            is_blocked: true,
            blocked_until: blockedUntil.toISOString(),
          })
          .eq('id', otpRecord.id)

        return {
          success: false,
          verified: false,
          error: `Maximum attempts exceeded. Please try again in ${OTP_CONFIG.blockDurationMinutes} minutes`,
        }
      }

      // Update attempt count
      await supabase
        .from('otp_verifications')
        .update({ attempt_count: newAttemptCount })
        .eq('id', otpRecord.id)

      return {
        success: false,
        verified: false,
        error: `Incorrect OTP. ${otpRecord.max_attempts - newAttemptCount} attempts remaining`,
      }
    }

    // OTP is correct - mark as verified
    await supabase
      .from('otp_verifications')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        verification_ip: params.verificationIp,
        verification_user_agent: params.verificationUserAgent,
      })
      .eq('id', otpRecord.id)

    // Update customer if exists
    let customerId: string | undefined
    let requiresPasswordSetup = false

    if (otpRecord.customer_id) {
      customerId = otpRecord.customer_id

      // Update customer OTP verification status
      await supabase
        .from('customers')
        .update({
          otp_verified: true,
          otp_verified_at: new Date().toISOString(),
        })
        .eq('id', customerId)

      // Check if password is set
      const { data: customer } = await supabase
        .from('customers')
        .select('password_hash')
        .eq('id', customerId)
        .maybeSingle()

      requiresPasswordSetup = !customer?.password_hash
    } else if (params.mobile && params.otpType === 'LOGIN') {
      // Find customer by mobile
      const { data: customer } = await supabase
        .from('customers')
        .select('id, password_hash')
        .eq('mobile', params.mobile)
        .maybeSingle()

      if (customer) {
        customerId = customer.id
        requiresPasswordSetup = !customer.password_hash

        // Update OTP verification with customer ID
        await supabase
          .from('otp_verifications')
          .update({ customer_id: customerId })
          .eq('id', otpRecord.id)

        // Update customer
        await supabase
          .from('customers')
          .update({
            otp_verified: true,
            otp_verified_at: new Date().toISOString(),
          })
          .eq('id', customerId)
      }
    }

    return {
      success: true,
      verified: true,
      customerId,
      otpId: otpRecord.id,
      requiresPasswordSetup,
    }
  } catch (error) {
    console.error('Verify OTP Error:', error)
    return {
      success: false,
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Resend OTP (creates new OTP and expires old one)
 */
export async function resendOTP(params: {
  mobile?: string
  email?: string
  otpType: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION' | 'MOBILE_VERIFICATION'
}): Promise<{
  success: boolean
  otpId?: string
  otpCode?: string
  expiresAt?: Date
  error?: string
}> {
  return createOTP(params)
}

/**
 * Clean up expired OTPs (maintenance function)
 */
export async function cleanupExpiredOTPs(): Promise<{
  success: boolean
  deletedCount?: number
  error?: string
}> {
  try {
    // Mark all expired OTPs
    await supabase
      .from('otp_verifications')
      .update({ is_expired: true })
      .lt('expires_at', new Date().toISOString())
      .eq('is_expired', false)

    // Optionally delete very old OTPs (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('otp_verifications')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())

    if (error) {
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      deletedCount: data?.length || 0,
    }
  } catch (error) {
    console.error('Cleanup Expired OTPs Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Format mobile number (add country code if missing)
 */
export function formatMobileNumber(mobile: string, countryCode: string = '+91'): string {
  // Remove all non-digit characters
  const digitsOnly = mobile.replace(/\D/g, '')

  // If starts with country code digits, return as is
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
    return '+' + digitsOnly
  }

  // If 10 digits, add country code
  if (digitsOnly.length === 10) {
    return countryCode + digitsOnly
  }

  // Otherwise return as is
  return mobile
}

/**
 * Validate mobile number format
 */
export function validateMobileNumber(mobile: string): {
  valid: boolean
  formatted?: string
  error?: string
} {
  const digitsOnly = mobile.replace(/\D/g, '')

  // Check if 10 digits
  if (digitsOnly.length === 10) {
    return {
      valid: true,
      formatted: formatMobileNumber(digitsOnly),
    }
  }

  // Check if 12 digits with country code
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return {
      valid: true,
      formatted: '+' + digitsOnly,
    }
  }

  return {
    valid: false,
    error: 'Mobile number must be 10 digits',
  }
}
