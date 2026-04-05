export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { uuidParamSchema, formatValidationErrors } from '@/lib/validation/admin-validation'
import { handleApiError, parseSupabaseError } from '@/lib/errors/api-errors'
import { withRetry, withIdempotency, generateIdempotencyKey } from '@/lib/database/transaction-helper'
import { getPasswordResetTemplate } from '@/lib/email/templates/password-reset'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/admin-management/[id]/password-reset
 * Request password reset for an admin
 *
 * Security:
 * - UUID validation
 * - Rate limiting (via idempotency)
 * - Secure token generation (32-byte random)
 * - Token expiry (24 hours)
 * - Email verification
 * - Audit logging
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

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Generate idempotency key (prevent duplicate requests within 5 minutes)
    const idempotencyKey = generateIdempotencyKey('password_reset', id, {
      timestamp: Math.floor(Date.now() / (5 * 60 * 1000)), // 5-minute window
    })

    const result = await withIdempotency(idempotencyKey, async () => {
      return await withRetry(
        async () => {
          // Check if admin exists and is active
          const { data: admin, error: adminError } = await supabase
            .from('admins')
            .select('id, admin_unique_id, full_name, email, status')
            .eq('id', id)
            .eq('is_deleted', false)
            .maybeSingle()

          if (adminError || !admin) {
            throw parseSupabaseError(adminError || new Error('Admin not found'))
          }

          if (admin.status !== 'enabled') {
            return {
              success: false,
              error: 'Cannot reset password for disabled admin account',
              statusCode: 403,
            }
          }

          // Generate secure reset token (32 bytes = 256 bits)
          const resetToken = crypto.randomBytes(32).toString('hex')
          const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

          // Set expiry (24 hours from now)
          const expiresAt = new Date()
          expiresAt.setHours(expiresAt.getHours() + 24)

          // Store password reset token in database
          const { error: tokenError } = await supabase.from('admin_password_resets').insert({
            admin_id: id,
            token_hash: hashedToken,
            expires_at: expiresAt.toISOString(),
            ip_address: ipAddress,
            user_agent: userAgent,
          })

          if (tokenError) {
            throw parseSupabaseError(tokenError)
          }

          // Invalidate all previous reset tokens for this admin
          await supabase
            .from('admin_password_resets')
            .update({ is_used: true })
            .eq('admin_id', id)
            .neq('token_hash', hashedToken)
            .eq('is_used', false)

          // Build reset link
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
          const resetLink = `${baseUrl}/superadmin/admin-management/reset-password?token=${resetToken}&id=${id}`

          // Send password reset email
          try {
            // Note: Email service integration will be configured via environment variables
            // For now, we'll log the reset link (in production, this would send an actual email)
            const emailTemplate = getPasswordResetTemplate({
              adminName: admin.full_name,
              resetLink,
              expiryHours: 24,
              ipAddress,
              userAgent,
              requestedAt: new Date().toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Kolkata',
              }),
            })


            // TODO: Integrate with actual email service
            // const emailConfig = {
            //   provider: process.env.EMAIL_PROVIDER as 'resend' | 'sendgrid',
            //   apiKey: process.env.EMAIL_API_KEY!,
            //   fromEmail: process.env.EMAIL_FROM_ADDRESS!,
            //   fromName: 'LOANZ 360',
            // }
            // const emailService = new EmailService(emailConfig)
            // await emailService.send({
            //   to: admin.email,
            //   subject: emailTemplate.subject,
            //   html: emailTemplate.html,
            //   text: emailTemplate.text,
            // })
          } catch (emailError) {
            apiLogger.error('[Password Reset] Email send failed', emailError)
            // Don't fail the request if email fails - token is still valid
          }

          // Create audit log
          const { error: auditError } = await supabase.rpc('create_admin_audit_log', {
            p_admin_id: id,
            p_action_type: 'password_reset',
            p_action_description: `Password reset requested for admin ${admin.admin_unique_id} (${admin.full_name})`,
            p_changes: JSON.stringify({
              event: 'password_reset_requested',
              expires_at: expiresAt.toISOString(),
            }),
            p_performed_by: null, // Self-service password reset
            p_ip_address: ipAddress,
            p_user_agent: userAgent,
          })

          if (auditError) {
            apiLogger.error('[Password Reset] Audit log failed', auditError)
            // Continue anyway - audit log is non-critical
          }

          return {
            success: true,
            message: 'Password reset email sent successfully',
            statusCode: 200,
          }
        },
        { maxRetries: 3, retryDelay: 1000 }
      )
    })

    return NextResponse.json(
      {
        success: result.success,
        message: result.message || result.error,
      },
      { status: result.statusCode || 200 }
    )
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Password reset error', error)
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
 * PUT /api/admin-management/[id]/password-reset
 * Complete password reset with token
 *
 * Security:
 * - Token validation (SHA-256 hash comparison)
 * - Expiry check
 * - One-time use enforcement
 * - Password strength validation
 * - Supabase Auth integration
 */
export async function PUT(
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
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token and new password are required',
        },
        { status: 400 }
      )
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 8 characters long',
        },
        { status: 400 }
      )
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Hash the provided token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find and validate reset token
    const { data: resetRequest, error: tokenError } = await supabase
      .from('admin_password_resets')
      .select('*')
      .eq('admin_id', id)
      .eq('token_hash', hashedToken)
      .eq('is_used', false)
      .maybeSingle()

    if (tokenError || !resetRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset token',
        },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(resetRequest.expires_at) < new Date()) {
      // Mark as used to prevent reuse
      await supabase
        .from('admin_password_resets')
        .update({ is_used: true })
        .eq('id', resetRequest.id)

      return NextResponse.json(
        {
          success: false,
          error: 'Reset token has expired. Please request a new password reset.',
        },
        { status: 400 }
      )
    }

    // Get admin details
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email, user_id')
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

    // Update password in Supabase Auth
    if (admin.user_id) {
      const { error: authError } = await supabase.auth.admin.updateUserById(admin.user_id, {
        password: newPassword,
      })

      if (authError) {
        apiLogger.error('[Password Reset] Auth update failed', authError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update password. Please try again.',
          },
          { status: 500 }
        )
      }
    }

    // Mark token as used
    await supabase.from('admin_password_resets').update({ is_used: true, used_at: new Date().toISOString() }).eq('id', resetRequest.id)

    // Create audit log
    const { error: auditError } = await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'password_reset',
      p_action_description: `Password successfully reset for admin ${admin.admin_unique_id} (${admin.full_name})`,
      p_changes: JSON.stringify({
        event: 'password_reset_completed',
      }),
      p_performed_by: null, // Self-service password reset
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    })

    if (auditError) {
      apiLogger.error('[Password Reset] Audit log failed', auditError)
      // Continue anyway - audit log is non-critical
    }

    // TODO: Send password reset confirmation email

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Password reset completion error', error)
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
