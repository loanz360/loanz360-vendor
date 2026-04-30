import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/setup-sms
 * Setup SMS-based MFA for a user
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      user_id: z.string().uuid().optional(),

      phone_number: z.string().min(10).optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { user_id, phone_number } = body

    if (!user_id || !phone_number) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: user_id, phone_number'
      }, { status: 400 })
    }

    const result = await mfaService.setupSMS(user_id, phone_number)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        method_id: result.methodId
      },
      message: 'Verification code sent to your phone'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/security/mfa/setup-sms', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
