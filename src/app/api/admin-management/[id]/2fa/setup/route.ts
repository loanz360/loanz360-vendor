
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  generateTOTPSecret,
  generateQRCodeURL,
  generateBackupCodes,
  hashBackupCode,
  encryptSecret
} from '@/lib/auth/2fa'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/2fa/setup
 * Initialize 2FA setup for an admin
 * Returns QR code URL and backup codes
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

    // Check if admin exists
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email, two_factor_enabled')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Check if 2FA is already enabled
    if (admin.two_factor_enabled) {
      return NextResponse.json(
        { success: false, error: '2FA is already enabled for this admin' },
        { status: 400 }
      )
    }

    // Generate TOTP secret
    const secret = generateTOTPSecret()

    // Generate QR code URL
    const qrCodeURL = generateQRCodeURL(secret, admin.email, 'Loanz360')

    // Generate backup codes
    const backupCodes = generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code))

    // Encrypt secret for storage
    const encryptionKey = process.env.TOTP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
    const encryptedSecret = encryptSecret(secret, encryptionKey)

    // Store encrypted secret and hashed backup codes (but don't enable 2FA yet)
    const { error: updateError } = await supabase
      .from('admins')
      .update({
        two_factor_secret: encryptedSecret,
        two_factor_backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      data: {
        secret, // Show once for manual entry
        qrCodeURL,
        backupCodes, // Show once, user must save these
        message: 'Scan the QR code with your authenticator app, then verify a code to complete setup'
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[2FA Setup API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
