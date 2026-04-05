import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/superadmin/partner-management/analytics
 * Fetch partner analytics data with filters
 *
 * Rate Limit: 60 requests per minute
 *
 * Query Parameters:
 * - partner_type: BUSINESS_ASSOCIATE | BUSINESS_PARTNER | CHANNEL_PARTNER
 * - month: YYYY-MM format
 * - state: State name
 * - city: City name
 */
export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getAnalyticsHandler(req)
  })
}

async function getAnalyticsHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const partnerType = searchParams.get('partner_type')
    const month = searchParams.get('month')
    const state = searchParams.get('state')
    const city = searchParams.get('city')

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Build query
    let query = supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)

    if (partnerType) {
      query = query.eq('partner_type', partnerType)
    }

    if (state) {
      query = query.eq('state', state)
    }

    if (city) {
      query = query.eq('city', city)
    }

    if (month) {
      const startDate = new Date(month + '-01')
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)

      query = query
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
    }

    const { data: partners, error: queryError } = await query

    if (queryError) {
      apiLogger.error('Partner analytics query error', queryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch partner analytics' },
        { status: 500 }
      )
    }

    // Calculate metrics
    const totalPartners = partners?.length || 0
    const activePartners = partners?.filter((p: any) => p.status === 'ACTIVE').length || 0

    // Get previous month data for MoM growth
    const currentDate = new Date()
    const lastMonth = new Date(currentDate)
    lastMonth.setMonth(lastMonth.getMonth() - 1)

    const { data: lastMonthPartners } = await supabase
      .from('partners')
      .select('id')
      .eq('is_active', true)
      .is('deleted_at', null)
      .gte('created_at', new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString())
      .lt('created_at', new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString())

    const lastMonthCount = lastMonthPartners?.length || 0
    const thisMonthCount = partners?.filter((p: any) => {
      const created = new Date(p.created_at)
      return created.getMonth() === currentDate.getMonth() &&
             created.getFullYear() === currentDate.getFullYear()
    }).length || 0

    const momGrowth = lastMonthCount > 0
      ? ((thisMonthCount - lastMonthCount) / lastMonthCount * 100).toFixed(2)
      : '0.00'

    // Calculate login metrics
    const totalLogins = partners?.reduce((sum: number, p: any) => sum + (p.total_logins || 0), 0) || 0

    // Calculate lead metrics
    const leadsInProgress = partners?.reduce((sum: number, p: any) => sum + (p.leads_in_progress || 0), 0) || 0
    const leadsSanctioned = partners?.reduce((sum: number, p: any) => sum + (p.leads_sanctioned || 0), 0) || 0
    const leadsDropped = partners?.reduce((sum: number, p: any) => sum + (p.leads_dropped || 0), 0) || 0
    const totalLeads = leadsInProgress + leadsSanctioned + leadsDropped

    // Calculate payout metrics
    const estimatedPayout = partners?.reduce((sum: number, p: any) => sum + parseFloat(p.estimated_payout || 0), 0) || 0
    const actualPayout = partners?.reduce((sum: number, p: any) => sum + parseFloat(p.actual_payout || 0), 0) || 0

    // Get geographical data
    const stateData: Record<string, number> = {}
    const cityData: Record<string, number> = {}

    partners?.forEach((p: any) => {
      if (p.state) {
        stateData[p.state] = (stateData[p.state] || 0) + 1
      }
      if (p.city) {
        cityData[p.city] = (cityData[p.city] || 0) + 1
      }
    })

    const analytics = {
      overview: {
        total_partners: totalPartners,
        active_partners: activePartners,
        inactive_partners: totalPartners - activePartners,
        new_this_month: thisMonthCount,
        mom_growth_percentage: parseFloat(momGrowth)
      },
      login_metrics: {
        total_logins: totalLogins,
        average_logins_per_partner: totalPartners > 0 ? (totalLogins / totalPartners).toFixed(2) : '0.00'
      },
      lead_metrics: {
        total_leads: totalLeads,
        in_progress: leadsInProgress,
        sanctioned: leadsSanctioned,
        dropped: leadsDropped,
        conversion_rate: totalLeads > 0 ? ((leadsSanctioned / totalLeads) * 100).toFixed(2) : '0.00'
      },
      payout_metrics: {
        estimated_payout: estimatedPayout.toFixed(2),
        actual_payout: actualPayout.toFixed(2),
        payout_difference: (estimatedPayout - actualPayout).toFixed(2)
      },
      geography: {
        by_state: Object.entries(stateData)
          .map(([state, count]) => ({ state, count }))
          .sort((a, b) => b.count - a.count),
        by_city: Object.entries(cityData)
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10) // Top 10 cities
      }
    }

    return NextResponse.json({
      success: true,
      data: analytics,
      filters: {
        partner_type: partnerType,
        month,
        state,
        city
      }
    })

  } catch (error) {
    apiLogger.error('Partner analytics API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
