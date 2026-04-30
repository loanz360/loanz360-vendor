/**
 * BDM Team Targets - Custom Reports API
 * Generate custom performance reports with flexible parameters
 * Supports filtering, grouping, and various metrics
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function POST(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await generateCustomReportHandler(req)
  })
}

async function generateCustomReportHandler(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized || (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // Parse custom report configuration
    const body = await request.json()
    const {
      reportName,
      dateRange,
      bdeIds,
      metrics,
      groupBy,
      filters,
      sortBy,
      limit,
    } = body

    if (!reportName || !dateRange) {
      return NextResponse.json(
        {
          success: false,
          error: 'Report name and date range are required',
        },
        { status: 400 }
      )
    }

    // Get team BDEs
    const { data: teamBDEs } = await supabase
      .from('users')
      .select('id, name, employee_code')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: { report: [], metadata: {} },
        timestamp: new Date().toISOString(),
      })
    }

    // Filter BDEs if specific IDs provided
    const selectedBDEs = bdeIds && bdeIds.length > 0
      ? teamBDEs.filter((bde) => bdeIds.includes(bde.id))
      : teamBDEs

    // Parse date range
    const { startDate, endDate, startMonth, endMonth, startYear, endYear } = dateRange

    // Build query for achievements
    let query = supabase
      .from('bde_daily_achievements')
      .select('*')
      .in('user_id', selectedBDEs.map((b) => b.id))

    // Apply date filters
    if (startMonth && startYear) {
      query = query.gte('achievement_year', startYear)
      query = query.gte('achievement_month', startMonth)
    }
    if (endMonth && endYear) {
      query = query.lte('achievement_year', endYear)
      query = query.lte('achievement_month', endMonth)
    }
    if (startDate) {
      query = query.gte('activity_date', startDate)
    }
    if (endDate) {
      query = query.lte('activity_date', endDate)
    }

    const { data: achievements } = await query

    // Get targets for the period
    let targetQuery = supabase
      .from('team_targets')
      .select('*')
      .in('user_id', selectedBDEs.map((b) => b.id))
      .eq('target_type', 'BDE')

    if (startMonth && startYear) {
      targetQuery = targetQuery.gte('year', startYear)
      targetQuery = targetQuery.gte('month', startMonth)
    }
    if (endMonth && endYear) {
      targetQuery = targetQuery.lte('year', endYear)
      targetQuery = targetQuery.lte('month', endMonth)
    }

    const { data: targets } = await targetQuery

    // Process data based on groupBy
    const reportData: any[] = []

    if (groupBy === 'bde') {
      // Group by BDE
      selectedBDEs.forEach((bde) => {
        const bdeAchievements = achievements?.filter((a) => a.user_id === bde.id) || []
        const bdeTargets = targets?.filter((t) => t.user_id === bde.id) || []

        const totalConversions = bdeAchievements.reduce((sum, a) => sum + (a.conversions || 0), 0)
        const totalRevenue = bdeAchievements.reduce((sum, a) => sum + (a.revenue_generated || 0), 0)
        const totalLeads = bdeAchievements.reduce((sum, a) => sum + (a.leads_contacted || 0), 0)
        const activeDays = bdeAchievements.filter((a) => a.leads_contacted > 0).length

        const targetConversions = bdeTargets.reduce((sum, t) => sum + (t.monthly_conversion_target || 0), 0)
        const targetRevenue = bdeTargets.reduce((sum, t) => sum + (t.monthly_revenue_target || 0), 0)

        const record: any = {
          bdeId: bde.id,
          bdeName: bde.name,
          employeeCode: bde.employee_code,
        }

        // Add requested metrics
        if (!metrics || metrics.includes('conversions')) {
          record.conversions = totalConversions
          record.targetConversions = targetConversions
          record.conversionAchievementRate = targetConversions > 0 ? (totalConversions / targetConversions) * 100 : 0
        }
        if (!metrics || metrics.includes('revenue')) {
          record.revenue = totalRevenue
          record.targetRevenue = targetRevenue
          record.revenueAchievementRate = targetRevenue > 0 ? (totalRevenue / targetRevenue) * 100 : 0
        }
        if (!metrics || metrics.includes('leads')) {
          record.leads = totalLeads
        }
        if (!metrics || metrics.includes('conversion_rate')) {
          record.conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0
        }
        if (!metrics || metrics.includes('activity')) {
          record.activeDays = activeDays
          record.avgDailyConversions = activeDays > 0 ? totalConversions / activeDays : 0
          record.avgDailyRevenue = activeDays > 0 ? totalRevenue / activeDays : 0
        }

        // Apply filters
        let includeRecord = true
        if (filters) {
          if (filters.minConversionRate && record.conversionRate < filters.minConversionRate) includeRecord = false
          if (filters.maxConversionRate && record.conversionRate > filters.maxConversionRate) includeRecord = false
          if (filters.minAchievementRate && record.conversionAchievementRate < filters.minAchievementRate)
            includeRecord = false
          if (filters.maxAchievementRate && record.conversionAchievementRate > filters.maxAchievementRate)
            includeRecord = false
        }

        if (includeRecord) {
          reportData.push(record)
        }
      })
    } else if (groupBy === 'month') {
      // Group by month
      const monthMap = new Map()

      achievements?.forEach((achievement) => {
        const key = `${achievement.achievement_year}-${achievement.achievement_month.toString().padStart(2, '0')}`
        if (!monthMap.has(key)) {
          monthMap.set(key, {
            year: achievement.achievement_year,
            month: achievement.achievement_month,
            conversions: 0,
            revenue: 0,
            leads: 0,
            activeBDEs: new Set(),
          })
        }

        const data = monthMap.get(key)
        data.conversions += achievement.conversions || 0
        data.revenue += achievement.revenue_generated || 0
        data.leads += achievement.leads_contacted || 0
        if (achievement.leads_contacted > 0) {
          data.activeBDEs.add(achievement.user_id)
        }
      })

      monthMap.forEach((data, key) => {
        const monthTargets = targets?.filter(
          (t) => t.year === data.year && t.month === data.month
        ) || []
        const targetConversions = monthTargets.reduce((sum, t) => sum + (t.monthly_conversion_target || 0), 0)

        reportData.push({
          period: key,
          year: data.year,
          month: data.month,
          conversions: data.conversions,
          revenue: data.revenue,
          leads: data.leads,
          conversionRate: data.leads > 0 ? (data.conversions / data.leads) * 100 : 0,
          activeBDEs: data.activeBDEs.size,
          targetConversions,
          achievementRate: targetConversions > 0 ? (data.conversions / targetConversions) * 100 : 0,
        })
      })
    } else {
      // Default: aggregate summary
      const totalConversions = achievements?.reduce((sum, a) => sum + (a.conversions || 0), 0) || 0
      const totalRevenue = achievements?.reduce((sum, a) => sum + (a.revenue_generated || 0), 0) || 0
      const totalLeads = achievements?.reduce((sum, a) => sum + (a.leads_contacted || 0), 0) || 0
      const uniqueActiveBDEs = new Set(
        achievements?.filter((a) => a.leads_contacted > 0).map((a) => a.user_id)
      ).size

      const targetConversions = targets?.reduce((sum, t) => sum + (t.monthly_conversion_target || 0), 0) || 0
      const targetRevenue = targets?.reduce((sum, t) => sum + (t.monthly_revenue_target || 0), 0) || 0

      reportData.push({
        summary: 'Overall Performance',
        conversions: totalConversions,
        revenue: totalRevenue,
        leads: totalLeads,
        conversionRate: totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0,
        activeBDEs: uniqueActiveBDEs,
        targetConversions,
        targetRevenue,
        conversionAchievementRate: targetConversions > 0 ? (totalConversions / targetConversions) * 100 : 0,
        revenueAchievementRate: targetRevenue > 0 ? (totalRevenue / targetRevenue) * 100 : 0,
      })
    }

    // Sort results
    if (sortBy) {
      reportData.sort((a, b) => {
        const aVal = a[sortBy.field] || 0
        const bVal = b[sortBy.field] || 0
        return sortBy.order === 'desc' ? bVal - aVal : aVal - bVal
      })
    }

    // Apply limit
    const limitedData = limit ? reportData.slice(0, limit) : reportData

    // Generate metadata
    const metadata = {
      reportName,
      generatedAt: new Date().toISOString(),
      generatedBy: auth.user?.name || 'Unknown',
      dateRange: {
        start: startDate || `${startYear}-${startMonth?.toString().padStart(2, '0')}-01`,
        end: endDate || `${endYear}-${endMonth?.toString().padStart(2, '0')}-28`,
      },
      totalRecords: reportData.length,
      displayedRecords: limitedData.length,
      bdeCount: selectedBDEs.length,
      groupBy: groupBy || 'summary',
      metricsIncluded: metrics || ['all'],
    }

    return NextResponse.json({
      success: true,
      data: {
        report: limitedData,
        metadata,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in generateCustomReportHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
