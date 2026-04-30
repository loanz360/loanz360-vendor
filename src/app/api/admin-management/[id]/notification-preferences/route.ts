import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from '@/lib/email/email-queue-service'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/notification-preferences
 * Get email notification preferences for an admin
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


    const { id } = await params

    // Get admin
    const supabase = createSupabaseAdmin()
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name, email')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Get notification preferences
    const preferences = await getNotificationPreferences(id)

    // If no preferences exist, return defaults
    if (!preferences) {
      return NextResponse.json({
        success: true,
        data: {
          admin: {
            id: admin.id,
            admin_unique_id: admin.admin_unique_id,
            full_name: admin.full_name,
            email: admin.email
          },
          preferences: {
            email_notifications_enabled: true,
            security_emails: true,
            authentication_emails: true,
            authorization_emails: true,
            activity_emails: false,
            system_emails: true,
            compliance_emails: true,
            alerts_emails: true,
            reports_emails: false,
            marketing_emails: false,
            enable_daily_digest: false,
            enable_weekly_digest: false,
            digest_time: '09:00:00'
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name,
          email: admin.email
        },
        preferences
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Get Notification Preferences API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin-management/[id]/notification-preferences
 * Update email notification preferences for an admin
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


    const { id } = await params
    const bodySchema = z.object({

      email_notifications_enabled: z.string().email().optional(),

      security_emails: z.string().email().optional(),

      authentication_emails: z.string().email().optional(),

      authorization_emails: z.string().email().optional(),

      activity_emails: z.string().email().optional(),

      system_emails: z.string().email().optional(),

      compliance_emails: z.string().email().optional(),

      alerts_emails: z.string().email().optional(),

      reports_emails: z.string().email().optional(),

      marketing_emails: z.string().email().optional(),

      enable_daily_digest: z.string().optional(),

      enable_weekly_digest: z.string().optional(),

      digest_time: z.string().optional(),

      updated_by_user_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      email_notifications_enabled,
      security_emails,
      authentication_emails,
      authorization_emails,
      activity_emails,
      system_emails,
      compliance_emails,
      alerts_emails,
      reports_emails,
      marketing_emails,
      enable_daily_digest,
      enable_weekly_digest,
      digest_time,
      updated_by_user_id
    } = body

    // Get admin
    const supabase = createSupabaseAdmin()
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, admin_unique_id, full_name')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Build preferences object
    const preferences: Record<string, unknown> = {}

    if (email_notifications_enabled !== undefined) preferences.email_notifications_enabled = email_notifications_enabled
    if (security_emails !== undefined) preferences.security_emails = security_emails
    if (authentication_emails !== undefined) preferences.authentication_emails = authentication_emails
    if (authorization_emails !== undefined) preferences.authorization_emails = authorization_emails
    if (activity_emails !== undefined) preferences.activity_emails = activity_emails
    if (system_emails !== undefined) preferences.system_emails = system_emails
    if (compliance_emails !== undefined) preferences.compliance_emails = compliance_emails
    if (alerts_emails !== undefined) preferences.alerts_emails = alerts_emails
    if (reports_emails !== undefined) preferences.reports_emails = reports_emails
    if (marketing_emails !== undefined) preferences.marketing_emails = marketing_emails
    if (enable_daily_digest !== undefined) preferences.enable_daily_digest = enable_daily_digest
    if (enable_weekly_digest !== undefined) preferences.enable_weekly_digest = enable_weekly_digest
    if (digest_time !== undefined) preferences.digest_time = digest_time

    // Update preferences
    const success = await updateNotificationPreferences(id, preferences)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update notification preferences' },
        { status: 500 }
      )
    }

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'notification_preferences_updated',
      p_action_description: `Notification preferences updated for admin ${admin.admin_unique_id} (${admin.full_name})`,
      p_changes: JSON.stringify({
        preferences
      }),
      p_performed_by: updated_by_user_id || id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('[Update Notification Preferences API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
