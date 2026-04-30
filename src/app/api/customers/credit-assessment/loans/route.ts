
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getCreditBureauLoans } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-assessment/loans
 *
 * Fetches all loan details with full payment history for the authenticated customer.
 * Payment history includes ALL months from loan inception (not limited to 24 months).
 */
export async function GET(request: NextRequest) {
  try {
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

    // Calculate portfolio summary
    const activeLoans = loans.filter(l => l.account_status === 'ACTIVE');
    const closedLoans = loans.filter(l => l.account_status === 'CLOSED');

    const portfolioSummary = {
      total_loans: loans.length,
      active_loans: activeLoans.length,
      closed_loans: closedLoans.length,
      total_sanctioned: loans.reduce((sum, l) => sum + (l.sanctioned_amount || 0), 0),
      total_outstanding: activeLoans.reduce((sum, l) => sum + (l.current_balance || 0), 0),
      total_overdue: activeLoans.reduce((sum, l) => sum + (l.overdue_amount || 0), 0),
      monthly_emi: activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0)
    };

    // Group loans by type
    const loansByType = loans.reduce((acc, loan) => {
      const type = loan.loan_type || 'OTHER';
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          total_outstanding: 0,
          total_sanctioned: 0
        };
      }
      acc[type].count++;
      acc[type].total_outstanding += loan.current_balance || 0;
      acc[type].total_sanctioned += loan.sanctioned_amount || 0;
      return acc;
    }, {} as Record<string, { count: number; total_outstanding: number; total_sanctioned: number }>);

    // Process each loan with full payment history
    const processedLoans = loans.map(loan => {
      // Calculate payment history statistics
      const paymentHistory = Array.isArray(loan.payment_history) ? loan.payment_history : [];

      // Group payment history by year for easier display
      const paymentsByYear = paymentHistory.reduce((acc, entry) => {
        const year = entry.year;
        if (!acc[year]) {
          acc[year] = [];
        }
        acc[year].push(entry);
        return acc;
      }, {} as Record<number, typeof paymentHistory>);

      // Calculate payment statistics
      const totalPayments = paymentHistory.length;
      const onTimePayments = paymentHistory.filter(p => p.dpd === 0).length;
      const latePayments = totalPayments - onTimePayments;
      const onTimePercentage = totalPayments > 0
        ? Math.round((onTimePayments / totalPayments) * 100)
        : 100;

      // Calculate DPD distribution
      const dpdDistribution = {
        '0': paymentHistory.filter(p => p.dpd === 0).length,
        '1-30': paymentHistory.filter(p => p.dpd > 0 && p.dpd <= 30).length,
        '31-60': paymentHistory.filter(p => p.dpd > 30 && p.dpd <= 60).length,
        '61-90': paymentHistory.filter(p => p.dpd > 60 && p.dpd <= 90).length,
        '90+': paymentHistory.filter(p => p.dpd > 90).length
      };

      // Calculate loan progress
      const sanctioned = loan.sanctioned_amount || 0;
      const outstanding = loan.current_balance || 0;
      const paidAmount = sanctioned - outstanding;
      const progressPercentage = sanctioned > 0
        ? Math.round((paidAmount / sanctioned) * 100)
        : 0;

      // Calculate tenure progress
      const tenureMonths = loan.tenure_months || 0;
      const elapsedMonths = paymentHistory.length;
      const remainingMonths = Math.max(0, tenureMonths - elapsedMonths);

      return {
        id: loan.id,
        bureau_name: loan.bureau_name,
        bureau_account_id: loan.bureau_account_id,
        lender_name: loan.lender_name,
        loan_type: loan.loan_type,
        account_number: loan.account_number,
        account_status: loan.account_status,
        // Amounts
        sanctioned_amount: loan.sanctioned_amount,
        current_balance: loan.current_balance,
        overdue_amount: loan.overdue_amount,
        emi_amount: loan.emi_amount,
        // Dates
        disbursement_date: loan.disbursement_date,
        last_payment_date: loan.last_payment_date,
        closure_date: loan.closure_date,
        // Loan terms
        tenure_months: loan.tenure_months,
        interest_rate: loan.interest_rate,
        dpd_days: loan.dpd_days,
        // Full payment history (NOT limited to 24 months)
        payment_history: paymentHistory,
        payments_by_year: paymentsByYear,
        // Payment statistics
        payment_stats: {
          total_payments: totalPayments,
          on_time_payments: onTimePayments,
          late_payments: latePayments,
          on_time_percentage: onTimePercentage,
          dpd_distribution: dpdDistribution
        },
        // Loan progress
        progress: {
          paid_amount: paidAmount,
          progress_percentage: progressPercentage,
          elapsed_months: elapsedMonths,
          remaining_months: remainingMonths,
          tenure_progress_percentage: tenureMonths > 0
            ? Math.round((elapsedMonths / tenureMonths) * 100)
            : 0
        },
        fetched_at: loan.fetched_at
      };
    });

    // Separate active and closed loans
    const activeLoanDetails = processedLoans.filter(l => l.account_status === 'ACTIVE');
    const closedLoanDetails = processedLoans.filter(l => l.account_status === 'CLOSED');

    return NextResponse.json({
      success: true,
      data: {
        portfolio_summary: portfolioSummary,
        loans_by_type: loansByType,
        active_loans: activeLoanDetails,
        closed_loans: closedLoanDetails,
        all_loans: processedLoans,
        loans: processedLoans // Alias for page compatibility
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/loans', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
