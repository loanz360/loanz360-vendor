import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getCreditMetadata, getCreditBureauLoans, getFetchHistory } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

// Factor weights for score calculation (industry standard)
const FACTOR_WEIGHTS = {
  payment_history: 0.35,
  credit_utilization: 0.30,
  credit_age: 0.15,
  credit_mix: 0.10,
  recent_enquiries: 0.10
};

/**
 * GET /api/customers/credit-assessment/health
 *
 * Fetches comprehensive credit health assessment with recommendations.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get credit data
    const metadata = await getCreditMetadata(user.id);
    const loans = await getCreditBureauLoans(user.id);
    const fetchHistory = await getFetchHistory(user.id, 12);

    // Calculate metrics
    const activeLoans = loans.filter(l => l.account_status === 'ACTIVE');
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
    const totalSanctioned = loans.reduce((sum, l) => sum + (l.sanctioned_amount || 0), 0);
    const creditUtilization = totalSanctioned > 0
      ? Math.round((totalOutstanding / totalSanctioned) * 100)
      : 0;

    // Calculate factor scores
    const calculateFactors = () => {
      // Payment History (35%)
      let totalPayments = 0;
      let onTimePayments = 0;
      loans.forEach(loan => {
        const history = Array.isArray(loan.payment_history) ? loan.payment_history : [];
        totalPayments += history.length;
        onTimePayments += history.filter(p => (p.dpd || 0) === 0).length;
      });
      const paymentHistoryScore = totalPayments > 0
        ? Math.round((onTimePayments / totalPayments) * 100)
        : 100;

      // Credit Utilization (30%)
      const utilizationScore = creditUtilization <= 10 ? 100
        : creditUtilization <= 30 ? 85
        : creditUtilization <= 50 ? 65
        : creditUtilization <= 70 ? 45
        : 25;

      // Credit Age (15%)
      const oldestLoan = loans.reduce((oldest, loan) => {
        if (!loan.disbursement_date) return oldest;
        if (!oldest) return loan;
        return new Date(loan.disbursement_date) < new Date(oldest.disbursement_date)
          ? loan : oldest;
      }, null as typeof loans[0] | null);

      let creditAgeYears = 0;
      if (oldestLoan?.disbursement_date) {
        creditAgeYears = (Date.now() - new Date(oldestLoan.disbursement_date).getTime())
          / (365 * 24 * 60 * 60 * 1000);
      }
      const creditAgeScore = creditAgeYears >= 10 ? 100
        : creditAgeYears >= 7 ? 90
        : creditAgeYears >= 5 ? 75
        : creditAgeYears >= 3 ? 60
        : creditAgeYears >= 1 ? 40
        : 20;

      // Credit Mix (10%)
      const loanTypes = new Set(loans.map(l => l.loan_type));
      const hasSecuredLoan = loans.some(l =>
        ['HOME', 'VEHICLE', 'GOLD', 'LAP'].some(t => l.loan_type?.includes(t))
      );
      const hasUnsecuredLoan = loans.some(l =>
        ['PERSONAL', 'CREDIT_CARD', 'CONSUMER'].some(t => l.loan_type?.includes(t))
      );
      const creditMixScore = (hasSecuredLoan && hasUnsecuredLoan && loanTypes.size >= 3) ? 100
        : (hasSecuredLoan || hasUnsecuredLoan) && loanTypes.size >= 2 ? 75
        : loanTypes.size >= 1 ? 50
        : 25;

      // Recent Enquiries (10%)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const recentLoans = loans.filter(l => {
        if (!l.disbursement_date) return false;
        return new Date(l.disbursement_date) > sixMonthsAgo;
      });
      const enquiryScore = recentLoans.length === 0 ? 100
        : recentLoans.length === 1 ? 85
        : recentLoans.length === 2 ? 70
        : recentLoans.length <= 4 ? 50
        : 30;

      return [
        {
          name: 'Payment History',
          score: paymentHistoryScore,
          max_score: 100,
          weight: 35,
          impact: 'high' as const,
          description: 'Your track record of paying bills on time',
          improvement_tips: paymentHistoryScore < 90 ? [
            'Set up auto-pay for all your loans and credit cards',
            'Pay at least minimum due before due date',
            'Clear any overdue payments immediately'
          ] : [
            'Excellent! Continue maintaining your payment discipline',
            'Keep sufficient balance in your payment accounts'
          ]
        },
        {
          name: 'Credit Utilization',
          score: utilizationScore,
          max_score: 100,
          weight: 30,
          impact: 'high' as const,
          description: `You're using ${creditUtilization}% of your available credit`,
          improvement_tips: utilizationScore < 85 ? [
            'Try to keep utilization below 30% of your credit limit',
            'Pay credit card bills before statement date',
            'Request a credit limit increase to improve ratio'
          ] : [
            'Good utilization! Keep it under 30%',
            'Consider making multiple payments per month'
          ]
        },
        {
          name: 'Credit Age',
          score: creditAgeScore,
          max_score: 100,
          weight: 15,
          impact: 'medium' as const,
          description: `Your credit history spans ${creditAgeYears.toFixed(1)} years`,
          improvement_tips: creditAgeScore < 75 ? [
            'Keep your oldest credit accounts open',
            'Avoid closing old credit cards even if unused',
            'Become an authorized user on older accounts'
          ] : [
            'Good credit history length',
            'Continue maintaining your oldest accounts'
          ]
        },
        {
          name: 'Credit Mix',
          score: creditMixScore,
          max_score: 100,
          weight: 10,
          impact: 'low' as const,
          description: `You have ${loanTypes.size} different types of credit`,
          improvement_tips: creditMixScore < 75 ? [
            'Consider diversifying with both secured and unsecured loans',
            'A mix of credit cards and installment loans is healthy',
            'Only take new credit if genuinely needed'
          ] : [
            'Good mix of credit types',
            'Maintain diversity in your credit portfolio'
          ]
        },
        {
          name: 'Recent Enquiries',
          score: enquiryScore,
          max_score: 100,
          weight: 10,
          impact: 'low' as const,
          description: `${recentLoans.length} credit applications in last 6 months`,
          improvement_tips: enquiryScore < 70 ? [
            'Limit new credit applications',
            'Space out loan applications by 3-6 months',
            'Use pre-approval checks that don\'t affect score'
          ] : [
            'Low enquiry activity - good for your score',
            'Continue being selective about new credit'
          ]
        }
      ];
    };

    const factors = calculateFactors();

    // Generate recommendations based on factors
    const generateRecommendations = () => {
      const recommendations: Array<{
        id: string;
        priority: 'high' | 'medium' | 'low';
        category: string;
        title: string;
        description: string;
        potential_impact: number;
        action_items: string[];
        timeframe: string;
      }> = [];

      // Credit Utilization recommendation
      if (creditUtilization > 30) {
        recommendations.push({
          id: 'rec-utilization',
          priority: creditUtilization > 50 ? 'high' : 'medium',
          category: 'utilization',
          title: 'Reduce Credit Card Utilization',
          description: `Your current utilization is ${creditUtilization}%. Reducing it to below 30% could improve your score significantly.`,
          potential_impact: creditUtilization > 50 ? 35 : 20,
          action_items: [
            'Pay down credit card balances',
            'Make multiple payments per month',
            'Request a credit limit increase'
          ],
          timeframe: '1-2 months'
        });
      }

      // Payment History recommendation
      const latePayments = factors.find(f => f.name === 'Payment History');
      if (latePayments && latePayments.score < 90) {
        recommendations.push({
          id: 'rec-payment',
          priority: latePayments.score < 70 ? 'high' : 'medium',
          category: 'payment',
          title: 'Improve Payment Consistency',
          description: 'Setting up automatic payments can help ensure you never miss a due date.',
          potential_impact: 90 - latePayments.score,
          action_items: [
            'Enable auto-pay for all accounts',
            'Set payment reminders 5 days before due date',
            'Clear any existing overdue amounts'
          ],
          timeframe: '3-6 months'
        });
      }

      // Credit Mix recommendation
      const creditMix = factors.find(f => f.name === 'Credit Mix');
      if (creditMix && creditMix.score < 75) {
        recommendations.push({
          id: 'rec-mix',
          priority: 'low',
          category: 'credit_mix',
          title: 'Diversify Credit Portfolio',
          description: 'Having a mix of secured and unsecured credit can improve your score.',
          potential_impact: 10,
          action_items: [
            'Consider a secured loan if you only have credit cards',
            'Add a credit card if you only have loans',
            'Only take credit you actually need'
          ],
          timeframe: '6-12 months'
        });
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    };

    const recommendations = generateRecommendations();

    // Generate alerts
    const alerts: Array<{
      id: string;
      type: 'warning' | 'info' | 'error';
      title: string;
      message: string;
      date: string;
      is_read: boolean;
      action_required: boolean;
    }> = [];

    if (creditUtilization > 50) {
      alerts.push({
        id: 'alert-utilization',
        type: 'warning',
        title: 'High Credit Utilization',
        message: `Your credit utilization is ${creditUtilization}%, which may negatively impact your score.`,
        date: new Date().toISOString(),
        is_read: false,
        action_required: true
      });
    }

    const overdueLoans = activeLoans.filter(l => (l.dpd_days || 0) > 0);
    if (overdueLoans.length > 0) {
      alerts.push({
        id: 'alert-overdue',
        type: 'error',
        title: 'Overdue Payments Detected',
        message: `You have ${overdueLoans.length} loan(s) with overdue payments. Please clear them immediately.`,
        date: new Date().toISOString(),
        is_read: false,
        action_required: true
      });
    }

    // Calculate score trend
    let scoreTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (fetchHistory.length >= 2) {
      const scores = fetchHistory.filter(h => h.credit_score).map(h => h.credit_score!);
      if (scores.length >= 2) {
        if (scores[0] > scores[1] + 10) scoreTrend = 'improving';
        else if (scores[0] < scores[1] - 10) scoreTrend = 'declining';
      }
    }

    // Calculate potential score
    const currentScore = metadata.credit_score || 700;
    const potentialImprovement = recommendations.reduce((sum, r) => sum + r.potential_impact, 0);
    const potentialScore = Math.min(900, currentScore + potentialImprovement);

    // Determine health status
    const getHealthStatus = (score: number) => {
      if (score >= 750) return 'Excellent';
      if (score >= 700) return 'Good';
      if (score >= 650) return 'Fair';
      if (score >= 550) return 'Poor';
      return 'Very Poor';
    };

    return NextResponse.json({
      success: true,
      data: {
        overall_score: currentScore,
        health_status: getHealthStatus(currentScore),
        last_updated: metadata.credit_score_updated_at,
        factors,
        recommendations,
        alerts,
        score_trend: scoreTrend,
        potential_score: potentialScore,
        potential_improvement: potentialImprovement,
        factor_weights: FACTOR_WEIGHTS
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/health', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers/credit-assessment/health/simulate
 *
 * Runs a score simulation based on provided actions.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bodySchema = z.object({


      scenarios: z.array(z.unknown()).optional().default([]),


      custom_utilization: z.string().optional(),


      custom_on_time_percentage: z.string().optional(),


      custom_enquiries: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr;
    const {
      scenarios = [],
      custom_utilization,
      custom_on_time_percentage,
      custom_enquiries
    } = body;

    // Get current credit data
    const metadata = await getCreditMetadata(user.id);
    const currentScore = metadata.credit_score || 700;

    // Calculate impact from selected scenarios
    let projectedChange = 0;

    const scenarioImpacts: Record<string, number> = {
      'pay_on_time_6m': 25,
      'reduce_utilization_30': 35,
      'reduce_utilization_10': 50,
      'no_new_credit_6m': 15,
      'close_unused_cards': -10,
      'clear_overdue': 40,
      'add_secured_loan': 20,
      'become_authorized_user': 15
    };

    scenarios.forEach((scenarioId: string) => {
      if (scenarioImpacts[scenarioId]) {
        projectedChange += scenarioImpacts[scenarioId];
      }
    });

    // Apply custom simulation adjustments
    if (custom_utilization !== undefined) {
      if (custom_utilization < 10) projectedChange += 25;
      else if (custom_utilization < 30) projectedChange += 15;
      else if (custom_utilization > 70) projectedChange -= 20;
    }

    if (custom_on_time_percentage !== undefined) {
      if (custom_on_time_percentage >= 98) projectedChange += 20;
      else if (custom_on_time_percentage >= 95) projectedChange += 10;
      else if (custom_on_time_percentage < 80) projectedChange -= 25;
    }

    if (custom_enquiries !== undefined) {
      if (custom_enquiries === 0) projectedChange += 10;
      else if (custom_enquiries > 5) projectedChange -= 15;
    }

    // Calculate projected score (capped at 300-900)
    const projectedScore = Math.min(900, Math.max(300, currentScore + projectedChange));

    return NextResponse.json({
      success: true,
      data: {
        current_score: currentScore,
        projected_score: projectedScore,
        score_change: projectedChange,
        confidence_level: 75,
        time_estimate: '3-6 months',
        warnings: projectedChange < 0
          ? ['Some selected actions may temporarily decrease your score']
          : []
      }
    });
  } catch (error) {
    apiLogger.error('Error in POST /api/customers/credit-assessment/health', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
