import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Loan Consent OTP Verification API
 * Verify OTP and grant/reject consent
 *
 * POST - Verify OTP and process consent
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
const verifyConsentSchema = z.object({
  consent_request_id: z.string().uuid(),
  otp: z.string().length(6).regex(/^\d+$/, 'OTP must be 6 digits'),
  action: z.enum(['GRANT', 'REJECT']),
})

/**
 * POST /api/customers/loan-consent/verify
 * Verify OTP and process consent decision
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
// Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = verifyConsentSchema.parse(body)

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
      await supabaseAdmin
        .from('loan_consent_requests')
        .update({ consent_status: 'EXPIRED' })
        .eq('id', validatedData.consent_request_id)

      return NextResponse.json(
        { success: false, error: 'Consent request has expired' },
        { status: 400 }
      )
    }

    // Check OTP expiry
    if (new Date(consentRequest.otp_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check OTP attempts (max 3)
    if (consentRequest.otp_attempts >= 3) {
      await supabaseAdmin
        .from('loan_consent_requests')
        .update({ consent_status: 'BLOCKED' })
        .eq('id', validatedData.consent_request_id)

      return NextResponse.json(
        { success: false, error: 'Too many failed attempts. Request has been blocked.' },
        { status: 400 }
      )
    }

    // Verify OTP
    const otpHash = await hashOTP(validatedData.otp)
    if (otpHash !== consentRequest.otp_hash) {
      // Increment attempts
      await supabaseAdmin
        .from('loan_consent_requests')
        .update({ otp_attempts: consentRequest.otp_attempts + 1 })
        .eq('id', validatedData.consent_request_id)

      const remainingAttempts = 2 - consentRequest.otp_attempts
      return NextResponse.json(
        {
          success: false,
          error: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : 'Request will be blocked.'}`
        },
        { status: 400 }
      )
    }

    // OTP verified - process consent
    const now = new Date().toISOString()

    if (validatedData.action === 'GRANT') {
      // Check if user exists with this mobile number
      let targetIndividualId = consentRequest.target_individual_id

      if (!targetIndividualId) {
        // Create new individual profile (auto-registration)
        const { data: newIndividual, error: createError } = await supabaseAdmin
          .from('individuals')
          .insert({
            full_name: consentRequest.full_name,
            mobile_number: consentRequest.mobile_number,
            email: consentRequest.email,
            pan_number: consentRequest.pan_number,
            // Mark as created via consent
            is_auto_registered: true,
            auto_registered_via: 'LOAN_CONSENT',
            auto_registered_at: now
          })
          .select()
          .maybeSingle()

        if (createError) {
          apiLogger.error('Error creating individual', createError)
          return NextResponse.json(
            { success: false, error: 'Failed to create profile' },
            { status: 500 }
          )
        }

        targetIndividualId = newIndividual.id
      }

      // Update consent request
      await supabaseAdmin
        .from('loan_consent_requests')
        .update({
          consent_status: 'GRANTED',
          responded_at: now,
          target_individual_id: targetIndividualId,
          otp_verified_at: now
        })
        .eq('id', validatedData.consent_request_id)

      // If this is for an entity, create the entity link
      if (consentRequest.entity_id) {
        const { error: linkError } = await supabaseAdmin
          .from('individual_entity_links')
          .insert({
            individual_id: targetIndividualId,
            entity_id: consentRequest.entity_id,
            role_code: consentRequest.role_code || 'MEMBER',
            role_name: consentRequest.role_name || 'Member',
            ownership_percentage: consentRequest.ownership_percentage,
            consent_status: 'GRANTED',
            consent_date: now,
            consent_method: 'OTP',
            consent_request_id: consentRequest.id,
            status: 'ACTIVE'
          })

        if (linkError) {
          apiLogger.error('Error creating entity link', linkError)
          // Don't fail the whole request, just log it
        }
      }

      // If this is for a loan application, update co-applicant/guarantor status
      if (consentRequest.loan_application_id) {
        // Update the loan applicant profile
        await supabaseAdmin
          .from('loan_applicant_profiles')
          .update({
            consent_status: 'GRANTED',
            consent_date: now,
            individual_id: targetIndividualId
          })
          .eq('loan_application_id', consentRequest.loan_application_id)
          .eq('mobile_number', consentRequest.mobile_number)
          .eq('applicant_type', consentRequest.applicant_type)
      }

      return NextResponse.json({
        success: true,
        message: 'Consent granted successfully',
        action: 'GRANTED',
        individualId: targetIndividualId,
        isNewUser: !consentRequest.target_individual_id
      })

    } else {
      // REJECT consent
      await supabaseAdmin
        .from('loan_consent_requests')
        .update({
          consent_status: 'REJECTED',
          responded_at: now,
          otp_verified_at: now
        })
        .eq('id', validatedData.consent_request_id)

      // Update loan applicant profile if applicable
      if (consentRequest.loan_application_id) {
        await supabaseAdmin
          .from('loan_applicant_profiles')
          .update({
            consent_status: 'REJECTED',
            consent_date: now
          })
          .eq('loan_application_id', consentRequest.loan_application_id)
          .eq('mobile_number', consentRequest.mobile_number)
      }

      return NextResponse.json({
        success: true,
        message: 'Consent rejected',
        action: 'REJECTED'
      })
    }

  } catch (error) {
    apiLogger.error('Loan Consent Verify POST error', error)

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
