
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/admin-management/performance/team-summary
 * Get team performance summary
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const period = searchParams.get('period') || '7d'

    const { data, error } = await supabase.rpc('get_team_performance_summary', {
      p_period: period,
    })

    if (error) throw error

    return NextResponse.json(
      {
        success: true,
        summary: data,
      },
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error, 'fetch team summary')
  }
}
