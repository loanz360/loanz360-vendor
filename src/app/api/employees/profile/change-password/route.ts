import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySessionToken } from '@/lib/auth/tokens'
import { isTokenBlacklisted, isSessionRevoked } from '@/lib/auth/token-blacklist'
import { logger } from '@/lib/utils/logger'
import { createSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { validatePassword } from '@/lib/validation/password-policy'
import { checkPasswordHistory, savePasswordHistory } from '@/lib/auth/password-history'

export const runtime = 'nodejs'

/**
 * POST /api/employees/profile/change-password
 * Employee self-service password change (requires current password)
 */
export async function POST(request: NextRequest) {
  // Stricter rate limiting for password changes
  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.AUTH,
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
  })
    if (rateLimitResponse) return rateLimitResponse
    // Verify employee authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No authentication token' },
        { status: 401 }
      )
    }

    const sessionData = verifySessionToken(authToken)
    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid or expired token' },
        { status: 401 }
      )
    }

    const [tokenBlacklisted, sessionRevoked] = await Promise.all([
      isTokenBlacklisted(authToken),
      isSessionRevoked(sessionData.sessionId)
    ])

    if (tokenBlacklisted || sessionRevoked) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Session invalidated' },
        { status: 401 }
      )
    }

    const roleUpper = sessionData.role?.toUpperCase()
    if (roleUpper !== 'EMPLOYEE' && roleUpper !== 'HR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Employee access required' },
        { status: 403 }
      )
    }

    const userId = sessionData.userId

    // Parse request body
    const bodySchema = z.object({

      currentPassword: z.string().optional(),

      newPassword: z.string().optional(),

      confirmPassword: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { currentPassword, newPassword, confirmPassword } = body

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'All password fields are required' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'New password and confirmation do not match' },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Validate new password against enterprise policy
    const policyResult = validatePassword(newPassword)
    if (!policyResult.valid) {
      return NextResponse.json(
        { success: false, error: 'Password does not meet requirements', details: policyResult.errors },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Get user email for current password verification
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()

    if (userError || !userData?.email) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password by attempting sign-in
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: currentPassword,
    })

    if (signInError) {
      logger.warn('Password change - current password verification failed', {
        userId,
        error: signInError.message
      })
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check password history (last 5 passwords)
    const historyCheck = await checkPasswordHistory(userId, newPassword)
    if (!historyCheck.allowed) {
      return NextResponse.json(
        { success: false, error: historyCheck.message || 'Password was used recently. Please choose a different password.' },
        { status: 400 }
      )
    }

    // Update password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      logger.error('Password change - update failed', updateError as Error, { userId })
      return NextResponse.json(
        { success: false, error: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    // Record password change timestamp in profiles
    await supabaseAdmin
      .from('profiles')
      .update({
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', userId)

    // Save password hash to history for future checks
    const bcrypt = await import('bcrypt')
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await savePasswordHistory(userId, passwordHash)

    logger.info('Password changed successfully', { userId })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    logger.error('Error in POST /api/employees/profile/change-password', error as Error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
