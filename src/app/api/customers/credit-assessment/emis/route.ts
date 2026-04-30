
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getCreditBureauLoans } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-assessment/emis
 *
 * Fetches upcoming EMIs and generates a calendar view for the authenticated customer.
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
    const activeLoans = loans.filter(l => l.account_status === 'ACTIVE');

    // Generate upcoming EMIs for next 6 months
    const today = new Date();
    const sixMonthsLater = new Date(today);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const upcomingEmis: Array<{
      id: string;
      loan_id: string;
      lender_name: string;
      loan_type: string;
      account_number: string | null;
      emi_amount: number;
      due_date: string;
      due_day: number;
      month: number;
      year: number;
      status: 'upcoming' | 'due_today' | 'overdue' | 'paid';
      days_until_due: number;
    }> = [];

    activeLoans.forEach(loan => {
      if (!loan.emi_amount || loan.emi_amount <= 0) return;

      // Default EMI due day (typically 5th of each month, can be enhanced)
      const dueDay = 5;

      // Generate EMIs for next 6 months
      for (let i = 0; i < 6; i++) {
        const emiDate = new Date(today.getFullYear(), today.getMonth() + i, dueDay);

        // Skip if EMI date is in the past (except for current month overdue)
        if (emiDate < today && i > 0) continue;

        const daysUntilDue = Math.ceil((emiDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let status: 'upcoming' | 'due_today' | 'overdue' | 'paid' = 'upcoming';
        if (daysUntilDue < 0) {
          status = 'overdue';
        } else if (daysUntilDue === 0) {
          status = 'due_today';
        }

        // Check if already paid (if last payment date is in current month)
        if (loan.last_payment_date) {
          const lastPayment = new Date(loan.last_payment_date);
          if (lastPayment.getMonth() === emiDate.getMonth() &&
              lastPayment.getFullYear() === emiDate.getFullYear()) {
            status = 'paid';
          }
        }

        upcomingEmis.push({
          id: `${loan.id}-${emiDate.getFullYear()}-${emiDate.getMonth()}`,
          loan_id: loan.id,
          lender_name: loan.lender_name,
          loan_type: loan.loan_type,
          account_number: loan.account_number,
          emi_amount: loan.emi_amount,
          due_date: emiDate.toISOString(),
          due_day: dueDay,
          month: emiDate.getMonth() + 1,
          year: emiDate.getFullYear(),
          status,
          days_until_due: daysUntilDue
        });
      }
    });

    // Sort by due date
    upcomingEmis.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // Group by month for calendar view
    const emisByMonth: Record<string, typeof upcomingEmis> = {};
    upcomingEmis.forEach(emi => {
      const monthKey = `${emi.year}-${String(emi.month).padStart(2, '0')}`;
      if (!emisByMonth[monthKey]) {
        emisByMonth[monthKey] = [];
      }
      emisByMonth[monthKey].push(emi);
    });

    // Calculate monthly summaries
    const monthlySummaries = Object.entries(emisByMonth).map(([monthKey, emis]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        month_key: monthKey,
        month,
        year,
        month_name: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        total_emi: emis.reduce((sum, e) => sum + e.emi_amount, 0),
        emi_count: emis.length,
        overdue_count: emis.filter(e => e.status === 'overdue').length,
        paid_count: emis.filter(e => e.status === 'paid').length
      };
    });

    // Calculate summary stats
    const currentMonthEmis = upcomingEmis.filter(e => {
      const dueDate = new Date(e.due_date);
      return dueDate.getMonth() === today.getMonth() &&
             dueDate.getFullYear() === today.getFullYear();
    });

    const overdueEmis = upcomingEmis.filter(e => e.status === 'overdue');
    const nextDueEmi = upcomingEmis.find(e => e.status === 'upcoming' || e.status === 'due_today');

    const summary = {
      total_monthly_emi: activeLoans.reduce((sum, l) => sum + (l.emi_amount || 0), 0),
      active_loans_count: activeLoans.length,
      this_month_total: currentMonthEmis.reduce((sum, e) => sum + e.emi_amount, 0),
      this_month_count: currentMonthEmis.length,
      overdue_amount: overdueEmis.reduce((sum, e) => sum + e.emi_amount, 0),
      overdue_count: overdueEmis.length,
      next_due_date: nextDueEmi?.due_date || null,
      next_due_amount: nextDueEmi?.emi_amount || null,
      days_until_next_due: nextDueEmi?.days_until_due || null
    };

    // Format for page compatibility
    const currentMonthData = {
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      month_name: today.toLocaleString('default', { month: 'long' }),
      total_emi: summary.this_month_total,
      emi_count: summary.this_month_count,
      emis: currentMonthEmis
    };

    // Calendar data structure
    const calendarData = {
      month: today.getMonth() + 1,
      year: today.getFullYear(),
      days: Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, i) => {
        const day = i + 1;
        const dayEmis = upcomingEmis.filter(e => {
          const dueDate = new Date(e.due_date);
          return dueDate.getDate() === day &&
                 dueDate.getMonth() === today.getMonth() &&
                 dueDate.getFullYear() === today.getFullYear();
        });
        return {
          day,
          emis: dayEmis,
          total: dayEmis.reduce((sum, e) => sum + e.emi_amount, 0),
          has_emi: dayEmis.length > 0
        };
      })
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        upcoming_emis: upcomingEmis,
        emis_by_month: emisByMonth,
        monthly_summaries: monthlySummaries,
        current_month_emis: currentMonthEmis,
        overdue_emis: overdueEmis,
        // Page compatibility fields
        current_month: currentMonthData,
        upcoming_months: monthlySummaries,
        calendar: calendarData,
        total_upcoming_emi: summary.total_monthly_emi,
        overdue_total: summary.overdue_amount
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/emis', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
