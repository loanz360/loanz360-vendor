import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { z } from 'zod'

// Valid notification type values
const VALID_NOTIFICATION_TYPES = [
  'announcement', 'alert', 'update', 'reminder', 'celebration', 'custom',
  'system', 'security', 'performance', 'achievement',
  'leave', 'attendance', 'payroll', 'expense', 'task', 'document',
  'onboarding', 'feedback', 'resignation', 'profile_review',
  'incentive_assigned', 'target_updated', 'claim_approved', 'claim_rejected', 'payout_processed',
] as const

// Zod schema for a single preference
const preferenceSchema = z.object({
  notification_type: z.string().min(1, 'notification_type is required'),
  in_app_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  digest_mode: z.boolean().optional(),
  digest_frequency: z.enum(['none', 'daily', 'weekly']).optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
})

// Zod schema for batch POST body
const batchPreferencesSchema = z.object({
  preferences: z.array(preferenceSchema).min(1, 'At least one preference required').max(50, 'Too many preferences'),
})

/**
 * GET /api/notifications/preferences
 * Get notification preferences for current user
 * Access: All authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get all preferences for user
    const { data: preferences, error: preferencesError } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('notification_type')

    if (preferencesError) {
      throw preferencesError
    }

    // If no preferences exist, create defaults
    if (!preferences || preferences.length === 0) {
      await supabase.rpc('create_default_notification_preferences', {
        p_user_id: user.id,
      })

      // Fetch again after creating defaults
      const { data: newPreferences, error: newError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .order('notification_type')

      if (newError) {
        throw newError
      }

      return NextResponse.json({
        success: true,
        data: newPreferences || [],
      })
    }

    return NextResponse.json({
      success: true,
      data: preferences,
    })
  } catch (error) {
    apiLogger.error('Error fetching notification preferences', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for current user
 * Body: { notification_type, in_app_enabled, email_enabled, sms_enabled, push_enabled, digest_mode, digest_frequency, quiet_hours_enabled, quiet_hours_start, quiet_hours_end }
 * Access: All authenticated users
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      notification_type: z.string(),


      in_app_enabled: z.string().optional(),


      email_enabled: z.string().email().optional(),


      sms_enabled: z.string().optional(),


      push_enabled: z.string().optional(),


      digest_mode: z.string().optional(),


      digest_frequency: z.string().optional(),


      quiet_hours_enabled: z.string().optional(),


      quiet_hours_start: z.string().optional(),


      quiet_hours_end: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      notification_type,
      in_app_enabled,
      email_enabled,
      sms_enabled,
      push_enabled,
      digest_mode,
      digest_frequency,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end,
    } = body

    if (!notification_type) {
      return NextResponse.json(
        { error: 'notification_type is required' },
        { status: 400 }
      )
    }

    // Upsert preference
    const { data: preference, error: preferenceError } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        notification_type,
        in_app_enabled,
        email_enabled,
        sms_enabled,
        push_enabled,
        digest_mode,
        digest_frequency,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('notification_type', notification_type)
      .select()
      .maybeSingle()

    if (preferenceError) {
      throw preferenceError
    }

    return NextResponse.json({
      success: true,
      data: preference,
      message: 'Preference updated successfully',
    })
  } catch (error) {
    apiLogger.error('Error updating notification preferences', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications/preferences
 * Batch update all preferences for current user
 * Body: { preferences: [{notification_type, ...}] }
 * Access: All authenticated users
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request, z.object({}).passthrough())
    if (_valErr2) return _valErr2

    // Validate request body with Zod
    const parsed = batchPreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { preferences } = parsed.data

    // Add user_id and timestamp to all preferences
    const preferencesToUpsert = preferences.map((pref) => ({
      ...pref,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }))

    // Batch upsert
    const { data: updatedPreferences, error: upsertError } = await supabase
      .from('notification_preferences')
      .upsert(preferencesToUpsert)
      .select()

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: `${updatedPreferences?.length || 0} preferences updated successfully`,
    })
  } catch (error) {
    apiLogger.error('Error batch updating notification preferences', error)
    return NextResponse.json(
      { success: false, error: 'Failed to batch update notification preferences' },
      { status: 500 }
    )
  }
}
