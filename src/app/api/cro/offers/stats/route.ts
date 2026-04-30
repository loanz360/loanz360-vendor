
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET - Get CRO-specific offer statistics
 * Shows CRO's performance with offers (shares, views, conversions)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  // Use regular client for authentication
  const supabase = await createClient()
  // Use admin client for data queries (bypasses RLS)
  const supabaseAdmin = createSupabaseAdmin()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Role verification via DB lookup - only CRO roles can access this endpoint
  const { data: userDataStats } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = (userDataStats?.sub_role || userDataStats?.role || '').toUpperCase().trim()
  const allowedRoles = ['CRO', 'CUSTOMER RELATIONSHIP OFFICER', 'CRO_TEAM_LEADER', 'CRO_STATE_MANAGER', 'SUPER_ADMIN', 'ADMIN']
  if (!allowedRoles.some(r => userRole === r)) {
    return NextResponse.json({ success: false, error: 'Forbidden: CRO access required' }, { status: 403 })
  }

  try {
    // Get total active offers - use admin client
    const { count: totalOffers } = await supabaseAdmin
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .lte('start_date', new Date().toISOString())
      .gte('end_date', new Date().toISOString())

    // Get CRO's share count - use admin client
    const { count: myShares } = await supabaseAdmin
      .from('offer_shares')
      .select('*', { count: 'exact', head: true })
      .eq('shared_by', user.id)

    // Get CRO's conversion count (leads attributed to offers) - use admin client
    const { count: myConversions } = await supabaseAdmin
      .from('offer_lead_attribution')
      .select('*', { count: 'exact', head: true })
      .eq('cro_id', user.id)
      .eq('converted', true)

    // Get trending offers (most viewed in last 7 days) - use admin client
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: trendingData } = await supabaseAdmin
      .from('offer_views')
      .select('offer_id')
      .gte('viewed_at', sevenDaysAgo.toISOString())

    const trendingOffers = new Set(trendingData?.map(v => v.offer_id) || []).size

    // Get CRO's recent activity - use admin client
    const { data: recentShares } = await supabaseAdmin
      .from('offer_shares')
      .select(`
        id,
        offer_id,
        share_method,
        shared_at,
        offers (
          offer_title,
          rolled_out_by
        )
      `)
      .eq('shared_by', user.id)
      .order('shared_at', { ascending: false })
      .limit(5)

    // Get CRO's top performing offers - use admin client
    const { data: topOffers } = await supabaseAdmin
      .from('offer_shares')
      .select(`
        offer_id,
        offers (
          id,
          offer_title,
          rolled_out_by,
          offer_image_url
        )
      `)
      .eq('shared_by', user.id)

    // Count shares per offer
    const offerShareCounts = topOffers?.reduce((acc: any, share: any) => {
      const offerId = share.offer_id
      if (!acc[offerId]) {
        acc[offerId] = {
          ...share.offers,
          share_count: 0
        }
      }
      acc[offerId].share_count++
      return acc
    }, {})

    const topPerforming = Object.values(offerShareCounts || {})
      .sort((a: any, b: any) => b.share_count - a.share_count)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      stats: {
        total_offers: totalOffers || 0,
        my_shares: myShares || 0,
        my_conversions: myConversions || 0,
        trending_offers: trendingOffers || 0
      },
      recent_activity: recentShares || [],
      top_performing: topPerforming || []
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching CRO offer stats', error)
    logApiError(error as Error, request, { action: 'get_cro_stats' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
