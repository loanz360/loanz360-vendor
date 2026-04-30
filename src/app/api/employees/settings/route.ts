import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * PUT /api/employees/settings
 * Save employee-specific settings (support managers, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
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
    const { section, settings } = body

    if (!section || typeof section !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Section is required' },
        { status: 400 }
      )
    }

    // Upsert settings for this user + section
    const { error } = await supabase
      .from('employee_settings')
      .upsert(
        {
          user_id: user.id,
          section,
          settings: settings || {},
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,section' }
      )

    if (error) {
      // If table doesn't exist yet, just return success (settings are non-critical)
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, message: 'Settings acknowledged (table pending migration)' })
      }
      apiLogger.error('Error saving employee settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to save settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Settings saved successfully' })
  } catch (error: unknown) {
    apiLogger.error('Error in PUT /api/employees/settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employees/settings
 * Fetch employee settings for a section
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

    const section = request.nextUrl.searchParams.get('section')

    if (section) {
      const { data, error } = await supabase
        .from('employee_settings')
        .select('settings, updated_at')
        .eq('user_id', user.id)
        .eq('section', section)
        .maybeSingle()

      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        apiLogger.error('Error fetching employee settings:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch settings' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: data || { settings: {}, updated_at: null }
      })
    }

    // Fetch all settings for this user
    const { data, error } = await supabase
      .from('employee_settings')
      .select('section, settings, updated_at')
      .eq('user_id', user.id)

    if (error && error.code !== '42P01') {
      apiLogger.error('Error fetching employee settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/employees/settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
