
/**
 * Customer OTP Login API
 * Generates and sends OTP for customer login
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createOTP, validateMobileNumber } from '@/lib/utils/otp'
import type { OTPRequest, OTPResponse } from '@/types/enterprise-leads'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
    if (rateLimitResponse) return rateLimitResponse
const body: OTPRequest = await request.json()

    // Validate mobile number
    const validation = validateMobileNumber(body.mobile)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || 'Invalid mobile number',
        } as OTPResponse,
        { status: 400 }
      )
    }

    // Create OTP
    const result = await createOTP({
      mobile: validation.formatted!,
      otpType: body.otp_type,
      purpose: body.purpose,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        } as OTPResponse,
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      otp_id: result.otpId,
      expires_at: result.expiresAt?.toISOString(),
    } as OTPResponse)
  } catch (error) {
    apiLogger.error('OTP Login Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as OTPResponse,
      { status: 500 }
    )
  }
}
