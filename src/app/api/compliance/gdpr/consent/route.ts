
import { NextRequest, NextResponse } from 'next/server'
import { gdprService } from '@/lib/compliance/gdpr-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/compliance/gdpr/consent?lead_id={id}
 * Get consent history for a lead
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { searchParams } = new URL(request.url)
    const lead_id = searchParams.get('lead_id')

    if (!lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: lead_id'
      }, { status: 400 })
    }

    const consents = await gdprService.getConsentHistory(lead_id)

    return NextResponse.json({
      success: true,
      data: {
        consents,
        count: consents.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/gdpr/consent', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/compliance/gdpr/consent
 * Record a new consent
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const {
      lead_id,
      consent_type,
      consent_given,
      consent_version,
      consent_text,
      preferences,
      ip_address,
      user_agent
    } = body

    if (!lead_id || !consent_type || consent_given === undefined || !consent_version) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: lead_id, consent_type, consent_given, consent_version'
      }, { status: 400 })
    }

    const result = await gdprService.recordConsent({
      lead_id,
      consent_type,
      consent_given,
      consent_version,
      consent_text,
      preferences,
      ip_address,
      user_agent
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Consent recorded successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/gdpr/consent', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
