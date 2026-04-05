export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { uuidParamSchema, formatValidationErrors } from '@/lib/validation/admin-validation'
import { handleApiError, parseSupabaseError } from '@/lib/errors/api-errors'
import { totp } from '@/lib/auth/totp'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/2fa
 * Get 2FA status and configuration for an admin
 */
export async function GET(
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data

    // Get admin details
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        },
        { status: 404 }
      )
    }

    // Get 2FA configuration
    const { data: twoFAConfig, error: twoFAError } = await supabase
      .from('admin_2fa_secrets')
      .select('id, is_enabled, enabled_at, last_verified_at, backup_codes_generated_at, failed_attempts, locked_until')
      .eq('admin_id', id)
      .maybeSingle()

    if (twoFAError) {
      throw parseSupabaseError(twoFAError)
    }

    // Get backup codes count
    let backupCodesCount = 0
    if (twoFAConfig) {
      const { count } = await supabase
        .from('admin_2fa_backup_codes')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', id)
        .eq('is_used', false)

      backupCodesCount = count || 0
    }

    // Get trusted devices count
    let trustedDevicesCount = 0
    if (twoFAConfig) {
      const { count } = await supabase
        .from('admin_2fa_trusted_devices')
        .select('*', { count: 'exact', head: true })
        .eq('admin_id', id)
        .eq('is_trusted', true)
        .gt('expires_at', new Date().toISOString())

      trustedDevicesCount = count || 0
    }

    // Check if account is locked
    const isLocked = twoFAConfig?.locked_until ? new Date(twoFAConfig.locked_until) > new Date() : false

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name,
          email: admin.email,
        },
        twoFA: {
          isEnabled: twoFAConfig?.is_enabled || false,
          enabledAt: twoFAConfig?.enabled_at || null,
          lastVerifiedAt: twoFAConfig?.last_verified_at || null,
          backupCodesGeneratedAt: twoFAConfig?.backup_codes_generated_at || null,
          backupCodesCount,
          trustedDevicesCount,
          isLocked,
          lockedUntil: twoFAConfig?.locked_until || null,
          failedAttempts: twoFAConfig?.failed_attempts || 0,
        },
      },
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA API] Get status error', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}

/**
 * POST /api/admin-management/[id]/2fa
 * Setup/Enable 2FA for an admin
 *
 * Request body: { action: 'setup' | 'enable' | 'disable' | 'regenerate-backup-codes' }
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const body = await request.json()
    const { action } = body

    if (!action || !['setup', 'enable', 'disable', 'regenerate-backup-codes'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be one of: setup, enable, disable, regenerate-backup-codes',
        },
        { status: 400 }
      )
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get admin details
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        },
        { status: 404 }
      )
    }

    // Handle different actions
    if (action === 'setup') {
      // Generate new secret
      const secret = totp.generateSecret()

      // Generate QR code URI
      const accountName = `${admin.full_name} (${admin.email})`
      const qrCodeUri = totp.generateUri(secret, accountName)
      const qrCodeUrl = await totp.generateQRCode(secret, accountName)

      // Check if 2FA config already exists
      const { data: existingConfig } = await supabase
        .from('admin_2fa_secrets')
        .select('id')
        .eq('admin_id', id)
        .maybeSingle()

      if (existingConfig) {
        // Update existing config
        await supabase
          .from('admin_2fa_secrets')
          .update({
            secret_key: secret,
            is_enabled: false,
            qr_code_data: qrCodeUri,
            updated_at: new Date().toISOString(),
          })
          .eq('admin_id', id)
      } else {
        // Create new config
        await supabase.from('admin_2fa_secrets').insert({
          admin_id: id,
          secret_key: secret,
          is_enabled: false,
          qr_code_data: qrCodeUri,
        })
      }

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: '2fa_setup',
        p_action_description: `2FA setup initiated for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ event: '2fa_setup_initiated' }),
        p_performed_by: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return NextResponse.json({
        success: true,
        message: '2FA setup initiated. Please scan the QR code with your authenticator app.',
        data: {
          secret,
          qrCodeUri,
          qrCodeUrl,
          accountName,
        },
      })
    }

    if (action === 'enable') {
      const { token } = body

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token is required to enable 2FA',
          },
          { status: 400 }
        )
      }

      // Get secret
      const { data: twoFAConfig, error: twoFAError } = await supabase
        .from('admin_2fa_secrets')
        .select('secret_key, is_enabled')
        .eq('admin_id', id)
        .maybeSingle()

      if (twoFAError || !twoFAConfig) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA not set up. Please run setup first.',
          },
          { status: 400 }
        )
      }

      if (twoFAConfig.is_enabled) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA is already enabled',
          },
          { status: 400 }
        )
      }

      // Verify token
      const isValid = totp.verifyToken(token, twoFAConfig.secret_key)

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid verification code. Please try again.',
          },
          { status: 400 }
        )
      }

      // Enable 2FA
      await supabase
        .from('admin_2fa_secrets')
        .update({
          is_enabled: true,
          enabled_at: new Date().toISOString(),
          last_verified_at: new Date().toISOString(),
          qr_code_data: null, // Clear QR code data
        })
        .eq('admin_id', id)

      // Generate backup codes
      const { data: backupCodes } = await supabase.rpc('generate_2fa_backup_codes', {
        p_admin_id: id,
      })

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: '2fa_enabled',
        p_action_description: `2FA enabled for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ event: '2fa_enabled' }),
        p_performed_by: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return NextResponse.json({
        success: true,
        message: '2FA enabled successfully. Please save your backup codes in a secure location.',
        data: {
          backupCodes: backupCodes || [],
        },
      })
    }

    if (action === 'disable') {
      const { token } = body

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token is required to disable 2FA',
          },
          { status: 400 }
        )
      }

      // Get secret
      const { data: twoFAConfig, error: twoFAError } = await supabase
        .from('admin_2fa_secrets')
        .select('secret_key, is_enabled')
        .eq('admin_id', id)
        .maybeSingle()

      if (twoFAError || !twoFAConfig) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA not configured',
          },
          { status: 400 }
        )
      }

      if (!twoFAConfig.is_enabled) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA is already disabled',
          },
          { status: 400 }
        )
      }

      // Verify token
      const isValid = totp.verifyToken(token, twoFAConfig.secret_key)

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid verification code. Please try again.',
          },
          { status: 400 }
        )
      }

      // Disable 2FA
      await supabase
        .from('admin_2fa_secrets')
        .update({
          is_enabled: false,
        })
        .eq('admin_id', id)

      // Revoke all trusted devices
      await supabase
        .from('admin_2fa_trusted_devices')
        .update({
          is_trusted: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('admin_id', id)

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: '2fa_disabled',
        p_action_description: `2FA disabled for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ event: '2fa_disabled' }),
        p_performed_by: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return NextResponse.json({
        success: true,
        message: '2FA disabled successfully.',
      })
    }

    if (action === 'regenerate-backup-codes') {
      const { token } = body

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            error: 'Token is required to regenerate backup codes',
          },
          { status: 400 }
        )
      }

      // Get secret
      const { data: twoFAConfig, error: twoFAError } = await supabase
        .from('admin_2fa_secrets')
        .select('secret_key, is_enabled')
        .eq('admin_id', id)
        .maybeSingle()

      if (twoFAError || !twoFAConfig) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA not configured',
          },
          { status: 400 }
        )
      }

      if (!twoFAConfig.is_enabled) {
        return NextResponse.json(
          {
            success: false,
            error: '2FA must be enabled to regenerate backup codes',
          },
          { status: 400 }
        )
      }

      // Verify token
      const isValid = totp.verifyToken(token, twoFAConfig.secret_key)

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid verification code. Please try again.',
          },
          { status: 400 }
        )
      }

      // Generate new backup codes
      const { data: backupCodes } = await supabase.rpc('generate_2fa_backup_codes', {
        p_admin_id: id,
      })

      // Create audit log
      await supabase.rpc('create_admin_audit_log', {
        p_admin_id: id,
        p_action_type: '2fa_backup_codes',
        p_action_description: `Backup codes regenerated for admin ${admin.admin_unique_id}`,
        p_changes: JSON.stringify({ event: '2fa_backup_codes_regenerated' }),
        p_performed_by: null,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      })

      return NextResponse.json({
        success: true,
        message: 'Backup codes regenerated successfully. Please save them in a secure location.',
        data: {
          backupCodes: backupCodes || [],
        },
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Unknown action',
      },
      { status: 400 }
    )
  } catch (error: unknown) {
    apiLogger.error('[2FA API] Setup/Enable/Disable error', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}

/**
 * PUT /api/admin-management/[id]/2fa
 * Verify 2FA token
 *
 * Request body: { token: string, trustDevice?: boolean }
 */
