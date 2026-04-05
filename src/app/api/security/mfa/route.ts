export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { mfaService } from '@/lib/security/mfa-service'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/security/mfa
 * Get all MFA methods for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: user_id'
      }, { status: 400 })
    }

    const methods = await mfaService.getUserMethods(user_id)

    return NextResponse.json({
      success: true,
      data: {
        methods,
        count: methods.length
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/security/mfa', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
