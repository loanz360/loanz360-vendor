import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Helper to check Super Admin session from cookie
 */
async function checkSuperAdminSession(request: NextRequest): Promise<{ isValid: boolean; adminId?: string }> {
  const superAdminSession = request.cookies.get('super_admin_session')?.value
  if (!superAdminSession) return { isValid: false }

  const supabaseAdmin = createSupabaseAdmin()
  const { data: session } = await supabaseAdmin
    .from('super_admin_sessions')
    .select('super_admin_id, expires_at')
    .eq('session_id', superAdminSession)
    .maybeSingle()

  if (!session || new Date(session.expires_at) < new Date()) return { isValid: false }

  const { data: admin } = await supabaseAdmin
    .from('super_admins')
    .select('id, is_active, is_locked')
    .eq('id', session.super_admin_id)
    .maybeSingle()

  if (!admin || !admin.is_active || admin.is_locked) return { isValid: false }

  return { isValid: true, adminId: admin.id }
}

/**
 * GET /api/notifications/preferences/config
 * Get notification preference configuration (topics, channels, defaults)
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { isValid } = await checkSuperAdminSession(request)
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Get preference configuration from user_notification_preferences metadata
    // or a dedicated settings table
    const { data: config, error } = await supabaseAdmin
      .from('notification_throttle_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    // Get available notification topics/types
    const { data: templates } = await supabaseAdmin
      .from('notification_templates')
      .select('notification_type')
      .order('notification_type')

    const uniqueTypes = [...new Set(templates?.map(t => t.notification_type) || [])]

    // Get channel statistics
    const { data: channelStats } = await supabaseAdmin
      .from('notification_delivery_log')
      .select('channel')
      .limit(1000)

    const channelCounts: Record<string, number> = {}
    channelStats?.forEach((s: { channel: string }) => {
      channelCounts[s.channel] = (channelCounts[s.channel] || 0) + 1
    })

    // Get unsubscribe count
    const { count: unsubscribeCount } = await supabaseAdmin
      .from('notification_unsubscribes')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      data: {
        throttle_settings: config || {
          max_per_hour: 10,
          max_per_day: 50,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          digest_enabled: false,
          digest_frequency: 'daily'
        },
        available_topics: uniqueTypes,
        available_channels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
        channel_usage: channelCounts,
        total_unsubscribes: unsubscribeCount || 0,
        default_preferences: {
          email: true,
          sms: false,
          push: true,
          in_app: true,
          whatsapp: false
        }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching preferences config', error)
    logApiError(error as Error, request, { action: 'get_preferences_config' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences configuration' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/preferences/config
 * Update notification preference configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { isValid, adminId } = await checkSuperAdminSession(request)
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const supabaseAdmin = createSupabaseAdmin()

    // Whitelist allowed fields
    const allowedFields = [
      'max_per_hour', 'max_per_day', 'quiet_hours_start', 'quiet_hours_end',
      'digest_enabled', 'digest_frequency', 'default_channels', 'mandatory_topics'
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Validate numeric fields
    if (updateData.max_per_hour !== undefined) {
      const val = parseInt(updateData.max_per_hour)
      if (isNaN(val) || val < 1 || val > 100) {
        return NextResponse.json({ success: false, error: 'max_per_hour must be between 1 and 100' }, { status: 400 })
      }
      updateData.max_per_hour = val
    }
    if (updateData.max_per_day !== undefined) {
      const val = parseInt(updateData.max_per_day)
      if (isNaN(val) || val < 1 || val > 500) {
        return NextResponse.json({ success: false, error: 'max_per_day must be between 1 and 500' }, { status: 400 })
      }
      updateData.max_per_day = val
    }

    updateData.updated_at = new Date().toISOString()
    updateData.updated_by = adminId

    // Upsert the configuration
    const { data, error } = await supabaseAdmin
      .from('notification_throttle_settings')
      .upsert({
        id: 'global',
        ...updateData
      })
      .select()
      .single()

    if (error) {
      apiLogger.error('Error updating preferences config', error)
      return NextResponse.json({ success: false, error: 'Failed to update configuration' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Preferences configuration updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error updating preferences config', error)
    logApiError(error as Error, request, { action: 'update_preferences_config' })
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences configuration' },
      { status: 500 }
    )
  }
}
