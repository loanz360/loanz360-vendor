import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


// Default notification preferences
const DEFAULT_PREFERENCES = {
  channels: {
    in_app: true,
    email: true,
    push: false,
  },
  categories: {
    application_updates: { in_app: true, email: true, push: false },
    team_alerts: { in_app: true, email: true, push: false },
    escalations: { in_app: true, email: true, push: false },
    approvals: { in_app: true, email: true, push: false },
    system_updates: { in_app: true, email: false, push: false },
    performance_reports: { in_app: true, email: true, push: false },
    leave_requests: { in_app: true, email: true, push: false },
    payout_notifications: { in_app: true, email: true, push: false },
  },
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
  digest: {
    enabled: true,
    frequency: 'daily',
    time: '09:00',
  },
}

// Validate HH:MM time format
function isValidTime(time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [h, m] = time.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

// Validate quiet hours range
function validateQuietHours(qh: { enabled: boolean; start: string; end: string }): string | null {
  if (!qh.enabled) return null
  if (!isValidTime(qh.start)) return 'Quiet hours start time must be in HH:MM format (00:00 - 23:59)'
  if (!isValidTime(qh.end)) return 'Quiet hours end time must be in HH:MM format (00:00 - 23:59)'
  if (qh.start === qh.end) return 'Quiet hours start and end times must be different'
  return null
}

const VALID_FREQUENCIES = ['realtime', 'daily', 'weekly']

const VALID_CATEGORIES = [
  'application_updates',
  'team_alerts',
  'escalations',
  'approvals',
  'system_updates',
  'performance_reports',
  'leave_requests',
  'payout_notifications',
]

/**
 * GET /api/employees/notifications/preferences
 * Returns current notification preferences for the authenticated user.
 * Falls back to defaults if no saved preferences found.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Try to read from user_notification_preferences table
    let preferences = { ...DEFAULT_PREFERENCES }

    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!error && data?.preferences) {
        // Merge saved preferences with defaults (so new categories get defaults)
        const saved = data.preferences as typeof DEFAULT_PREFERENCES
        preferences = {
          channels: { ...DEFAULT_PREFERENCES.channels, ...saved.channels },
          categories: { ...DEFAULT_PREFERENCES.categories, ...saved.categories },
          quiet_hours: { ...DEFAULT_PREFERENCES.quiet_hours, ...saved.quiet_hours },
          digest: { ...DEFAULT_PREFERENCES.digest, ...saved.digest },
        }
      }
    } catch {
      // Table may not exist yet - return defaults
      apiLogger.info('user_notification_preferences table not found, using defaults')
    }

    return NextResponse.json({
      success: true,
      data: { preferences },
    })
  } catch (error: unknown) {
    apiLogger.error('Fetch notification preferences error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notification preferences' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/notifications/preferences
 * Update notification preferences (partial update allowed).
 * Upserts into user_notification_preferences table.
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate quiet hours if provided
    if (body.quiet_hours) {
      const qhError = validateQuietHours(body.quiet_hours)
      if (qhError) {
        return NextResponse.json(
          { success: false, error: qhError },
          { status: 400 }
        )
      }
    }

    // Validate digest frequency if provided
    if (body.digest?.frequency && !VALID_FREQUENCIES.includes(body.digest.frequency)) {
      return NextResponse.json(
        { success: false, error: `Invalid digest frequency. Must be one of: ${VALID_FREQUENCIES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate digest time if provided
    if (body.digest?.time && !isValidTime(body.digest.time)) {
      return NextResponse.json(
        { success: false, error: 'Digest time must be in HH:MM format' },
        { status: 400 }
      )
    }

    // Validate category keys if provided
    if (body.categories) {
      const invalidCategories = Object.keys(body.categories).filter(
        (k) => !VALID_CATEGORIES.includes(k)
      )
      if (invalidCategories.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid categories: ${invalidCategories.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // First, get existing preferences to merge
    let existing = { ...DEFAULT_PREFERENCES }
    try {
      const { data: existingRow } = await supabase
        .from('user_notification_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingRow?.preferences) {
        const saved = existingRow.preferences as typeof DEFAULT_PREFERENCES
        existing = {
          channels: { ...DEFAULT_PREFERENCES.channels, ...saved.channels },
          categories: { ...DEFAULT_PREFERENCES.categories, ...saved.categories },
          quiet_hours: { ...DEFAULT_PREFERENCES.quiet_hours, ...saved.quiet_hours },
          digest: { ...DEFAULT_PREFERENCES.digest, ...saved.digest },
        }
      }
    } catch {
      // Table may not exist
    }

    // Merge updates
    const merged = {
      channels: body.channels ? { ...existing.channels, ...body.channels } : existing.channels,
      categories: body.categories
        ? { ...existing.categories, ...body.categories }
        : existing.categories,
      quiet_hours: body.quiet_hours
        ? { ...existing.quiet_hours, ...body.quiet_hours }
        : existing.quiet_hours,
      digest: body.digest ? { ...existing.digest, ...body.digest } : existing.digest,
    }

    // Upsert into table
    try {
      const { error: upsertError } = await supabase
        .from('user_notification_preferences')
        .upsert(
          {
            user_id: user.id,
            preferences: merged,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )

      if (upsertError) {
        apiLogger.error('Upsert notification preferences error', upsertError)
        // If table doesn't exist, still return success with merged data
        if (upsertError.code === '42P01') {
          return NextResponse.json({
            success: true,
            data: { preferences: merged },
            message: 'Preferences computed but table does not exist yet. Run migration to persist.',
          })
        }
        throw upsertError
      }
    } catch (dbError: unknown) {
      // Gracefully handle missing table
      const msg = dbError instanceof Error ? dbError.message : String(dbError)
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: { preferences: merged },
          message: 'Preferences computed but table does not exist yet.',
        })
      }
      throw dbError
    }

    return NextResponse.json({
      success: true,
      data: { preferences: merged },
      message: 'Notification preferences updated successfully',
    })
  } catch (error: unknown) {
    apiLogger.error('Update notification preferences error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update notification preferences' },
      { status: 500 }
    )
  }
}
