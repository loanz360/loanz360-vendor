import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Universal Loan Application Form - Submit API
 *
 * POST /api/ulafm/submit
 *
 * Handles loan application form submissions.
 * This is a public endpoint (no authentication required).
 */

import { NextRequest, NextResponse } from 'next/server'
import { submitApplicationSchema } from '@/lib/validations/ulafm-schemas'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// Rate limiting - simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 5 // Max submissions per IP
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

// In-memory counter for APP IDs (use database sequence in production)
let appIdCounter = 0

// Generate unique application ID - Format: APP1, APP2, APP3, etc.
function generateApplicationId(): string {
  // In production, this should use a database sequence:
  // SELECT nextval('app_id_sequence')
  // For now, using timestamp + random to ensure uniqueness across restarts
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  appIdCounter = (timestamp % 100000) + random
  return `APP${appIdCounter}`
}

// Parse user agent for device info
function parseUserAgent(userAgent: string) {
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent)
  const isTablet = /iPad|Tablet/i.test(userAgent)

  let deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' = 'DESKTOP'
  if (isTablet) deviceType = 'TABLET'
  else if (isMobile) deviceType = 'MOBILE'

  let browser = 'Unknown'
  if (userAgent.includes('Chrome')) browser = 'Chrome'
  else if (userAgent.includes('Firefox')) browser = 'Firefox'
  else if (userAgent.includes('Safari')) browser = 'Safari'
  else if (userAgent.includes('Edge')) browser = 'Edge'

  let os = 'Unknown'
  if (userAgent.includes('Windows')) os = 'Windows'
  else if (userAgent.includes('Mac')) os = 'macOS'
  else if (userAgent.includes('Linux')) os = 'Linux'
  else if (userAgent.includes('Android')) os = 'Android'
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) os = 'iOS'

  return { deviceType, browser, os }
}

export async function POST(request: NextRequest) {
  try {
    // Get client info
    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many submissions. Please try again later.',
        },
        { status: 429 }
      )
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr

    // Validate input
    const validationResult = submitApplicationSchema.safeParse(body)
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      validationResult.error.errors.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          validation_errors: errors,
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Parse device info
    const { deviceType, browser, os } = parseUserAgent(userAgent)

    // Check for duplicate applications (same mobile + loan type + location)
    // In production, this would query the database:
    // const { data: existingApp } = await supabase
    //   .from('ulaf_applications')
    //   .select('application_id, status')
    //   .eq('customer_mobile', data.customer_mobile)
    //   .eq('loan_type', data.loan_type)
    //   .eq('customer_location', data.customer_location)
    //   .in('status', ['SUBMITTED', 'IN_PROGRESS', 'UNDER_REVIEW'])
    //   .maybeSingle()
    //
    // if (existingApp) {
    //   return NextResponse.json({
    //     success: false,
    //     error: 'There is an active loan application on this mobile number for the same loan type and location.',
    //     existing_application_id: existingApp.application_id,
    //     duplicate: true,
    //   }, { status: 409 })
    // }

    // Generate application ID
    const applicationId = generateApplicationId()

    // Prepare application data
    const applicationData = {
      application_id: applicationId,
      form_type: data.form_type || 'detailed',
      customer_full_name: data.customer_full_name,
      customer_mobile: data.customer_mobile,
      customer_email: data.customer_email || null,
      customer_location: data.customer_location || null,
      loan_type: data.loan_type,
      loan_amount: data.loan_amount || null,
      loan_purpose: data.loan_purpose || null,
      additional_fields: data.additional_fields || null,
      referral_token: data.referral_token || data.token || null,
      status: 'SUBMITTED',
      terms_accepted: data.terms_accepted,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted: data.privacy_accepted || false,
      privacy_accepted_at: data.privacy_accepted ? new Date().toISOString() : null,
      marketing_consent: data.marketing_consent || false,
      client_ip: clientIP,
      client_user_agent: userAgent,
      client_device_type: deviceType,
      client_browser: browser,
      client_os: os,
      submitted_at: new Date().toISOString(),
    }

    // TODO: Save to database when schema is ready
    // For now, return mock success response

    // If we had the database:
    // const supabase = createSupabaseAdmin()
    // const { data: application, error } = await supabase
    //   .from('ulaf_applications')
    //   .insert(applicationData)
    //   .select()
    //   .maybeSingle()

    // Mock response for now
    const mockApplication = {
      id: crypto.randomUUID(),
      ...applicationData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Handle referral token attribution
    if (data.token) {
      // TODO: Validate token and create attribution record
      // const tokenValidation = await validateToken(data.token)
      // if (tokenValidation.is_valid) {
      //   await createAttributionRecord(mockApplication.id, tokenValidation)
      // }
    }

    return NextResponse.json({
      success: true,
      application_id: applicationId,
      application: mockApplication,
      message: 'Application submitted successfully',
      next_steps: {
        verify_mobile: true,
        verify_email: !!data.customer_email,
        upload_documents: true,
        track_url: `/track-application?id=${applicationId}`,
      },
    })
  } catch (error) {
    apiLogger.error('ULAFM Submit Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
