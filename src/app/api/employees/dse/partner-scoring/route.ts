import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSE } from '@/lib/middleware/verify-dse-role'
import { calculatePartnerScore, analyzeChurnRisk, type PartnerMetrics } from '@/lib/utils/partner-scoring'


/**
 * GET /api/employees/dse/partner-scoring
 * Calculates quality scores for all partners recruited by this DSE.
 * Optionally updates the partners table with computed scores.
 *
 * Query params:
 *   ?partner_id=uuid  — Score a single partner
 *   ?update=true      — Persist scores to database
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const auth = await verifyDSE()
    if (!auth.isValid) return auth.response

    const { supabase, userId } = auth
    const { searchParams } = new URL(request.url)
    const specificPartnerId = searchParams.get('partner_id')
    const shouldUpdate = searchParams.get('update') === 'true'

    // Fetch partners
    let partnersQuery = supabase
      .from('partners')
      .select(`
        id, partner_id, full_name, partner_type, is_active,
        total_leads, leads_in_progress, leads_sanctioned, leads_dropped,
        leads_disbursed, total_disbursed_value, avg_form_completion,
        login_days_last_30, last_login_at, fraud_flags, rejected_for_compliance,
        joining_date, created_at,
        total_logins, lifetime_earnings
      `)
      .eq('recruited_by_cpe', userId)

    if (specificPartnerId) {
      partnersQuery = partnersQuery.eq('id', specificPartnerId)
    }

    const { data: partners, error: partnersError } = await partnersQuery

    if (partnersError) {
      apiLogger.error('Partner scoring: fetch error', partnersError)
      return NextResponse.json({ success: false, error: 'Failed to fetch partners' }, { status: 500 })
    }

    if (!partners || partners.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No partners found to score',
      })
    }

    const now = new Date()
    const scoredPartners = partners.map((p: Record<string, unknown>) => {
      const joiningDate = p.joining_date ? new Date(p.joining_date as string) : new Date(p.created_at as string)
      const daysActive = Math.max(1, Math.floor((now.getTime() - joiningDate.getTime()) / (1000 * 60 * 60 * 24)))
      const lastLogin = p.last_login_at ? new Date(p.last_login_at as string) : null
      const daysSinceLastLogin = lastLogin ? Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)) : null

      const metrics: PartnerMetrics = {
        totalLeads: (p.total_leads as number) || 0,
        leadsSanctioned: (p.leads_sanctioned as number) || 0,
        leadsDisbursed: (p.leads_disbursed as number) || 0,
        leadsDropped: (p.leads_dropped as number) || 0,
        leadsRejected: 0,
        totalDisbursedValue: (p.total_disbursed_value as number) || 0,
        avgFormCompletion: (p.avg_form_completion as number) || 0,
        loginDaysLast30: (p.login_days_last_30 as number) || 0,
        daysSinceLastLogin,
        fraudFlags: (p.fraud_flags as number) || 0,
        rejectedForCompliance: (p.rejected_for_compliance as number) || 0,
        daysActive,
      }

      const score = calculatePartnerScore(metrics)
      const churnRisk = analyzeChurnRisk(
        daysSinceLastLogin,
        0, // leadsLast30Days — would need separate query
        (p.login_days_last_30 as number) || 0,
        (p.is_active as boolean)
      )

      return {
        partner_id: p.id,
        display_id: p.partner_id,
        full_name: p.full_name,
        partner_type: p.partner_type,
        is_active: p.is_active,
        score: score.total,
        grade: score.grade,
        grade_label: score.gradeLabel,
        grade_color: score.gradeColor,
        grade_bg_color: score.gradeBgColor,
        breakdown: score.breakdown,
        insights: score.insights,
        churn_risk: churnRisk.risk,
        churn_label: churnRisk.label,
        churn_reason: churnRisk.reason,
        churn_action: churnRisk.action,
        metrics,
      }
    })

    // Persist scores if requested
    if (shouldUpdate) {
      const updates = scoredPartners.map(async (sp: Record<string, unknown>) => {
        // Update partner record
        await supabase
          .from('partners')
          .update({
            quality_score: sp.score,
            quality_grade: sp.grade,
            score_updated_at: now.toISOString(),
          })
          .eq('id', sp.partner_id)

        // Insert score history
        await supabase
          .from('partner_score_history')
          .insert({
            partner_id: sp.partner_id,
            quality_score: sp.score,
            quality_grade: sp.grade,
            breakdown: sp.breakdown,
          })
      })

      await Promise.allSettled(updates)
    }

    // Summary stats
    const gradeDistribution = {
      PLATINUM: scoredPartners.filter((p: Record<string, unknown>) => p.grade === 'PLATINUM').length,
      GOLD: scoredPartners.filter((p: Record<string, unknown>) => p.grade === 'GOLD').length,
      SILVER: scoredPartners.filter((p: Record<string, unknown>) => p.grade === 'SILVER').length,
      BRONZE: scoredPartners.filter((p: Record<string, unknown>) => p.grade === 'BRONZE').length,
    }

    const avgScore = scoredPartners.length > 0
      ? Math.round(scoredPartners.reduce((s: number, p: Record<string, unknown>) => s + (p.score as number), 0) / scoredPartners.length)
      : 0

    return NextResponse.json({
      success: true,
      data: scoredPartners,
      summary: {
        total_partners: scoredPartners.length,
        average_score: avgScore,
        grade_distribution: gradeDistribution,
        updated: shouldUpdate,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Partner scoring error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
