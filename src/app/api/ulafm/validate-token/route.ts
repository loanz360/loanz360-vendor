export const dynamic = 'force-dynamic'

/**
 * Universal Loan Application Form - Validate Token API
 *
 * GET /api/ulafm/validate-token?token={token}
 *
 * Validates a referral token and returns sender information.
 * This is a public endpoint (no authentication required).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import type { ValidateTokenResponse } from '@/types/ulafm'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { is_valid: false, error_message: 'Token is required' },
        { status: 400 }
      )
    }

    // Validate format
    const isValidFormat =
      /^[A-Za-z0-9]{8,}$/.test(token) || /^[A-Za-z0-9-]{32,}$/.test(token)

    if (!isValidFormat) {
      return NextResponse.json({
        is_valid: false,
        error_message: 'Invalid token format',
      })
    }

    const supabase = createSupabaseAdmin()

    const { data: tokenRecord, error } = await supabase
      .from('ulaf_referral_tokens')
      .select('id, token, short_code, is_active, expires_at, max_uses, current_uses, sender_user_id, sender_type, sender_subrole, sender_name, campaign_id')
      .or(`token.eq.${token},short_code.eq.${token}`)
      .maybeSingle()

    if (error) {
      apiLogger.error('Error validating ULAF token', error)
      return NextResponse.json({
        is_valid: false,
        error_message: 'Failed to validate token',
      })
    }

    if (!tokenRecord) {
      return NextResponse.json({
        is_valid: false,
        error_message: 'Token not found',
      })
    }

    if (!tokenRecord.is_active) {
      return NextResponse.json({
        is_valid: false,
        token_id: tokenRecord.id,
        error_message: 'Token is deactivated',
      })
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({
        is_valid: false,
        token_id: tokenRecord.id,
        error_message: 'Token has expired',
      })
    }

    if (tokenRecord.max_uses && tokenRecord.current_uses >= tokenRecord.max_uses) {
      return NextResponse.json({
        is_valid: false,
        token_id: tokenRecord.id,
        error_message: 'Token has reached maximum uses',
      })
    }

    const response: ValidateTokenResponse = {
      is_valid: true,
      token_id: tokenRecord.id,
      sender_id: tokenRecord.sender_user_id,
      sender_type: tokenRecord.sender_type || 'EMPLOYEE',
      sender_subrole: tokenRecord.sender_subrole,
      sender_name: tokenRecord.sender_name,
      campaign_id: tokenRecord.campaign_id,
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    apiLogger.error('Error in validate-token', error)
    return NextResponse.json(
      { is_valid: false, error_message: 'Internal server error' },
      { status: 500 }
    )
  }
}
