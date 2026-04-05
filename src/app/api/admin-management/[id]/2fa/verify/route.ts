export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  verifyTOTP,
  verifyBackupCode,
  decryptSecret,
  isValidTOTPFormat,
  isValidBackupCodeFormat,
  hashBackupCode,
  twoFactorRateLimiter,
  generateDeviceFingerprint,
  parseUserAgent
} from '@/lib/auth/2fa'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/2fa/verify
 * Verify 2FA code during login
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

    const { token, backup_code, remember_device } = body

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

    // Check if 2FA is enabled
    if (!admin.two_factor_enabled) {
      return NextResponse.json(
        { success: false, error: '2FA is not enabled for this admin' },
        { status: 400 }
      )
    }

    let verificationMethod: string
    let isValid = false

    // Verify TOTP token
    if (token) {
      if (!isValidTOTPFormat(token)) {
        return NextResponse.json(
          { success: false, error: 'Invalid token format' },
          { status: 400 }
        )
      }

      const encryptionKey = process.env.TOTP_ENCRYPTION_KEY
      if (!encryptionKey) {
        throw new Error('TOTP_ENCRYPTION_KEY not configured')
      }

      const secret = decryptSecret(admin.two_factor_secret, encryptionKey)
      isValid = verifyTOTP(secret, token)
      verificationMethod = 'totp'
    }
    // Verify backup code
    else if (backup_code) {
      if (!isValidBackupCodeFormat(backup_code)) {
        return NextResponse.json(
          { success: false, error: 'Invalid backup code format' },
          { status: 400 }
        )
      }

      const codeHash = hashBackupCode(backup_code)
      const backupCodes = admin.two_factor_backup_codes || []

      // Check if code exists and hasn't been used
      if (backupCodes.includes(codeHash)) {
        isValid = true

        // Remove used backup code
        const { error: updateError } = await supabase.rpc('verify_backup_code', {
          p_admin_id: id,
          p_code_hash: codeHash
        })

        if (updateError) {
          apiLogger.error('Error removing backup code', updateError)
        }
      }

      verificationMethod = 'backup_code'
    } else {
      return NextResponse.json(
        { success: false, error: 'Either token or backup_code is required' },
        { status: 400 }
      )
    }

    // Get request info
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Log attempt
    await supabase.rpc('log_2fa_attempt', {
      p_admin_id: id,
      p_method: verificationMethod,
      p_success: isValid,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_error_message: isValid ? null : 'Invalid code'
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

    // Handle "remember this device" feature
    let trustedDeviceId: string | null = null
    if (remember_device) {
      const deviceFingerprint = generateDeviceFingerprint(userAgent, ip)
      const { browser, os } = parseUserAgent(userAgent)

      const { data: deviceData } = await supabase.rpc('add_trusted_device', {
        p_admin_id: id,
        p_device_fingerprint: deviceFingerprint,
        p_device_name: `${browser} on ${os}`,
        p_browser: browser,
        p_os: os,
        p_ip_address: ip,
        p_trust_duration_days: 30
      })

      trustedDeviceId = deviceData
    }

    // Get remaining backup codes count
    const { data: remainingCodesData } = await supabase
      .from('admins')
      .select('two_factor_backup_codes')
      .eq('id', id)
      .maybeSingle()

    const remainingCodes = remainingCodesData?.two_factor_backup_codes?.length || 0

    return NextResponse.json({
      success: true,
      message: '2FA verification successful',
      data: {
        verified: true,
        method: verificationMethod,
        trusted_device_id: trustedDeviceId,
        backup_codes_remaining: remainingCodes,
        warning: remainingCodes <= 2 && verificationMethod === 'backup_code'
          ? 'You have only ' + remainingCodes + ' backup codes remaining. Please regenerate them.'
          : null
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Verify API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
