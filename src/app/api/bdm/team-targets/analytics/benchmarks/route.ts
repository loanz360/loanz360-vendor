/**
 * BDM Team Targets - Analytics Benchmarks API
 * Compares team performance against organizational benchmarks
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getBenchmarksHandler(req)
  })
}

async function getBenchmarksHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Get team performance
    const { data: teamBDEs } = await supabase
      .from('users')
      .select('id')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { benchmarks: [] },
        timestamp: new Date().toISOString(),
      })
    }

    const teamBDEIds = teamBDEs.map(b => b.id)

    const { data: teamAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('user_id', teamBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    const teamLeads = teamAchievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0
    const teamConversions = teamAchievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
    const teamRevenue = teamAchievements?.reduce((sum, a) => sum + (a.revenue_generated || 0), 0) || 0
    const teamConversionRate = teamLeads > 0 ? (teamConversions / teamLeads) * 100 : 0

    // Get organization-wide performance (all BDEs)
    const { data: allBDEs } = await supabase
      .from('users')
      .select('id')
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    const allBDEIds = allBDEs?.map(b => b.id) || []

    const { data: orgAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('leads_contacted, conversions, revenue_generated')
      .in('user_id', allBDEIds)
      .eq('achievement_month', month)
      .eq('achievement_year', year)

    const orgLeads = orgAchievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0
    const orgConversions = orgAchievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
    const orgRevenue = orgAchievements?.reduce((sum, a) => sum + (a.revenue_generated || 0), 0) || 0
    const orgConversionRate = orgLeads > 0 ? (orgConversions / orgLeads) * 100 : 0

    const benchmarks = [
      {
        metric: 'Conversion Rate',
        teamValue: teamConversionRate,
        orgAverage: orgConversionRate,
        difference: teamConversionRate - orgConversionRate,
        performance: teamConversionRate >= orgConversionRate ? 'above' : 'below',
      },
      {
        metric: 'Total Conversions',
        teamValue: teamConversions,
        orgAverage: orgConversions / (allBDEIds.length || 1),
        difference: teamConversions - (orgConversions / (allBDEIds.length || 1)),
        performance: teamConversions >= (orgConversions / (allBDEIds.length || 1)) ? 'above' : 'below',
      },
      {
        metric: 'Revenue per BDE',
        teamValue: teamRevenue / (teamBDEIds.length || 1),
        orgAverage: orgRevenue / (allBDEIds.length || 1),
        difference: (teamRevenue / (teamBDEIds.length || 1)) - (orgRevenue / (allBDEIds.length || 1)),
        performance: (teamRevenue / (teamBDEIds.length || 1)) >= (orgRevenue / (allBDEIds.length || 1)) ? 'above' : 'below',
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        benchmarks,
        summary: {
          metricsAboveAvg: benchmarks.filter(b => b.performance === 'above').length,
          metricsBelowAvg: benchmarks.filter(b => b.performance === 'below').length,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBenchmarksHandler', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
