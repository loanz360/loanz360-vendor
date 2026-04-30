
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  verifyTOTP,
  decryptSecret,
  isValidTOTPFormat,
  twoFactorRateLimiter
} from '@/lib/auth/2fa'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/2fa/enable
 * Enable 2FA by verifying TOTP code
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const { id } = await params
    const body = await request.json()

    const { token, enabled_by_user_id } = body

    // Validate token format
    if (!token || !isValidTOTPFormat(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format. Must be 6 digits.' },
        { status: 400 }
      )
    }

    // Check rate limiting
    if (twoFactorRateLimiter.isRateLimited(id)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Get admin
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Check if already enabled
    if (admin.two_factor_enabled) {
      return NextResponse.json(
        { success: false, error: '2FA is already enabled' },
        { status: 400 }
      )
    }

    // Check if secret exists
    if (!admin.two_factor_secret) {
      return NextResponse.json(
        { success: false, error: 'Please run setup first' },
        { status: 400 }
      )
    }

    // Decrypt secret
    const encryptionKey = process.env.TOTP_ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error('TOTP_ENCRYPTION_KEY not configured')
    }

    const secret = decryptSecret(admin.two_factor_secret, encryptionKey)

    // Verify TOTP
    const isValid = verifyTOTP(secret, token)

    // Log attempt
    await supabase.rpc('log_2fa_attempt', {
      p_admin_id: id,
      p_method: 'totp',
      p_success: isValid,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown',
      p_error_message: isValid ? null : 'Invalid TOTP code'
    })

    if (!isValid) {
      twoFactorRateLimiter.recordAttempt(id)
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 401 }
      )
    }

    // Reset rate limit on success
    twoFactorRateLimiter.resetAttempts(id)

    // Enable 2FA
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        two_factor_enabled: true,
        two_factor_enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'security_2fa_enabled',
      p_action_description: `Two-Factor Authentication was enabled for admin ${admin.admin_unique_id}`,
      p_changes: JSON.stringify({ two_factor_enabled: true }),
      p_performed_by: enabled_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully enabled',
      data: {
        two_factor_enabled: true,
        enabled_at: new Date().toISOString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Enable API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
