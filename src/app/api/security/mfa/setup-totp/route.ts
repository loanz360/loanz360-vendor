import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/setup-totp
 * Setup TOTP (Authenticator app) for a user
 */
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { user_id, user_email } = body

    if (!user_id || !user_email) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: user_id, user_email'
      }, { status: 400 })
    }

    const result = await mfaService.setupTOTP(user_id, user_email)

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        method_id: result.methodId,
        secret: result.totpData?.secret,
        qr_code_url: result.totpData?.qrCodeUrl
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/security/mfa/setup-totp', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
