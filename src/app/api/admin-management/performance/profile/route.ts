export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/performance/profile
 * Get detailed performance profile for an admin
 */
export async function GET(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const adminId = searchParams.get('adminId')
    const period = searchParams.get('period') || '30d'

    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.rpc('get_performance_profile', {
      p_admin_id: adminId,
      p_period: period,
    })

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        profile: data,
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch performance profile')
  }
}
