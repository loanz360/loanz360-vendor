import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/admin-management/[id]/reset-password
 * Generate password reset token for admin
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()
    const { id } = await params
    const bodySchema = z.object({

      requested_by_user_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { requested_by_user_id } = body

    // Check if admin exists
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Check if admin has a linked user account
    if (!admin.user_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin does not have a linked user account'
        },
        { status: 400 }
      )
    }

    // Generate password reset token (using crypto for security)
    const resetToken = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Token valid for 24 hours

    // Store reset token in database
    const { data: resetTokenData, error: tokenError } = await supabase
      .from('admin_password_reset_tokens')
      .insert({
        admin_id: id,
        reset_token: resetToken,
        expires_at: expiresAt.toISOString(),
        requested_by: requested_by_user_id,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      })
      .select()
      .maybeSingle()

    if (tokenError) throw tokenError

    // Use Supabase Auth to send password reset email
    // This will send an email to the admin's email with a reset link
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: admin.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/superadmin/auth/reset-password`
      }
    })

    if (resetError) {
      apiLogger.error('Error sending password reset email', resetError)
      // Don't fail the request if email fails, just log it
    }

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'password_reset',
      p_action_description: `Password reset initiated for admin ${admin.admin_unique_id} (${admin.full_name})`,
      p_changes: JSON.stringify({
        email_sent: !resetError,
        expires_at: expiresAt.toISOString()
      }),
      p_performed_by: requested_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent successfully',
      data: {
        admin_id: id,
        admin_unique_id: admin.admin_unique_id,
        email: admin.email,
        reset_token_expires_at: expiresAt.toISOString(),
        email_sent: !resetError
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error resetting password', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin-management/[id]/reset-password/verify
 * Verify if a password reset token is valid
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createSupabaseAdmin()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reset token is required'
        },
        { status: 400 }
      )
    }

    // Find the reset token
    const { data: resetToken } = await supabase
      .from('admin_password_reset_tokens')
      .select('*')
      .eq('admin_id', id)
      .eq('reset_token', token)
      .eq('is_used', false)
      .maybeSingle()

    if (!resetToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or already used reset token'
        },
        { status: 404 }
      )
    }

    // Check if token has expired
    const expiresAt = new Date(resetToken.expires_at)
    const now = new Date()

    if (now > expiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: 'Reset token has expired'
        },
        { status: 410 }
      )
    }

    // Check if max attempts reached
    if (resetToken.attempts >= resetToken.max_attempts) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum reset attempts reached'
        },
        { status: 429 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        expires_at: resetToken.expires_at,
        attempts: resetToken.attempts,
        max_attempts: resetToken.max_attempts
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error verifying reset token', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
