/**
 * BDM Team Targets - Individual BDE Summary API
 * Returns detailed summary for a specific BDE
 * BDM access only (must be the BDE's manager)
 *
 * Rate Limit: 60 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { bdeId: string } }
) {
  return readRateLimiter(request, async (req) => {
    return await getBDESummaryHandler(req, params.bdeId)
  })
}

async function getBDESummaryHandler(request: NextRequest, bdeId: string) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bdmUserId = auth.user!.id

    // =====================================================
    // 2. VERIFY BDE IS IN BDM'S TEAM
    // =====================================================

    const { data: bdeData, error: bdeError } = await supabase
      .from('users')
      .select('id, name, email, employee_code, created_at, manager_id')
      .eq('id', bdeId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (bdeError || !bdeData) {
      return NextResponse.json(
        {
          success: false,
          error: 'BDE not found or not in your team',
        },
        { status: 404 }
      )
    }

    // Verify the BDE reports to this BDM
    if (bdeData.manager_id !== bdmUserId && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: This BDE does not report to you',
        },
        { status: 403 }
      )
    }

    // =====================================================
    // 3. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // =====================================================
    // 4. GET CURRENT MONTH DATA
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month, 0).getDate()
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    // Get latest achievement
    const { data: latestAchievement } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('bde_user_id', bdeId)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get all daily achievements for the month
    const { data: dailyAchievements } = await supabase
      .from('bde_daily_achievements')
      .select('*')
      .eq('bde_user_id', bdeId)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: true })

    // =====================================================
    // 5. GET TARGET
    // =====================================================

    const { data: target } = await supabase
      .from('team_targets')
      .select('*')
      .eq('user_id', bdeId)
      .eq('target_type', 'BDE')
      .eq('month', month)
      .eq('year', year)
      .eq('is_active', true)
      .maybeSingle()

    // =====================================================
    // 6. GET EARNED BADGES
    // =====================================================

    const currentMonth = `${year}-${String(month).padStart(2, '0')}`

    const { data: earnedBadges } = await supabase
      .from('bde_earned_badges')
      .select(`
        *,
        achievement_badges (
          badge_name,
          badge_code,
          icon,
          color,
          rarity,
          category
        )
      `)
      .eq('bde_user_id', bdeId)
      .eq('earned_in_month', currentMonth)
      .order('earned_at', { ascending: false })

    // =====================================================
    // 7. GET PERFORMANCE PROJECTION
    // =====================================================

    const { data: projection } = await supabase
      .from('performance_projections')
      .select('*')
      .eq('entity_id', bdeId)
      .eq('projection_type', 'bde')
      .eq('for_month', currentMonth)
      .eq('metric', 'conversions')
      .order('projection_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    // =====================================================
    // 8. CALCULATE PERFORMANCE METRICS
    // =====================================================

    const mtdLeads = latestAchievement?.mtd_leads_contacted || 0
    const mtdConversions = latestAchievement?.mtd_conversions || 0
    const mtdRevenue = latestAchievement?.mtd_revenue || 0

    const targetLeads = target?.monthly_conversion_target ? target.monthly_conversion_target * 5 : 100
    const targetConversions = target?.monthly_conversion_target || 20
    const targetRevenue = target?.monthly_revenue_target || 5000000

    const leadsAchievement = targetLeads > 0 ? (mtdLeads / targetLeads) * 100 : 0
    const conversionsAchievement = targetConversions > 0 ? (mtdConversions / targetConversions) * 100 : 0
    const revenueAchievement = targetRevenue > 0 ? (mtdRevenue / targetRevenue) * 100 : 0
    const overallAchievement = (leadsAchievement + conversionsAchievement + revenueAchievement) / 3

    const conversionRate = mtdLeads > 0 ? (mtdConversions / mtdLeads) * 100 : 0

    // Calculate performance status
    let status: 'exceeding' | 'on_track' | 'at_risk' | 'behind' = 'behind'
    if (overallAchievement >= 100) status = 'exceeding'
    else if (overallAchievement >= 70) status = 'on_track'
    else if (overallAchievement >= 50) status = 'at_risk'

    // Calculate grade
    let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' = 'F'
    if (overallAchievement >= 95) grade = 'A+'
    else if (overallAchievement >= 90) grade = 'A'
    else if (overallAchievement >= 85) grade = 'B+'
    else if (overallAchievement >= 80) grade = 'B'
    else if (overallAchievement >= 75) grade = 'C+'
    else if (overallAchievement >= 70) grade = 'C'
    else if (overallAchievement >= 60) grade = 'D'

    // =====================================================
    // 9. CALCULATE TRENDS
    // =====================================================

    const activeDays = dailyAchievements?.filter((a) => a.status !== 'no_activity').length || 0
    const exceededDays = dailyAchievements?.filter((a) => a.status === 'exceeded').length || 0
    const metDays = dailyAchievements?.filter((a) => a.status === 'met').length || 0

    // Calculate average daily metrics
    const avgDailyLeads = activeDays > 0 ? mtdLeads / activeDays : 0
    const avgDailyConversions = activeDays > 0 ? mtdConversions / activeDays : 0
    const avgDailyRevenue = activeDays > 0 ? mtdRevenue / activeDays : 0

    // =====================================================
    // 10. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        bde: {
          id: bdeData.id,
          name: bdeData.name,
          email: bdeData.email,
          employeeCode: bdeData.employee_code,
          joinedAt: bdeData.created_at,
        },
        summary: {
          status,
          grade,
          overallAchievement: parseFloat(overallAchievement.toFixed(2)),
          currentStreak: latestAchievement?.current_streak || 0,
          lastActivityDate: latestAchievement?.achievement_date || null,
        },
        metrics: {
          leadsContacted: mtdLeads,
          conversions: mtdConversions,
          revenue: mtdRevenue,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
        targets: {
          leadsContacted: targetLeads,
          conversions: targetConversions,
          revenue: targetRevenue,
        },
        achievement: {
          leadsAchievement: parseFloat(leadsAchievement.toFixed(2)),
          conversionsAchievement: parseFloat(conversionsAchievement.toFixed(2)),
          revenueAchievement: parseFloat(revenueAchievement.toFixed(2)),
        },
        performance: {
          activeDays,
          exceededDays,
          metDays,
          totalDays: daysInMonth,
          activityRate: parseFloat(((activeDays / daysInMonth) * 100).toFixed(2)),
          avgDailyLeads: parseFloat(avgDailyLeads.toFixed(2)),
          avgDailyConversions: parseFloat(avgDailyConversions.toFixed(2)),
          avgDailyRevenue: parseFloat(avgDailyRevenue.toFixed(2)),
        },
        badges: earnedBadges?.map((eb: any) => ({
          id: eb.badge_id,
          name: eb.achievement_badges?.badge_name,
          icon: eb.achievement_badges?.icon,
          color: eb.achievement_badges?.color,
          rarity: eb.achievement_badges?.rarity,
          category: eb.achievement_badges?.category,
          earnedAt: eb.earned_at,
          context: eb.earning_context,
        })) || [],
        projection: projection ? {
          projectedConversions: projection.projected_value,
          projectedOptimistic: projection.projected_optimistic,
          projectedPessimistic: projection.projected_pessimistic,
          confidence: projection.confidence_percentage,
          likelihood: projection.likelihood,
          reasoning: projection.reasoning,
          riskFactors: projection.risk_factors,
          successFactors: projection.success_factors,
          recommendedActions: projection.recommended_actions,
        } : null,
        month,
        year,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getBDESummaryHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
