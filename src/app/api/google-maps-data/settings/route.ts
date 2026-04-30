import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all settings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('google_maps_scraper_settings')
      .select('*')
      .order('setting_key')

    if (error) throw error

    // Convert to key-value object
    const settings: Record<string, any> = {}
    data?.forEach(item => {
      settings[item.setting_key] = item.setting_value
    })

    return NextResponse.json({
      success: true,
      data: settings
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching settings', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Update settings
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid settings object' },
        { status: 400 }
      )
    }

    const updates = Object.entries(settings).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString()
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from('google_maps_scraper_settings')
        .upsert(update, { onConflict: 'setting_key' })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating settings', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
