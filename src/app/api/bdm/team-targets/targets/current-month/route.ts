/**
 * BDM Team Targets - Current Month Targets API
 * Returns all targets for the current month for BDM's team
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
    return await getCurrentTargetsHandler(req)
  })
}

async function getCurrentTargetsHandler(request: NextRequest) {
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
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString()) + 1
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // =====================================================
    // 3. GET TEAM BDEs
    // =====================================================

    const { data: teamBDEs, error: bdeError } = await supabase
      .from('users')
      .select('id, name, email, employee_code, avatar_url, created_at')
      .eq('manager_id', bdmUserId)
      .eq('sub_role', 'BUSINESS_DEVELOPMENT_EXECUTIVE')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })

    if (bdeError) {
      apiLogger.error('Error fetching BDEs', bdeError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch team data',
        },
        { status: 500 }
      )
    }

    if (!teamBDEs || teamBDEs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          targets: [],
          summary: {
            totalBDEs: 0,
            targetsSet: 0,
            targetsNotSet: 0,
            totalMonthlyConversionTarget: 0,
            totalMonthlyRevenueTarget: 0,
            avgDailyConversionTarget: 0,
          },
          month,
          year,
        },
        timestamp: new Date().toISOString(),
      })
    }

    const bdeIds = teamBDEs.map((bde) => bde.id)

    // =====================================================
    // 4. GET CURRENT MONTH TARGETS
    // =====================================================

    const { data: targets, error: targetsError } = await supabase
      .from('team_targets')
      .select(`
        *,
        created_by_user:created_by (
          name,
          email
        ),
        updated_by_user:updated_by (
          name,
          email
        )
      `)
      .in('user_id', bdeIds)
      .eq('target_type', 'BDE')
      .eq('month', month)
      .eq('year', year)
      .eq('is_active', true)

    if (targetsError) {
      apiLogger.error('Error fetching targets', targetsError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch targets',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 5. GET CURRENT ACHIEVEMENTS
    // =====================================================

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const daysInMonth = new Date(year, month, 0).getDate()
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data: achievements, error: achievementsError } = await supabase
      .from('bde_daily_achievements')
      .select('bde_user_id, mtd_leads_contacted, mtd_conversions, mtd_revenue')
      .in('bde_user_id', bdeIds)
      .gte('achievement_date', startOfMonth)
      .lte('achievement_date', endOfMonth)
      .order('achievement_date', { ascending: false })

    if (achievementsError) {
      apiLogger.error('Error fetching achievements', achievementsError)
    }

    // Get latest achievement for each BDE
    const latestAchievements = new Map()
    achievements?.forEach((achievement) => {
      if (!latestAchievements.has(achievement.bde_user_id)) {
        latestAchievements.set(achievement.bde_user_id, achievement)
      }
    })

    // =====================================================
    // 6. BUILD TARGET DATA WITH PROGRESS
    // =====================================================

    const targetMap = new Map()
    targets?.forEach((target) => {
      targetMap.set(target.user_id, target)
    })

    let totalMonthlyConversionTarget = 0
    let totalMonthlyRevenueTarget = 0
    let totalDailyConversionTarget = 0
    let targetsSetCount = 0

    const targetData = teamBDEs.map((bde) => {
      const target = targetMap.get(bde.id)
      const achievement = latestAchievements.get(bde.id)

      const hasTarget = !!target

      // Target values
      const dailyConversionTarget = target?.daily_conversion_target || 0
      const monthlyConversionTarget = target?.monthly_conversion_target || 0
      const monthlyRevenueTarget = target?.monthly_revenue_target || 0
      const dailyLeadsTarget = dailyConversionTarget * 5 // Assume 5 leads per conversion
      const monthlyLeadsTarget = monthlyConversionTarget * 5

      // Current achievement values
      const mtdLeads = achievement?.mtd_leads_contacted || 0
      const mtdConversions = achievement?.mtd_conversions || 0
      const mtdRevenue = achievement?.mtd_revenue || 0

      // Calculate progress percentages
      const leadsProgress = monthlyLeadsTarget > 0 ? (mtdLeads / monthlyLeadsTarget) * 100 : 0
      const conversionsProgress = monthlyConversionTarget > 0 ? (mtdConversions / monthlyConversionTarget) * 100 : 0
      const revenueProgress = monthlyRevenueTarget > 0 ? (mtdRevenue / monthlyRevenueTarget) * 100 : 0
      const overallProgress = (leadsProgress + conversionsProgress + revenueProgress) / 3

      // Calculate status
      let status: 'exceeding' | 'on_track' | 'at_risk' | 'behind' | 'no_target' = 'no_target'
      if (hasTarget) {
        if (overallProgress >= 100) status = 'exceeding'
        else if (overallProgress >= 70) status = 'on_track'
        else if (overallProgress >= 50) status = 'at_risk'
        else status = 'behind'
      }

      // Update totals
      if (hasTarget) {
        targetsSetCount++
        totalMonthlyConversionTarget += monthlyConversionTarget
        totalMonthlyRevenueTarget += monthlyRevenueTarget
        totalDailyConversionTarget += dailyConversionTarget
      }

      return {
        bdeId: bde.id,
        bdeName: bde.name,
        employeeCode: bde.employee_code,
        email: bde.email,
        avatarUrl: bde.avatar_url,
        hasTarget,
        target: hasTarget ? {
          id: target.id,
          dailyConversionTarget,
          monthlyConversionTarget,
          monthlyRevenueTarget,
          dailyLeadsTarget,
          monthlyLeadsTarget,
          incentiveMultiplier: target.incentive_multiplier || 1.0,
          targetRationale: target.target_rationale,
          notes: target.notes,
          createdAt: target.created_at,
          updatedAt: target.updated_at,
          createdBy: target.created_by_user ? {
            name: (target.created_by_user as any).name,
            email: (target.created_by_user as any).email,
          } : null,
          updatedBy: target.updated_by_user ? {
            name: (target.updated_by_user as any).name,
            email: (target.updated_by_user as any).email,
          } : null,
        } : null,
        current: {
          mtdLeads,
          mtdConversions,
          mtdRevenue,
        },
        progress: hasTarget ? {
          leads: parseFloat(leadsProgress.toFixed(2)),
          conversions: parseFloat(conversionsProgress.toFixed(2)),
          revenue: parseFloat(revenueProgress.toFixed(2)),
          overall: parseFloat(overallProgress.toFixed(2)),
        } : null,
        remaining: hasTarget ? {
          leads: Math.max(0, monthlyLeadsTarget - mtdLeads),
          conversions: Math.max(0, monthlyConversionTarget - mtdConversions),
          revenue: Math.max(0, monthlyRevenueTarget - mtdRevenue),
        } : null,
        status,
        daysRemaining: Math.max(0, daysInMonth - new Date().getDate()),
        requiredDailyRate: hasTarget && daysInMonth - new Date().getDate() > 0 ? {
          leads: parseFloat((Math.max(0, monthlyLeadsTarget - mtdLeads) / Math.max(1, daysInMonth - new Date().getDate())).toFixed(2)),
          conversions: parseFloat((Math.max(0, monthlyConversionTarget - mtdConversions) / Math.max(1, daysInMonth - new Date().getDate())).toFixed(2)),
          revenue: parseFloat((Math.max(0, monthlyRevenueTarget - mtdRevenue) / Math.max(1, daysInMonth - new Date().getDate())).toFixed(2)),
        } : null,
      }
    })

    // Sort: targets set first (by progress), then no targets
    targetData.sort((a, b) => {
      if (a.hasTarget && !b.hasTarget) return -1
      if (!a.hasTarget && b.hasTarget) return 1
      if (a.hasTarget && b.hasTarget) {
        return (b.progress?.overall || 0) - (a.progress?.overall || 0)
      }
      return 0
    })

    // =====================================================
    // 7. GET TARGET TEMPLATES
    // =====================================================

    const { data: templates, error: templatesError } = await supabase
      .from('target_templates')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('template_name', { ascending: true })

    if (templatesError) {
      apiLogger.error('Error fetching templates', templatesError)
    }

    // =====================================================
    // 8. BUILD SUMMARY
    // =====================================================

    const summary = {
      totalBDEs: teamBDEs.length,
      targetsSet: targetsSetCount,
      targetsNotSet: teamBDEs.length - targetsSetCount,
      totalMonthlyConversionTarget,
      totalMonthlyRevenueTarget,
      avgDailyConversionTarget: targetsSetCount > 0
        ? parseFloat((totalDailyConversionTarget / targetsSetCount).toFixed(2))
        : 0,
      avgMonthlyConversionTarget: targetsSetCount > 0
        ? parseFloat((totalMonthlyConversionTarget / targetsSetCount).toFixed(2))
        : 0,
      avgMonthlyRevenueTarget: targetsSetCount > 0
        ? parseFloat((totalMonthlyRevenueTarget / targetsSetCount).toFixed(2))
        : 0,
    }

    // =====================================================
    // 9. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        targets: targetData,
        templates: templates?.map((template) => ({
          id: template.id,
          name: template.template_name,
          description: template.template_description,
          isDefault: template.is_default,
          dailyConversionTarget: template.daily_conversion_target,
          monthlyConversionTarget: template.monthly_conversion_target,
          monthlyRevenueTarget: template.monthly_revenue_target,
          incentiveMultiplier: template.incentive_multiplier,
        })) || [],
        summary,
        period: {
          month,
          year,
          daysInMonth,
          currentDay: new Date().getDate(),
          daysRemaining: Math.max(0, daysInMonth - new Date().getDate()),
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getCurrentTargetsHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
