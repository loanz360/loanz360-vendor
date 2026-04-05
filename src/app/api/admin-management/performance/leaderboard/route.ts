export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/performance/leaderboard
 * Get performance leaderboard
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

    const metric = searchParams.get('metric') || 'productivity_score'
    const period = searchParams.get('period') || '7d'
    const limit = parseInt(searchParams.get('limit') || '10')

    const { data, error } = await supabase.rpc('get_performance_leaderboard', {
      p_metric: metric,
      p_period: period,
      p_limit: limit,
    })

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        leaderboard: data || [],
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch leaderboard')
  }
}
