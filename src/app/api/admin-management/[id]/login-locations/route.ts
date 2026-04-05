export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/login-locations
 * Get login location history for an admin
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


    const supabase = createSupabaseAdmin()
    const { id } = await params

    // Get admin
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

    // Get login locations
    const { data: locations, error: locationsError } = await supabase
      .from('admin_login_locations')
      .select('*')
      .eq('admin_id', id)
      .order('last_login_at', { ascending: false })

    if (locationsError) throw locationsError

    // Calculate geographic diversity score
    const uniqueCountries = new Set(locations?.map(l => l.country_code))
    const uniqueCities = new Set(locations?.map(l => l.city))

    return NextResponse.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          admin_unique_id: admin.admin_unique_id,
          full_name: admin.full_name
        },
        locations: locations || [],
        summary: {
          total_locations: locations?.length || 0,
          unique_countries: uniqueCountries.size,
          unique_cities: uniqueCities.size,
          suspicious_locations: locations?.filter(l => l.is_suspicious).length || 0,
          vpn_usage: locations?.filter(l => l.is_vpn).length || 0,
          tor_usage: locations?.filter(l => l.is_tor).length || 0
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Login Locations API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
