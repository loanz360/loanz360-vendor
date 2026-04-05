export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import logger from '@/lib/monitoring/logger'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import { sanitizeUuid } from '@/lib/security/sanitization'

/**
 * POST /api/contests/:id/evaluate
 * Manually trigger contest evaluation and score calculation
 * Access: Users with CONTEST_EVALUATE permission (Admins, Contest Managers)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Sanitize and validate ID
    const { id } = params
    try {
      sanitizeUuid(id)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      )
    }

    // Check permission
    const permissionCheck = await requirePermission(user.id, Permission.CONTEST_EVALUATE)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: permissionCheck.error },
        { status: 403 }
      )
    }

    const adminSupabase = createSupabaseAdmin()

    // Fetch contest details
    const { data: contest, error: contestError } = await adminSupabase
      .from('contests')
      .select('id, contest_title, status, evaluation_criteria, auto_evaluate')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (contestError || !contest) {
      return NextResponse.json({ success: false, error: 'Contest not found' }, { status: 404 })
    }

    if (contest.status !== 'active') {
      return NextResponse.json(
        { error: 'Can only evaluate active contests' },
        { status: 400 }
      )
    }

    // Get all participants
    const { data: participants, error: participantsError } = await adminSupabase
      .from('contest_participants')
      .select('id, partner_id, performance_data')
      .eq('contest_id', id)
      .eq('participation_status', 'participating')

    if (participantsError) {
      logger.error(`Error fetching participants for evaluation ${id}`, participantsError)
      throw new Error(`Failed to fetch participants: ${participantsError.message}`)
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No participants to evaluate',
        data: { evaluated_count: 0 },
      })
    }

    // Evaluate each participant
    const evaluationCriteria = contest.evaluation_criteria as any
    const evaluatedParticipants = []

    for (const participant of participants) {
      try {
        // Calculate score based on evaluation criteria
        const score = await calculateParticipantScore(
          adminSupabase,
          participant.partner_id,
          evaluationCriteria
        )

        // Update participant score
        const { data: updated } = await adminSupabase
          .from('contest_participants')
          .update({
            current_score: score,
            performance_data: participant.performance_data || {},
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', participant.id)
          .select()
          .maybeSingle()

        if (updated) {
          evaluatedParticipants.push(updated)

          // Create performance history snapshot
          await adminSupabase.from('contest_performance_history').insert({
            contest_id: id,
            partner_id: participant.partner_id,
            participant_id: participant.id,
            score_snapshot: score,
            performance_data: participant.performance_data,
            recorded_at: new Date().toISOString(),
          })
        }
      } catch (error) {
        logger.error(`Error evaluating participant ${participant.id}`, error instanceof Error ? error : undefined)
        // Continue with other participants
      }
    }

    // Update leaderboard
    const { error: leaderboardError } = await adminSupabase.rpc('update_contest_leaderboard', {
      p_contest_id: id
    })

    if (leaderboardError) {
      logger.error(`Error updating leaderboard for contest ${id}`, leaderboardError)
      // Don't fail the whole evaluation if leaderboard update fails
    }

    // Recalculate analytics
    const { error: analyticsError } = await adminSupabase.rpc('calculate_contest_analytics', {
      p_contest_id: id
    })

    if (analyticsError) {
      logger.error(`Error calculating analytics for contest ${id}`, analyticsError)
      // Don't fail the whole evaluation if analytics calculation fails
    }

    // Log audit event
    const { logContestAction, ContestAuditAction, getClientIp, getUserAgent } = await import('@/lib/audit/contest-audit')
    await logContestAction({
      contest_id: id,
      action: ContestAuditAction.CONTEST_EVALUATED,
      changed_by: user.id,
      metadata: {
        contest_title: contest.contest_title,
        evaluated_count: evaluatedParticipants.length,
        total_participants: participants.length,
      },
      ip_address: getClientIp(request),
      user_agent: getUserAgent(request),
    })

    logger.info(`Evaluated ${evaluatedParticipants.length} participants for contest ${id} by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Contest evaluation completed',
      data: {
        evaluated_count: evaluatedParticipants.length,
        total_participants: participants.length,
      },
    })
  } catch (error) {
    logger.error('Error in POST /api/contests/:id/evaluate', error instanceof Error ? error : undefined)
    logApiError(error as Error, request, { action: 'evaluateContest' })

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'

    return NextResponse.json({ success: false, error: 'Failed to evaluate contest',
      message: errorMessage,
    }, { status: 500 })
  }
}

/**
 * Helper: Calculate participant score based on evaluation criteria
 * Fetches real performance data from database tables
 */
