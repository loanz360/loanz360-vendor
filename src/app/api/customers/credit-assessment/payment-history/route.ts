
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCreditBureauLoans } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-assessment/payment-history
 *
 * Fetches complete payment history across all loans with DPD analysis.
 * Includes full history from loan inception (not limited to 24 months).
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

    // Get all credit bureau loans
    const loans = await getCreditBureauLoans(user.id);

    // Collect all payment history entries across all loans
    type PaymentEntry = {
      loan_id: string;
      lender_name: string;
      loan_type: string;
      month: number;
      year: number;
      status: string;
      dpd: number;
      amount_due?: number;
      amount_paid?: number;
      payment_date?: string;
      is_partial?: boolean;
    };

    const allPayments: PaymentEntry[] = [];

    loans.forEach(loan => {
      const history = Array.isArray(loan.payment_history) ? loan.payment_history : [];
      history.forEach(entry => {
        allPayments.push({
          loan_id: loan.id,
          lender_name: loan.lender_name,
          loan_type: loan.loan_type,
          month: entry.month,
          year: entry.year,
          status: entry.status,
          dpd: entry.dpd || 0,
          amount_due: entry.amount_due,
          amount_paid: entry.amount_paid,
          payment_date: entry.payment_date,
          is_partial: entry.is_partial
        });
      });
    });

    // Calculate overall payment health
    const totalPayments = allPayments.length;
    const onTimePayments = allPayments.filter(p => p.dpd === 0).length;
    const latePayments = totalPayments - onTimePayments;
    const onTimePercentage = totalPayments > 0
      ? Math.round((onTimePayments / totalPayments) * 100)
      : 100;

    // DPD distribution across all loans
    const dpdDistribution = {
      '0_dpd': allPayments.filter(p => p.dpd === 0).length,
      '1_30_dpd': allPayments.filter(p => p.dpd > 0 && p.dpd <= 30).length,
      '31_60_dpd': allPayments.filter(p => p.dpd > 30 && p.dpd <= 60).length,
      '61_90_dpd': allPayments.filter(p => p.dpd > 60 && p.dpd <= 90).length,
      '90_plus_dpd': allPayments.filter(p => p.dpd > 90).length
    };

    // Get unique years for filtering
    const years = [...new Set(allPayments.map(p => p.year))].sort((a, b) => b - a);

    // Group payments by year-month
    const paymentsByMonth: Record<string, PaymentEntry[]> = {};
    allPayments.forEach(payment => {
      const monthKey = `${payment.year}-${String(payment.month).padStart(2, '0')}`;
      if (!paymentsByMonth[monthKey]) {
        paymentsByMonth[monthKey] = [];
      }
      paymentsByMonth[monthKey].push(payment);
    });

    // Generate payment grid for each loan (for visualization)
    const loanPaymentGrids = loans.map(loan => {
      const history = Array.isArray(loan.payment_history) ? loan.payment_history : [];

      // Group by year
      const historyByYear: Record<number, Array<{
        month: number;
        status: string;
        dpd: number;
      }>> = {};

      history.forEach(entry => {
        if (!historyByYear[entry.year]) {
          historyByYear[entry.year] = [];
        }
        historyByYear[entry.year].push({
          month: entry.month,
          status: entry.status,
          dpd: entry.dpd || 0
        });
      });

      // Calculate loan-specific stats
      const totalLoanPayments = history.length;
      const onTimeLoanPayments = history.filter(p => (p.dpd || 0) === 0).length;

      return {
        loan_id: loan.id,
        lender_name: loan.lender_name,
        loan_type: loan.loan_type,
        account_number: loan.account_number,
        disbursement_date: loan.disbursement_date,
        account_status: loan.account_status,
        history_by_year: historyByYear,
        stats: {
          total_payments: totalLoanPayments,
          on_time_payments: onTimeLoanPayments,
          late_payments: totalLoanPayments - onTimeLoanPayments,
          on_time_percentage: totalLoanPayments > 0
            ? Math.round((onTimeLoanPayments / totalLoanPayments) * 100)
            : 100
        }
      };
    });

    // Generate monthly summary for trend analysis
    const monthlySummaries = Object.entries(paymentsByMonth)
      .map(([monthKey, payments]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const onTime = payments.filter(p => p.dpd === 0).length;
        const late = payments.length - onTime;

        return {
          month_key: monthKey,
          year,
          month,
          month_name: new Date(year, month - 1).toLocaleString('default', { month: 'short' }),
          total_payments: payments.length,
          on_time: onTime,
          late,
          on_time_percentage: payments.length > 0
            ? Math.round((onTime / payments.length) * 100)
            : 100,
          worst_dpd: Math.max(...payments.map(p => p.dpd), 0)
        };
      })
      .sort((a, b) => {
        // Sort by year desc, then month desc
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    // Format payment grid for page compatibility
    const paymentGrid = loanPaymentGrids.map(grid => ({
      loan_id: grid.loan_id,
      lender_name: grid.lender_name,
      loan_type: grid.loan_type,
      account_number: grid.account_number,
      months: Object.entries(grid.history_by_year).flatMap(([year, entries]) =>
        (entries as Array<{month: number; status: string; dpd: number}>).map(entry => ({
          year: Number(year),
          month: entry.month,
          status: entry.status,
          dpd: entry.dpd
        }))
      ).sort((a, b) => b.year - a.year || b.month - a.month)
    }));

    // DPD analysis for page compatibility
    const dpdAnalysis = {
      '0_dpd': { count: dpdDistribution['0_dpd'], label: 'On Time', color: 'green' },
      '1_30_dpd': { count: dpdDistribution['1_30_dpd'], label: '1-30 Days', color: 'yellow' },
      '31_60_dpd': { count: dpdDistribution['31_60_dpd'], label: '31-60 Days', color: 'orange' },
      '61_90_dpd': { count: dpdDistribution['61_90_dpd'], label: '61-90 Days', color: 'red' },
      '90_plus_dpd': { count: dpdDistribution['90_plus_dpd'], label: '90+ Days', color: 'darkred' }
    };

    return NextResponse.json({
      success: true,
      data: {
        overall_health: {
          total_payments: totalPayments,
          on_time_payments: onTimePayments,
          late_payments: latePayments,
          on_time_percentage: onTimePercentage,
          // Page compatibility fields
          on_time_count: onTimePayments,
          late_count: latePayments,
          missed_count: 0, // We track late payments, not missed separately
          health_rating: onTimePercentage >= 90 ? 'Excellent'
            : onTimePercentage >= 75 ? 'Good'
            : onTimePercentage >= 50 ? 'Fair'
            : 'Poor'
        },
        dpd_distribution: dpdDistribution,
        dpd_analysis: dpdAnalysis,
        available_years: years,
        loan_payment_grids: loanPaymentGrids,
        payment_grid: paymentGrid,
        monthly_summaries: monthlySummaries,
        all_payments: allPayments
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/payment-history', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
