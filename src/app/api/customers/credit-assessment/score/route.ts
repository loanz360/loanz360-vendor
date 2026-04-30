
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getCreditMetadata, getCreditBureauLoans } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-assessment/score
 *
 * Fetches credit scores from all available bureaus for the authenticated customer.
 * Returns multi-bureau scores, score factors, and trend history.
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

    const supabaseAdmin = createSupabaseAdmin();

    // Get credit metadata from customer profile
    const metadata = await getCreditMetadata(user.id);

    // Get loans to calculate additional metrics
    const loans = await getCreditBureauLoans(user.id);

    // Calculate metrics from loans
    const activeLoans = loans.filter(l => l.account_status === 'ACTIVE');
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.current_balance || 0), 0);
    const totalEMI = activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0);
    const totalSanctioned = loans.reduce((sum, l) => sum + (l.sanctioned_amount || 0), 0);
    const creditUtilization = totalSanctioned > 0
      ? Math.round((totalOutstanding / totalSanctioned) * 100)
      : 0;

    // Get score history from fetch logs
    const { data: scoreHistory } = await supabaseAdmin
      .from('credit_bureau_fetch_log')
      .select('credit_score, created_at, bureau_name')
      .eq('customer_id', user.id)
      .eq('fetch_status', 'SUCCESS')
      .not('credit_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12);

    // Group scores by bureau
    const bureauScores = new Map<string, number>();
    const bureauDates = new Map<string, string>();

    // Get latest score per bureau
    if (scoreHistory) {
      for (const entry of scoreHistory) {
        if (!bureauScores.has(entry.bureau_name)) {
          bureauScores.set(entry.bureau_name, entry.credit_score);
          bureauDates.set(entry.bureau_name, entry.created_at);
        }
      }
    }

    // Calculate score factors (simplified estimation)
    const calculateFactorScore = (loans: typeof activeLoans) => {
      // Payment History (35%) - based on DPD
      const overdueLoans = loans.filter(l => (l.dpd_days || 0) > 0);
      const paymentHistoryScore = loans.length > 0
        ? Math.round(((loans.length - overdueLoans.length) / loans.length) * 100)
        : 100;

      // Credit Utilization (30%)
      const utilizationScore = creditUtilization <= 30 ? 100
        : creditUtilization <= 50 ? 70
        : creditUtilization <= 70 ? 50
        : 30;

      // Credit Age (15%) - based on oldest loan
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
      const creditAgeScore = creditAgeYears >= 7 ? 100
        : creditAgeYears >= 5 ? 85
        : creditAgeYears >= 3 ? 70
        : creditAgeYears >= 1 ? 50
        : 30;

      // Credit Mix (10%) - variety of loan types
      const loanTypes = new Set(loans.map(l => l.loan_type));
      const creditMixScore = loanTypes.size >= 4 ? 100
        : loanTypes.size >= 3 ? 80
        : loanTypes.size >= 2 ? 60
        : 40;

      // Recent Enquiries (10%) - needs enquiry data
      // For now, estimate based on loan count in last 6 months
      const recentLoans = loans.filter(l => {
        if (!l.disbursement_date) return false;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return new Date(l.disbursement_date) > sixMonthsAgo;
      });
      const enquiryScore = recentLoans.length <= 1 ? 100
        : recentLoans.length <= 2 ? 80
        : recentLoans.length <= 4 ? 60
        : 40;

      return {
        payment_history: { score: paymentHistoryScore, weight: 35 },
        credit_utilization: { score: utilizationScore, weight: 30 },
        credit_age: { score: creditAgeScore, weight: 15 },
        credit_mix: { score: creditMixScore, weight: 10 },
        recent_enquiries: { score: enquiryScore, weight: 10 }
      };
    };

    const factors = calculateFactorScore(activeLoans);

    // Helper to get score rating
    const getScoreRating = (score: number | null): string => {
      if (!score) return 'NO_HISTORY';
      if (score >= 750) return 'EXCELLENT';
      if (score >= 700) return 'GOOD';
      if (score >= 650) return 'FAIR';
      if (score >= 550) return 'POOR';
      return 'VERY_POOR';
    };

    // Format bureau scores as CreditScore objects for page compatibility
    const allScores = Array.from(bureauScores.entries()).map(([bureau, score]) => ({
      score,
      bureau: bureau as 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF',
      rating: getScoreRating(score),
      fetched_at: bureauDates.get(bureau) || null,
      is_primary: bureau === 'CIBIL'
    }));

    // Primary score object (CIBIL or first available)
    const primaryBureau = bureauScores.has('CIBIL') ? 'CIBIL' : Array.from(bureauScores.keys())[0];
    const primaryScoreValue = metadata.credit_score || (primaryBureau ? bureauScores.get(primaryBureau) : null);
    const primaryScoreObj = primaryScoreValue ? {
      score: primaryScoreValue,
      bureau: (primaryBureau || 'CIBIL') as 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF',
      rating: getScoreRating(primaryScoreValue),
      fetched_at: metadata.credit_score_updated_at || null,
      is_primary: true
    } : null;

    // Calculate score trend
    let scoreTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (scoreHistory && scoreHistory.length >= 2) {
      const latestScore = scoreHistory[0].credit_score;
      const previousScore = scoreHistory[1].credit_score;
      if (latestScore > previousScore + 10) scoreTrend = 'improving';
      else if (latestScore < previousScore - 10) scoreTrend = 'declining';
    }

    // Format factors as ScoreFactor array for page compatibility
    const formattedFactors = [
      {
        name: 'Payment History',
        key: 'PAYMENT_HISTORY',
        score: factors.payment_history.score,
        max_score: 100,
        weight: factors.payment_history.weight,
        impact: factors.payment_history.score >= 70 ? 'POSITIVE' : factors.payment_history.score >= 40 ? 'NEUTRAL' : 'NEGATIVE',
        description: 'Your track record of paying bills on time'
      },
      {
        name: 'Credit Utilization',
        key: 'CREDIT_UTILIZATION',
        score: factors.credit_utilization.score,
        max_score: 100,
        weight: factors.credit_utilization.weight,
        impact: factors.credit_utilization.score >= 70 ? 'POSITIVE' : factors.credit_utilization.score >= 40 ? 'NEUTRAL' : 'NEGATIVE',
        description: 'Percentage of available credit being used'
      },
      {
        name: 'Credit Age',
        key: 'CREDIT_AGE',
        score: factors.credit_age.score,
        max_score: 100,
        weight: factors.credit_age.weight,
        impact: factors.credit_age.score >= 70 ? 'POSITIVE' : factors.credit_age.score >= 40 ? 'NEUTRAL' : 'NEGATIVE',
        description: 'Average age of your credit accounts'
      },
      {
        name: 'Credit Mix',
        key: 'CREDIT_MIX',
        score: factors.credit_mix.score,
        max_score: 100,
        weight: factors.credit_mix.weight,
        impact: factors.credit_mix.score >= 70 ? 'POSITIVE' : factors.credit_mix.score >= 40 ? 'NEUTRAL' : 'NEGATIVE',
        description: 'Variety of credit types in your portfolio'
      },
      {
        name: 'Recent Enquiries',
        key: 'RECENT_ENQUIRIES',
        score: factors.recent_enquiries.score,
        max_score: 100,
        weight: factors.recent_enquiries.weight,
        impact: factors.recent_enquiries.score >= 70 ? 'POSITIVE' : factors.recent_enquiries.score >= 40 ? 'NEUTRAL' : 'NEGATIVE',
        description: 'Number of recent credit applications'
      }
    ];

    return NextResponse.json({
      success: true,
      data: {
        primary_score: primaryScoreObj,
        all_scores: allScores,
        factors: formattedFactors,
        quick_stats: {
          totalAccounts: loans.length,
          activeAccounts: activeLoans.length,
          total_outstanding: totalOutstanding,
          totalOutstanding: totalOutstanding,
          monthly_emi: totalEMI,
          monthlyEmi: totalEMI,
          credit_utilization: creditUtilization,
          creditUtilization: creditUtilization
        },
        score_history: scoreHistory?.map(h => ({
          score: h.credit_score,
          bureau: h.bureau_name,
          recorded_at: h.created_at,
          date: h.created_at
        })) || [],
        score_trend: scoreTrend,
        last_fetched_at: metadata.credit_score_updated_at,
        last_updated: metadata.credit_score_updated_at,
        next_refresh_at: metadata.next_refresh_allowed_at
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/score', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
