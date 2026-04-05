export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/analytics
 * Get dashboard statistics and trends
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
    const timeRange = searchParams.get('timeRange') || '7d'

    // Get dashboard stats
    const { data: statsData, error: statsError } = await supabase.rpc('get_dashboard_stats', {
      p_time_range: timeRange,
    })

    if (statsError) throw statsError

    // Get login trends
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const { data: trendsData, error: trendsError } = await supabase.rpc('get_login_trends', {
      p_days: days,
    })

    if (trendsError) throw trendsError

    // Get health score
    const { data: healthScore, error: healthError } = await supabase.rpc('calculate_health_score')

    if (healthError) throw healthError

    return NextResponse.json(
      {
        success: true,
        stats: statsData,
        trends: trendsData || [],
        healthScore: healthScore || 0,
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch analytics')
  }
}
