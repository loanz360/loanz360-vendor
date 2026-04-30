import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/verify
 * Verify MFA code for any method (TOTP, SMS, Email, Backup Code)
 */
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { method_id, code, method_type } = body

    if (!method_id || !code) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: method_id, code'
      }, { status: 400 })
    }

    let result

    // Route to appropriate verification method based on type
    switch (method_type) {
      case 'totp':
        result = await mfaService.verifyTOTP(method_id, code)
        break
      case 'sms':
        result = await mfaService.verifySMS(method_id, code)
        break
      case 'email':
        result = await mfaService.verifyEmail(method_id, code)
        break
      case 'backup_codes':
        result = await mfaService.verifyBackupCode(method_id, code)
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid method_type. Must be: totp, sms, email, or backup_codes'
        }, { status: 400 })
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Verification failed'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'MFA verification successful'
    })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/security/mfa/verify', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
