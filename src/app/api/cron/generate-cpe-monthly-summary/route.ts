
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPerformanceGrade } from '@/lib/types/cpe-performance.types'
import { apiLogger } from '@/lib/utils/logger'

/**
 * CRON Job: Generate CPE Monthly Summary
 * Should be called at the end of each month
 *
 * Usage:
 * - Vercel Cron: Add to vercel.json (runs on 1st of each month)
 * - Manual trigger: POST /api/cron/generate-cpe-monthly-summary
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
// Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-change-me'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createClient()

    // Get last month's date
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
    const year = lastMonth.getFullYear()

    // Get all CPE users
    const { data: cpeUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('sub_role', 'CHANNEL_PARTNER_EXECUTIVE')

    if (usersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch CPE users' },
        { status: 500 }
      )
    }

    const results = []

    for (const cpeUser of cpeUsers || []) {
      try {
        // Fetch daily metrics for the month
        const { data: dailyMetrics } = await supabase
          .from('cpe_daily_metrics')
          .select('*')
          .eq('user_id', cpeUser.id)
          .gte('metric_date', `${monthStr}-01`)
          .lt('metric_date', `${year}-${String(lastMonth.getMonth() + 2).padStart(2, '0')}-01`)

        if (!dailyMetrics || dailyMetrics.length === 0) {
          results.push({
            user_id: cpeUser.id,
            user_name: cpeUser.full_name,
            success: false,
            error: 'No daily metrics found'
          })
          continue
        }

        // Aggregate monthly data
        const monthlyData = {
          partners_recruited: dailyMetrics[dailyMetrics.length - 1]?.partners_recruited_today || 0,
          ba_recruited: dailyMetrics[dailyMetrics.length - 1]?.ba_recruited || 0,
          bp_recruited: dailyMetrics[dailyMetrics.length - 1]?.bp_recruited || 0,
          cp_recruited: dailyMetrics[dailyMetrics.length - 1]?.cp_recruited || 0,
          total_leads_generated: Math.max(...dailyMetrics.map(m => m.total_leads_generated || 0)),
          leads_converted: Math.max(...dailyMetrics.map(m => m.leads_converted || 0)),
          leads_sanctioned: Math.max(...dailyMetrics.map(m => m.leads_sanctioned || 0)),
          leads_disbursed: Math.max(...dailyMetrics.map(m => m.leads_disbursed || 0)),
          total_loan_volume: Math.max(...dailyMetrics.map(m => m.total_loan_amount || 0)),
          sanctioned_volume: Math.max(...dailyMetrics.map(m => m.sanctioned_loan_amount || 0)),
          disbursed_volume: Math.max(...dailyMetrics.map(m => m.disbursed_loan_amount || 0)),
          estimated_commission: Math.max(...dailyMetrics.map(m => m.estimated_commission || 0)),
          actual_commission: Math.max(...dailyMetrics.map(m => m.actual_commission || 0)),
          conversion_rate: dailyMetrics[dailyMetrics.length - 1]?.conversion_rate || 0,
          sanction_rate: dailyMetrics[dailyMetrics.length - 1]?.sanction_rate || 0,
          disbursement_rate: dailyMetrics[dailyMetrics.length - 1]?.disbursement_rate || 0,
          avg_partner_productivity: dailyMetrics[dailyMetrics.length - 1]?.avg_partner_productivity || 0
        }

        // Fetch targets for the month
        const { data: targets } = await supabase
          .from('cpe_targets')
          .select('*')
          .eq('user_id', cpeUser.id)
          .eq('month', monthStr)
          .eq('year', year)
          .maybeSingle()

        // Calculate overall score (weighted)
        const weights = {
          partners_recruited: 0.25,
          leads_generated: 0.20,
          conversion_rate: 0.15,
          sanction_rate: 0.15,
          disbursement_rate: 0.15,
          partner_productivity: 0.10
        }

        let overallScore = 0
        let targetAchievementPercentage = 0

        if (targets) {
          const partnersAchievement = targets.target_partners_recruitment > 0
            ? (monthlyData.partners_recruited / targets.target_partners_recruitment) * 100
            : 0
          const leadsAchievement = targets.target_total_leads > 0
            ? (monthlyData.total_leads_generated / targets.target_total_leads) * 100
            : 0
          const conversionAchievement = targets.target_conversion_rate > 0
            ? (monthlyData.conversion_rate / targets.target_conversion_rate) * 100
            : 0
          const sanctionAchievement = targets.target_sanction_rate > 0
            ? (monthlyData.sanction_rate / targets.target_sanction_rate) * 100
            : 0
          const disbursementAchievement = targets.target_disbursement_rate > 0
            ? (monthlyData.disbursement_rate / targets.target_disbursement_rate) * 100
            : 0
          const productivityAchievement = targets.target_partner_productivity > 0
            ? (monthlyData.avg_partner_productivity / targets.target_partner_productivity) * 100
            : 0

          overallScore = Math.min(100,
            partnersAchievement * weights.partners_recruited +
            leadsAchievement * weights.leads_generated +
            conversionAchievement * weights.conversion_rate +
            sanctionAchievement * weights.sanction_rate +
            disbursementAchievement * weights.disbursement_rate +
            productivityAchievement * weights.partner_productivity
          )

          targetAchievementPercentage = (partnersAchievement + leadsAchievement) / 2
        }

        const performanceGrade = getPerformanceGrade(overallScore)

        // Calculate recruitment achievement percentage
        const partnersRecruitmentAchievement = targets?.target_partners_recruitment
          ? (monthlyData.partners_recruited / targets.target_partners_recruitment) * 100
          : 0

        // Insert or update monthly summary
        const { error: insertError } = await supabase
          .from('cpe_monthly_summary')
          .upsert({
            user_id: cpeUser.id,
            month: lastMonth.getMonth() + 1,
            year: year,
            ...monthlyData,
            performance_score: Math.round(overallScore),
            performance_grade: performanceGrade,
            target_achievement_percentage: targetAchievementPercentage
          }, {
            onConflict: 'user_id,month,year'
          })

        if (insertError) {
          results.push({
            user_id: cpeUser.id,
            user_name: cpeUser.full_name,
            success: false,
            error: insertError.message
          })
        } else {
          results.push({
            user_id: cpeUser.id,
            user_name: cpeUser.full_name,
            success: true,
            overall_score: overallScore,
            grade: performanceGrade
          })
        }

      } catch (err) {
        results.push({
          user_id: cpeUser.id,
          user_name: cpeUser.full_name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Generated monthly summaries for ${successCount} CPE users (${failCount} failed)`,
      month: monthStr,
      year: year,
      total_users: cpeUsers?.length || 0,
      successful: successCount,
      failed: failCount,
      details: results
    })

  } catch (error) {
    apiLogger.error('Error in CPE monthly summary generation', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Allow GET for testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'CPE Monthly Summary Generation',
    description: 'Generates monthly performance summaries for all CPE users',
    usage: 'POST with Authorization: Bearer <CRON_SECRET>',
    note: 'Should be called on the 1st of each month'
  })
}
