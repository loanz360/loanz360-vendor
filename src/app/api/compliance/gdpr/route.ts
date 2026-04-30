import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { gdprService } from '@/lib/compliance/gdpr-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * GET /api/compliance/gdpr
 * Fetch all GDPR data subject requests with optional filters
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const overdueOnly = searchParams.get('overdue_only') === 'true'

    const filters: any = {}
    if (status) filters.status = status
    if (type) filters.request_type = type
    if (overdueOnly) filters.is_overdue = true

    const requests = await gdprService.getRequests(filters)

    return NextResponse.json({
      success: true,
      data: {
        requests,
        count: requests.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/compliance/gdpr', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * POST /api/compliance/gdpr
 * Submit a new GDPR data subject request
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const { request_type, requester_email, requester_name, request_details, lead_id } = body

    if (!request_type || !requester_email) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: request_type, requester_email'
      }, { status: 400 })
    }

    const result = await gdprService.submitDSAR({
      request_type,
      requester_email,
      requester_name,
      request_details,
      lead_id
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: result.request_id
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/gdpr', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
