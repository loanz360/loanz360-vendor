import { parseBody } from '@/lib/utils/parse-body'
/**
 * SIMPLE Super Admin Password Reset
 * Minimal dependencies version for troubleshooting
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { checkSuperAdminPasswordHistory, saveSuperAdminPasswordHistory } from '@/lib/auth/password-history'
import bcrypt from 'bcrypt'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

// SECURITY FIX CRITICAL-01: Emergency key MUST be set in environment variables
// No default fallback to prevent security vulnerabilities
const EMERGENCY_KEY = process.env.SUPER_ADMIN_EMERGENCY_KEY

// Validate emergency key exists and is strong enough
if (!EMERGENCY_KEY) {
  throw new Error(
    'FATAL SECURITY ERROR: SUPER_ADMIN_EMERGENCY_KEY environment variable is not set. ' +
    'This endpoint cannot function without a secure emergency key.'
  )
}

if (EMERGENCY_KEY.length < 32) {
  throw new Error(
    'FATAL SECURITY ERROR: SUPER_ADMIN_EMERGENCY_KEY must be at least 32 characters long. ' +
    'Current length: ' + EMERGENCY_KEY.length
  )
}

// API Route Runtime: Node.js (uses crypto/bcrypt)
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Parse request
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { email, newPassword, emergencyKey } = body

    // Validate inputs
    if (!email || !newPassword || !emergencyKey) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check emergency key
    if (emergencyKey !== EMERGENCY_KEY) {
      return NextResponse.json(
        { success: false, error: 'Invalid emergency key' },
        { status: 403 }
      )
    }

    // Validate password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Get Supabase client
    const supabaseAdmin = createSupabaseAdmin()

    // Find super admin
    const { data: superAdmin, error: findError } = await supabaseAdmin
      .from('super_admins')
      .select('id, email, is_active, is_locked')
      .eq('email', email)
      .maybeSingle()

    if (findError || !superAdmin) {
      logger.error('Super admin not found', findError ? new Error(findError.message) : new Error('Not found'))
      return NextResponse.json(
        { success: false, error: 'Super admin account not found' },
        { status: 404 }
      )
    }

    // SECURITY FIX HIGH-02: Check password history before allowing simple reset
    const historyCheck = await checkSuperAdminPasswordHistory(superAdmin.id, newPassword)
    if (!historyCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: historyCheck.message || 'Password was used recently. Please choose a different password.',
        },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // SECURITY FIX HIGH-02: Save to password history
    await saveSuperAdminPasswordHistory(superAdmin.id, passwordHash)

    // Build update object dynamically based on what columns exist
    const updateData: any = {
      password_hash: passwordHash,
      is_locked: false,
      is_active: true,
      updated_at: new Date().toISOString()
    }

    // Try to add optional columns (won't fail if they don't exist)
    try {
      updateData.password_changed_at = new Date().toISOString()
      updateData.password_must_change = false
      updateData.failed_login_attempts = 0
      updateData.last_failed_login = null
      updateData.password_reset_token = null
      updateData.password_reset_expires = null
    } catch (e) {
      // Columns don't exist, that's okay
    }

    // Update password
    const { error: updateError } = await supabaseAdmin
      .from('super_admins')
      .update(updateData)
      .eq('id', superAdmin.id)

    if (updateError) {
      logger.error('Failed to update password', new Error(updateError.message))
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update password',
        },
        { status: 500 }
      )
    }

    logger.info('Password reset successful', { email })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now login.',
      accountStatus: {
        wasLocked: superAdmin.is_locked,
        wasInactive: !superAdmin.is_active,
        nowActive: true,
        nowUnlocked: true,
      }
    })

  } catch (error) {
    logger.error('Simple reset error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