export async function PUT(
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

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const body = await request.json()
    const { token, trustDevice = false } = body

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token is required',
        },
        { status: 400 }
      )
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Get 2FA config
    const { data: twoFAConfig, error: twoFAError } = await supabase
      .from('admin_2fa_secrets')
      .select('secret_key, is_enabled, locked_until')
      .eq('admin_id', id)
      .maybeSingle()

    if (twoFAError || !twoFAConfig) {
      return NextResponse.json(
        {
          success: false,
          error: '2FA not configured',
        },
        { status: 400 }
      )
    }

    if (!twoFAConfig.is_enabled) {
      return NextResponse.json(
        {
          success: false,
          error: '2FA is not enabled',
        },
        { status: 400 }
      )
    }

    // Check if account is locked
    if (twoFAConfig.locked_until && new Date(twoFAConfig.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(twoFAConfig.locked_until).getTime() - Date.now()) / 60000)
      return NextResponse.json(
        {
          success: false,
          error: `Account is locked due to too many failed attempts. Please try again in ${minutesRemaining} minutes.`,
        },
        { status: 429 }
      )
    }

    // Verify token
    const isValid = totp.verifyToken(token, twoFAConfig.secret_key)

    // Generate device fingerprint
    const deviceFingerprint = totp.generateDeviceFingerprint(ipAddress, userAgent)

    // Record attempt
    await supabase.rpc('record_2fa_attempt', {
      p_admin_id: id,
      p_was_successful: isValid,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_device_fingerprint: deviceFingerprint,
      p_failure_reason: isValid ? null : 'Invalid token',
    })

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid verification code. Please try again.',
        },
        { status: 400 }
      )
    }

    // If trust device is requested, create trusted device entry
    if (trustDevice) {
      await supabase.rpc('trust_device', {
        p_admin_id: id,
        p_device_fingerprint: deviceFingerprint,
        p_device_name: userAgent.substring(0, 100),
        p_device_type: 'desktop', // Could be enhanced with device detection
        p_browser: userAgent.substring(0, 100),
        p_os: 'Unknown', // Could be enhanced with OS detection
        p_ip_address: ipAddress,
        p_trust_days: 30,
      })
    }

    return NextResponse.json({
      success: true,
      message: '2FA verification successful',
      data: {
        verified: true,
        deviceTrusted: trustDevice,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA API] Verify token error', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}