async function calculateParticipantScore(
  supabase: any,
  partnerId: string,
  evaluationCriteria: any
): Promise<number> {
  try {
    const metrics = evaluationCriteria.metrics || []
    let totalScore = 0

    // Get partner's actual user_id (metrics are tracked by user_id)
    const { data: partner } = await supabase
      .from('partners')
      .select('user_id')
      .eq('user_id', partnerId)
      .maybeSingle()

    if (!partner) {
      logger.warn(`Partner not found: ${partnerId}`)
      return 0
    }

    for (const metric of metrics) {
      const metricName = metric.name
      const metricWeight = metric.weight || 0
      const metricTarget = metric.target || 1
      let metricValue = 0

      switch (metricName) {
        case 'sales_volume':
        case 'total_disbursed':
        case 'disbursement_amount': {
          // Fetch total disbursed loan amount
          const { data: loans } = await supabase
            .from('loan_applications')
            .select('loan_amount, disbursement_details')
            .eq('partner_id', partner.user_id)
            .in('application_status', ['APPROVED', 'DISBURSED'])

          if (loans && loans.length > 0) {
            metricValue = loans.reduce((sum: number, loan: any) => {
              // Check if actually disbursed
              const disbursed = loan.disbursement_details?.disbursed_amount || loan.loan_amount
              return sum + parseFloat(disbursed || 0)
            }, 0)
          }
          break
        }

        case 'leads_converted':
        case 'conversion_count':
        case 'leads_count': {
          // Fetch converted leads count
          const { data: leads, count } = await supabase
            .from('leads')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)
            .eq('converted', true)

          metricValue = count || 0
          break
        }

        case 'total_leads':
        case 'lead_generation': {
          // Fetch total leads generated
          const { data: leads, count } = await supabase
            .from('leads')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)

          metricValue = count || 0
          break
        }

        case 'conversion_rate': {
          // Calculate conversion rate
          const { data: totalLeads, count: totalCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)

          const { data: convertedLeads, count: convertedCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)
            .eq('converted', true)

          if (totalCount && totalCount > 0) {
            metricValue = ((convertedCount || 0) / totalCount) * 100
          }
          break
        }

        case 'loan_count':
        case 'applications_count': {
          // Fetch total loan applications
          const { data: loans, count } = await supabase
            .from('loan_applications')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)

          metricValue = count || 0
          break
        }

        case 'approved_loans': {
          // Fetch approved loan count
          const { data: loans, count } = await supabase
            .from('loan_applications')
            .select('id', { count: 'exact' })
            .eq('partner_id', partner.user_id)
            .in('application_status', ['APPROVED', 'DISBURSED'])

          metricValue = count || 0
          break
        }

        case 'average_loan_amount': {
          // Calculate average loan amount
          const { data: loans } = await supabase
            .from('loan_applications')
            .select('loan_amount')
            .eq('partner_id', partner.user_id)
            .in('application_status', ['APPROVED', 'DISBURSED'])

          if (loans && loans.length > 0) {
            const total = loans.reduce((sum: number, loan: any) => sum + parseFloat(loan.loan_amount || 0), 0)
            metricValue = total / loans.length
          }
          break
        }

        case 'customer_satisfaction':
        case 'feedback_score': {
          // Placeholder for customer satisfaction
          // Would need a feedback/ratings table
          metricValue = 0
          logger.info('Customer satisfaction metric requires feedback table')
          break
        }

        default:
          logger.warn(`Unknown metric: ${metricName}`)
          metricValue = 0
      }

      // Calculate metric score based on target achievement
      let metricScore = 0

      if (metricTarget > 0) {
        // Calculate percentage of target achieved
        const targetPercentage = (metricValue / metricTarget) * 100
        // Apply weight
        metricScore = targetPercentage * metricWeight
      } else {
        // If no target set, use raw value with weight
        metricScore = metricValue * metricWeight
      }

      totalScore += metricScore

      logger.info(`Metric ${metricName}: value=${metricValue}, target=${metricTarget}, score=${metricScore}`)
    }

    // Apply scoring formula
    const scoringFormula = evaluationCriteria.scoring_formula || 'weighted_sum'

    if (scoringFormula === 'weighted_sum') {
      return Math.round(totalScore * 100) / 100
    } else if (scoringFormula === 'average') {
      const avgScore = metrics.length > 0 ? totalScore / metrics.length : 0
      return Math.round(avgScore * 100) / 100
    }

    // Default: return weighted sum
    return Math.round(totalScore * 100) / 100
  } catch (error) {
    logger.error('Error calculating participant score', error instanceof Error ? error : undefined)
    return 0
  }
}
