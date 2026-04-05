export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { gdprService } from '@/lib/compliance/gdpr-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/compliance/gdpr/erasure
 * Process a GDPR erasure request (Right to be Forgotten - Article 17)
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { request_id, hard_delete = false } = body

    if (!request_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: request_id'
      }, { status: 400 })
    }

    const result = await gdprService.processErasureRequest(request_id, hard_delete)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Erasure request processed successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/gdpr/erasure', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
