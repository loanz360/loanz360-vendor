import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/setup-sms
 * Setup SMS-based MFA for a user
 */
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
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
