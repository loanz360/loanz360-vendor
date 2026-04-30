/**
 * API Route: Run Comprehensive Verification
 * POST /api/cae/verify
 *
 * Runs comprehensive verification checks for a loan application
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import {
  verificationService,
  VerificationRequest,
  VerificationType,
  ComprehensiveVerificationResult,
} from '@/lib/cae/verification-service'
import { apiLogger } from '@/lib/utils/logger'


interface VerifyRequestBody {
  lead_id: string
  verification_types?: VerificationType[]
  parallel?: boolean
  skip_on_failure?: boolean
}

interface VerifyResponse {
  success: boolean
  data?: ComprehensiveVerificationResult
  error?: string
}

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } as VerifyResponse, {
        status: 401,
      })
    }

    // Parse request body
    const body: VerifyRequestBody = await request.json()

    if (!body.lead_id) {
      return NextResponse.json({ success: false, error: 'lead_id is required' } as VerifyResponse, {
        status: 400,
      })
    }

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select(`
        id,
        lead_id,
        customer_name,
        customer_mobile,
        customer_email,
        customer_pan,
        customer_aadhar,
        customer_dob,
        customer_address,
        customer_city,
        customer_state,
        customer_pincode,
        loan_type,
        required_loan_amount,
        employment_type,
        employer_name,
        entity_type,
        business_name,
        gstin,
        cin,
        udyam_number
      `)
      .eq('id', body.lead_id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' } as VerifyResponse, {
        status: 404,
      })
    }

    // Determine verification types based on loan type if not specified
    const verificationType = body.verification_types ||
      verificationService.getVerificationRequirements(
        lead.loan_type,
        lead.entity_type || 'INDIVIDUAL'
      )

    // Build verification request
    const verificationRequest: VerificationRequest = {
      lead_id: body.lead_id,
      verification_types: verificationType,
      applicant_details: {
        name: lead.customer_name,
        pan: lead.customer_pan,
        aadhaar: lead.customer_aadhar,
        mobile: lead.customer_mobile,
        email: lead.customer_email,
        dob: lead.customer_dob,
        address: lead.customer_address,
        city: lead.customer_city,
        state: lead.customer_state,
        pincode: lead.customer_pincode,
        entity_type: lead.entity_type as any,
        gstin: lead.gstin,
        cin: lead.cin,
        udyam_number: lead.udyam_number,
      },
      loan_details: {
        loan_type: lead.loan_type,
        loan_amount: lead.required_loan_amount,
      },
      options: {
        parallel: body.parallel ?? false,
        skip_on_failure: body.skip_on_failure ?? true,
      },
    }

    // Run comprehensive verification
    const result = await verificationService.runComprehensiveVerification(verificationRequest)

    return NextResponse.json({
      success: true,
      data: result,
    } as VerifyResponse)
  } catch (error) {
    apiLogger.error('Verification error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as VerifyResponse,
      { status: 500 }
    )
  }
}
