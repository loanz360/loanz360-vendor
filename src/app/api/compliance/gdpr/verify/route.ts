export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { gdprService } from '@/lib/compliance/gdpr-service'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/compliance/gdpr/verify
 * Verify identity for a GDPR request
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body = await request.json()
    const { request_id, verification_code } = body

    if (!request_id || !verification_code) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: request_id, verification_code'
      }, { status: 400 })
    }

    const result = await gdprService.verifyIdentity(request_id, verification_code)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Identity verified successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/compliance/gdpr/verify', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
