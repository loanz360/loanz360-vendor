import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/setup-email
 * Setup email-based MFA for a user
 */
export async function POST(request: NextRequest) {
  try {
    const bodySchema = z.object({

      user_id: z.string().uuid().optional(),

      email: z.string().email().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { user_id, email } = body

    if (!user_id || !email) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: user_id, email'
      }, { status: 400 })
    }

    const result = await mfaService.setupEmail(user_id, email)

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
      message: 'Verification code sent to your email'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/security/mfa/setup-email', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
