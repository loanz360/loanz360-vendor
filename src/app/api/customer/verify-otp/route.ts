export const dynamic = 'force-dynamic'

/**
 * Customer OTP Verification API
 * Verifies OTP and creates session with full audit trail
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, validateMobileNumber } from '@/lib/utils/otp'
import { SignJWT } from 'jose'
import { createAdminClient } from '@/lib/supabase/admin'
import { logSecurityEvent } from '@/lib/security/security-logger'
import type { OTPVerifyRequest, OTPVerifyResponse } from '@/types/enterprise-leads'
import { apiLogger } from '@/lib/utils/logger'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  try {
    const body: OTPVerifyRequest = await request.json()

    // Validate mobile number
    const validation = validateMobileNumber(body.mobile)
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: validation.error || 'Invalid mobile number',
        } as OTPVerifyResponse,
        { status: 400 }
      )
    }

    // Verify OTP
    const result = await verifyOTP({
      mobile: validation.formatted!,
      otpCode: body.otp_code,
      otpType: body.otp_type,
      verificationIp: clientIp,
      verificationUserAgent: userAgent,
    })

    if (!result.success || !result.verified) {
      // Log failed OTP verification
      logSecurityEvent({
        event: 'CUSTOMER_LOGIN_INVALID_PASSWORD',
        severity: 'warning',
        ip: clientIp,
        userAgent,
        requestId,
        userId: result.customerId || undefined,
        details: { method: 'OTP', mobile: validation.formatted },
      }).catch(() => { /* Non-critical side effect */ })

      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: result.error || 'OTP verification failed',
        } as OTPVerifyResponse,
        { status: 400 }
      )
    }

    // Generate unique token ID for session tracking
    const tokenId = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days

    // Generate JWT token with jti for session revocation support
    const token = await new SignJWT({
      customerId: result.customerId,
      mobile: validation.formatted,
      type: 'customer',
      jti: tokenId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    // Log session and update login metadata (non-blocking)
    if (result.customerId) {
      const adminClient = createAdminClient()

      // Update last login metadata on customer record
      adminClient
        .from('customers')
        .update({
          last_login: new Date().toISOString(),
          last_login_ip: clientIp,
          last_login_user_agent: userAgent.slice(0, 500),
          failed_login_attempts: 0,
          locked_until: null,
        })
        .eq('id', result.customerId)
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })

      // Insert session record for audit trail
      adminClient
        .from('customer_sessions')
        .insert({
          customer_id: result.customerId,
          token_id: tokenId,
          ip_address: clientIp,
          user_agent: userAgent.slice(0, 500),
          expires_at: new Date(expiresAt * 1000).toISOString(),
          created_at: new Date().toISOString(),
        })
        .then(() => {})
        .catch(() => { /* Non-critical side effect */ })

      // Log security event
      logSecurityEvent({
        event: 'CUSTOMER_LOGIN_SUCCESS',
        severity: 'info',
        ip: clientIp,
        userAgent,
        requestId,
        userId: result.customerId,
        details: { method: 'OTP', mobile: validation.formatted },
      }).catch(() => { /* Non-critical side effect */ })
    }

    const response = NextResponse.json({
      success: true,
      verified: true,
      customer_id: result.customerId,
      requires_password_setup: result.requiresPasswordSetup,
      access_token: token,
    } as OTPVerifyResponse)

    // Set secure HTTP-only cookie
    response.cookies.set('customer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    apiLogger.error('OTP Verification Error', error)

    logSecurityEvent({
      event: 'CUSTOMER_LOGIN_ERROR',
      severity: 'error',
      ip: clientIp,
      userAgent,
      requestId,
      details: { method: 'OTP', error: 'Internal server error' },
    }).catch(() => { /* Non-critical side effect */ })

    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: 'Internal server error',
      } as OTPVerifyResponse,
      { status: 500 }
    )
  }
}
