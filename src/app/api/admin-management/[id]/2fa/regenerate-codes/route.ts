import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  verifyTOTP,
  decryptSecret,
  generateBackupCodes,
  hashBackupCode,
  isValidTOTPFormat
} from '@/lib/auth/2fa'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/2fa/regenerate-codes
 * Regenerate backup codes (requires TOTP verification)
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
    const bodySchema = z.object({

      token: z.string().optional(),

      regenerated_by_user_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { token, regenerated_by_user_id } = body

    // Validate token
    if (!token || !isValidTOTPFormat(token)) {
      return NextResponse.json(
        { success: false, error: 'Valid TOTP token required for verification' },
        { status: 400 }
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
        { success: false, error: '2FA must be enabled to regenerate backup codes' },
        { status: 400 }
      )
    }

    // Verify TOTP token
    const encryptionKey = process.env.TOTP_ENCRYPTION_KEY
    if (!encryptionKey) {
      throw new Error('TOTP_ENCRYPTION_KEY not configured')
    }

    const secret = decryptSecret(admin.two_factor_secret, encryptionKey)
    const isValid = verifyTOTP(secret, token)

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 401 }
      )
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code))

    // Store new backup codes
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        two_factor_backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'security_2fa_backup_codes_regenerated',
      p_action_description: `Backup codes were regenerated for admin ${admin.admin_unique_id}`,
      p_changes: JSON.stringify({
        codes_generated: 10,
        previous_codes_invalidated: true
      }),
      p_performed_by: regenerated_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backup_codes: backupCodes, // Show once, user must save
        warning: 'Previous backup codes have been invalidated. Save these new codes in a secure location.'
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Regenerate Codes API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
