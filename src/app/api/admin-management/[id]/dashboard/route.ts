
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]/dashboard
 * Get comprehensive dashboard data for a specific admin
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

    // Get dashboard summary using database function
    const { data, error } = await supabase.rpc('get_admin_dashboard_summary', {
      p_admin_id: id
    })

    if (error) throw error

    if (!data || !data.admin) {
      return NextResponse.json(
        { success: false, error: 'Admin not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Dashboard API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
