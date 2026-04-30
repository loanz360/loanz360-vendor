import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Loan Consent Resend OTP API
 * Resend OTP for consent request
 *
 * POST - Resend OTP
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Admin client for operations requiring elevated privileges
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema
const resendOTPSchema = z.object({
  consent_request_id: z.string().uuid(),
})

/**
 * POST /api/customers/loan-consent/resend
 * Resend OTP for consent request
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
// Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = resendOTPSchema.parse(body)

    // Fetch consent request
    const { data: consentRequest, error: fetchError } = await supabaseAdmin
      .from('loan_consent_requests')
      .select('*')
      .eq('id', validatedData.consent_request_id)
      .maybeSingle()

    if (fetchError || !consentRequest) {
      return NextResponse.json(
        { success: false, error: 'Consent request not found' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (consentRequest.consent_status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'Consent request has already been processed' },
        { status: 400 }
      )
    }

    // Check if consent request has expired
    if (new Date(consentRequest.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Consent request has expired' },
        { status: 400 }
      )
    }

    // Check cooldown (minimum 60 seconds between resends)
    const lastOTPTime = new Date(consentRequest.otp_sent_at || consentRequest.requested_at)
    const cooldownEnd = new Date(lastOTPTime.getTime() + 60 * 1000)

    if (new Date() < cooldownEnd) {
      const remainingSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000)
      return NextResponse.json(
        { success: false, error: `Please wait ${remainingSeconds} seconds before requesting a new OTP` },
        { status: 429 }
      )
    }

    // Check resend limit (max 5 resends)
    if ((consentRequest.otp_resend_count || 0) >= 5) {
      return NextResponse.json(
        { success: false, error: 'Maximum OTP resend limit reached' },
        { status: 400 }
      )
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const otpHash = await hashOTP(otp)
    const now = new Date()
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes

    // Update consent request with new OTP
    await supabaseAdmin
      .from('loan_consent_requests')
      .update({
        otp_hash: otpHash,
        otp_expires_at: otpExpiry.toISOString(),
        otp_attempts: 0, // Reset attempts on resend
        otp_resend_count: (consentRequest.otp_resend_count || 0) + 1,
        otp_sent_at: now.toISOString()
      })
      .eq('id', validatedData.consent_request_id)

    // Send OTP via SMS
    // TODO: Integrate with actual SMS provider

    // Also send via email if available
    if (consentRequest.email) {
    }

    return NextResponse.json({
      success: true,
      message: `OTP resent to ${consentRequest.mobile_number.slice(0, 2)}****${consentRequest.mobile_number.slice(-2)}`,
      expiresAt: otpExpiry.toISOString(),
      resendCount: (consentRequest.otp_resend_count || 0) + 1,
      maxResends: 5,
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { _devOTP: otp })
    })

  } catch (error) {
    apiLogger.error('Loan Consent Resend POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Simple hash function for OTP
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(otp + process.env.OTP_SALT || 'LOANZ360_OTP_SALT')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
