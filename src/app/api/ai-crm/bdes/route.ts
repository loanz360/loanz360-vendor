import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all BDE users
    const { data: bdes, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'BDE')
      .order('full_name')

    if (error) {
      apiLogger.error('Error fetching BDEs', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch BDEs' },
        { status: 500 }
      )
    }

    // Get deal counts and performance scores for each BDE
    const bdesWithStats = await Promise.all(
      (bdes || []).map(async (bde) => {
        // Count active deals
        const { count: dealCount } = await supabase
          .from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .eq('bde_id', bde.id)
          .neq('status', 'closed')
          .neq('status', 'dropped')

        // Calculate performance score (simplified - can be enhanced)
        const { count: wonDeals } = await supabase
          .from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .eq('bde_id', bde.id)
          .eq('status', 'closed')

        const { count: totalDeals } = await supabase
          .from('crm_deals')
          .select('*', { count: 'exact', head: true })
          .eq('bde_id', bde.id)

        const performanceScore =
          totalDeals && totalDeals > 0 ? Math.round((wonDeals || 0) / totalDeals * 100) : 0

        return {
          id: bde.id,
          full_name: bde.full_name,
          email: bde.email,
          deal_count: dealCount || 0,
          performance_score: performanceScore,
        }
      })
    )

    // Sort by performance score (descending) then by deal count (ascending)
    bdesWithStats.sort((a, b) => {
      if (b.performance_score !== a.performance_score) {
        return b.performance_score - a.performance_score
      }
      return a.deal_count - b.deal_count
    })

    return NextResponse.json({ success: true, data: bdesWithStats })
  } catch (error) {
    apiLogger.error('Unexpected error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
