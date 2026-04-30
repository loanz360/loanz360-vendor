import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


async function verifySuperAdmin(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return profile?.role === 'SUPER_ADMIN'
}

// GET - Fetch all DSE settings
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const isSuperAdmin = await verifySuperAdmin(supabase, user.id)
    if (!isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Super Admin access required' }, { status: 403 })
    }

    const { data: settings, error } = await supabase
      .from('dse_admin_settings')
      .select('*')
      .order('setting_key')

    if (error) throw error

    // Transform to key-value map for easier consumption
    const settingsMap: Record<string, any> = {}
    for (const s of (settings || [])) {
      settingsMap[s.setting_key] = {
        ...s.setting_value,
        _id: s.id,
        _description: s.description,
        _updated_at: s.updated_at,
      }
    }

    return NextResponse.json({
      success: true,
      data: settingsMap,
      raw: settings,
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching DSE settings', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a DSE setting
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const isSuperAdmin = await verifySuperAdmin(supabase, user.id)
    if (!isSuperAdmin) {
      return NextResponse.json({ success: false, error: 'Super Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { setting_key, setting_value } = body

    if (!setting_key || !setting_value) {
      return NextResponse.json({ success: false, error: 'setting_key and setting_value are required' }, { status: 400 })
    }

    // Validate known setting keys
    const validKeys = [
      'max_partners_per_dse',
      'allowed_partner_types',
      'partner_lead_visible_fields',
      'partner_lead_access_level',
      'recruitment_link_expiry_days',
      'customer_link_expiry_days',
      'auto_assign_territory',
    ]

    if (!validKeys.includes(setting_key)) {
      return NextResponse.json({ success: false, error: `Invalid setting key: ${setting_key}` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dse_admin_settings')
      .update({
        setting_value,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', setting_key)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: `Setting "${setting_key}" updated successfully`,
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating DSE setting', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
