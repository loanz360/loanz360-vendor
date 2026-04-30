
import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/security/mfa/setup-email
 * Setup email-based MFA for a user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
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
