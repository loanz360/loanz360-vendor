/**
 * API Route: Run Single Verification
 * POST /api/cae/verify/[type]
 *
 * Runs a specific verification check for a loan application
 * Types: pan, aadhaar, itr, gst, bank-statement, account-aggregator,
 *        penny-drop, mca, udyam, aml, cersai, litigation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import {
  verificationService,
  VerificationType,
  VerificationResult,
} from '@/lib/cae/verification-service'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Map URL params to verification types
const typeMapping: Record<string, VerificationType> = {
  'pan': 'IDENTITY_PAN',
  'aadhaar': 'IDENTITY_AADHAAR',
  'digilocker': 'IDENTITY_DIGILOCKER',
  'itr': 'INCOME_ITR',
  'gst': 'INCOME_GST',
  'bank-statement': 'INCOME_BANK_STATEMENT',
  'account-aggregator': 'INCOME_ACCOUNT_AGGREGATOR',
  'penny-drop': 'BANK_ACCOUNT_PENNY_DROP',
  'mca': 'BUSINESS_MCA',
  'udyam': 'BUSINESS_UDYAM',
  'aml': 'AML_SCREENING',
  'cersai': 'COLLATERAL_CERSAI',
  'litigation': 'LITIGATION_CHECK',
  'video-kyc': 'VIDEO_KYC',
}

interface SingleVerifyResponse {
  success: boolean
  data?: VerificationResult
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { type } = await params
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' } as SingleVerifyResponse, {
        status: 401,
      })
    }

    // Validate verification type
    const verificationType = typeMapping[type]
    if (!verificationType) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid verification type: ${type}. Valid types: ${Object.keys(typeMapping).join(', ')}`,
        } as SingleVerifyResponse,
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()

    if (!body.lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' } as SingleVerifyResponse,
        { status: 400 }
      )
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
        entity_type,
        gstin,
        cin,
        udyam_number
      `)
      .eq('id', body.lead_id)
      .maybeSingle()

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead not found' } as SingleVerifyResponse,
        { status: 404 }
      )
    }

    // Merge body overrides with lead data
    const applicantDetails = {
      name: body.name || lead.customer_name,
      pan: body.pan || lead.customer_pan,
      aadhaar: body.aadhaar || lead.customer_aadhar,
      mobile: body.mobile || lead.customer_mobile,
      email: body.email || lead.customer_email,
      dob: body.dob || lead.customer_dob,
      father_name: body.father_name,
      address: body.address || lead.customer_address,
      city: body.city || lead.customer_city,
      state: body.state || lead.customer_state,
      pincode: body.pincode || lead.customer_pincode,
      entity_type: body.entity_type || lead.entity_type || 'INDIVIDUAL',
      gstin: body.gstin || lead.gstin,
      cin: body.cin || lead.cin,
      udyam_number: body.udyam_number || lead.udyam_number,
      // Bank account details for penny drop
      account_number: body.account_number,
      ifsc_code: body.ifsc_code,
    }

    // Run single verification
    const result = await verificationService.runSingleVerification(verificationType, {
      lead_id: body.lead_id,
      verification_types: [verificationType],
      applicant_details: applicantDetails,
      loan_details: {
        loan_type: lead.loan_type,
        loan_amount: lead.required_loan_amount,
        collateral_type: body.collateral_type,
        collateral_details: body.collateral_details,
      },
    })

    return NextResponse.json({
      success: result.status === 'COMPLETED',
      data: result,
    } as SingleVerifyResponse)
  } catch (error) {
    apiLogger.error('Single verification error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      } as SingleVerifyResponse,
      { status: 500 }
    )
  }
}
