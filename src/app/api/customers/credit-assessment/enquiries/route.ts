export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server';
import { getCreditBureauLoans, getFetchHistory } from '@/lib/credit-bureau/credit-bureau-service';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/credit-assessment/enquiries
 *
 * Fetches credit enquiries from all bureaus for the authenticated customer.
 * Includes hard and soft enquiries with impact analysis.
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

    const supabaseAdmin = createSupabaseAdmin();

    // Get fetch history for enquiry tracking
    const fetchHistory = await getFetchHistory(user.id, 100);

    // Get loans to estimate enquiries from loan applications
    const loans = await getCreditBureauLoans(user.id);

    // Get enquiries from credit_bureau_enquiries table if it exists
    // For now, we'll estimate enquiries from loan disbursement dates
    type Enquiry = {
      id: string;
      date: string;
      institution: string;
      enquiry_type: 'hard' | 'soft';
      purpose: string;
      bureau: string;
      status: 'approved' | 'rejected' | 'pending' | 'unknown';
      amount_applied?: number;
      impact_score?: number;
    };

    const enquiries: Enquiry[] = [];

    // Generate hard enquiries from loan applications
    loans.forEach((loan, index) => {
      if (loan.disbursement_date) {
        // Assume enquiry happened ~7 days before disbursement
        const enquiryDate = new Date(loan.disbursement_date);
        enquiryDate.setDate(enquiryDate.getDate() - 7);

        enquiries.push({
          id: `enq-${loan.id}`,
          date: enquiryDate.toISOString(),
          institution: loan.lender_name,
          enquiry_type: 'hard',
          purpose: `${loan.loan_type} Application`,
          bureau: loan.bureau_name,
          status: loan.account_status === 'CLOSED' || loan.account_status === 'ACTIVE' ? 'approved' : 'unknown',
          amount_applied: loan.sanctioned_amount,
          impact_score: -5 // Hard enquiries typically impact score by -5 to -10
        });
      }
    });

    // Add soft enquiries from bureau fetch logs (self-checks don't impact score)
    fetchHistory.forEach((fetch, index) => {
      if (fetch.triggered_by === 'CUSTOMER_REQUEST' || fetch.triggered_by === 'CUSTOMER_PORTAL') {
        enquiries.push({
          id: `soft-${fetch.id}`,
          date: fetch.created_at,
          institution: 'Self (Credit Check)',
          enquiry_type: 'soft',
          purpose: 'Personal Credit Check',
          bureau: fetch.bureau_name,
          status: fetch.fetch_status === 'SUCCESS' ? 'approved' : 'rejected',
          impact_score: 0 // Soft enquiries don't impact score
        });
      }
    });

    // Sort by date descending
    enquiries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate summary statistics
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const hardEnquiries = enquiries.filter(e => e.enquiry_type === 'hard');
    const softEnquiries = enquiries.filter(e => e.enquiry_type === 'soft');

    const recentHardEnquiries = hardEnquiries.filter(e =>
      new Date(e.date) >= sixMonthsAgo
    );

    const lastYearHardEnquiries = hardEnquiries.filter(e =>
      new Date(e.date) >= oneYearAgo
    );

    const approvedEnquiries = hardEnquiries.filter(e => e.status === 'approved');
    const rejectedEnquiries = hardEnquiries.filter(e => e.status === 'rejected');

    // Estimate total impact from recent hard enquiries
    const estimatedImpact = recentHardEnquiries.reduce(
      (sum, e) => sum + (e.impact_score || 0),
      0
    );

    // Group enquiries by institution
    const enquiriesByInstitution: Record<string, number> = {};
    hardEnquiries.forEach(e => {
      enquiriesByInstitution[e.institution] = (enquiriesByInstitution[e.institution] || 0) + 1;
    });

    // Group by month for trend analysis
    const enquiriesByMonth: Record<string, { hard: number; soft: number }> = {};
    enquiries.forEach(e => {
      const date = new Date(e.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!enquiriesByMonth[monthKey]) {
        enquiriesByMonth[monthKey] = { hard: 0, soft: 0 };
      }
      if (e.enquiry_type === 'hard') {
        enquiriesByMonth[monthKey].hard++;
      } else {
        enquiriesByMonth[monthKey].soft++;
      }
    });

    // Assessment based on enquiry count
    let enquiryAssessment: string;
    let assessmentColor: string;
    if (recentHardEnquiries.length <= 2) {
      enquiryAssessment = 'Low enquiry activity - Positive for credit score';
      assessmentColor = 'green';
    } else if (recentHardEnquiries.length <= 4) {
      enquiryAssessment = 'Moderate enquiry activity - Monitor future applications';
      assessmentColor = 'yellow';
    } else {
      enquiryAssessment = 'High enquiry activity - May negatively impact credit score';
      assessmentColor = 'red';
    }

    return NextResponse.json({
      success: true,
      data: {
        // Summary fields at root level for page compatibility
        total_enquiries: enquiries.length,
        hard_enquiries: hardEnquiries.length,
        soft_enquiries: softEnquiries.length,
        enquiries_last_6_months: recentHardEnquiries.length,
        recent_hard_enquiries_6m: recentHardEnquiries.length,
        last_year_hard_enquiries: lastYearHardEnquiries.length,
        approved: approvedEnquiries.length,
        rejected: rejectedEnquiries.length,
        estimated_total_impact: estimatedImpact,
        estimated_score_impact: estimatedImpact,
        approval_rate: hardEnquiries.length > 0
          ? Math.round((approvedEnquiries.length / hardEnquiries.length) * 100)
          : 100,
        // Nested summary for alternative access
        summary: {
          total_enquiries: enquiries.length,
          hard_enquiries: hardEnquiries.length,
          soft_enquiries: softEnquiries.length,
          recent_hard_enquiries_6m: recentHardEnquiries.length,
          last_year_hard_enquiries: lastYearHardEnquiries.length,
          approved: approvedEnquiries.length,
          rejected: rejectedEnquiries.length,
          estimated_score_impact: estimatedImpact,
          approval_rate: hardEnquiries.length > 0
            ? Math.round((approvedEnquiries.length / hardEnquiries.length) * 100)
            : 100
        },
        assessment: {
          message: enquiryAssessment,
          color: assessmentColor,
          recommendation: recentHardEnquiries.length > 4
            ? 'Consider spacing out your credit applications to minimize impact on your score.'
            : 'Your enquiry activity is within healthy limits.'
        },
        enquiries,
        hard_enquiries: hardEnquiries,
        soft_enquiries: softEnquiries,
        enquiries_by_institution: enquiriesByInstitution,
        enquiries_by_month: enquiriesByMonth
      }
    });
  } catch (error) {
    apiLogger.error('Error in GET /api/customers/credit-assessment/enquiries', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
