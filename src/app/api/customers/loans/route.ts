
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getCreditBureauLoans,
  getCreditMetadata
} from '@/lib/credit-bureau/credit-bureau-service';
import type { Loanz360Loan, LoansApiResponse } from '@/lib/credit-bureau/types';
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/loans
 * Fetch all loans for the authenticated customer (Loanz360 + credit bureau)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch Loanz360 internal loans (from loan_applications table)
    const { data: loanz360LoansRaw, error: loansError } = await adminClient
      .from('loan_applications')
      .select(`
        id,
        application_number,
        loan_type,
        loan_purpose,
        requested_amount,
        approved_amount,
        tenure_months,
        interest_rate,
        emi_amount,
        status,
        disbursement_date,
        created_at
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    // If loan_applications doesn't exist or has no data, continue with empty array
    const loanz360Loans: Loanz360Loan[] = (loanz360LoansRaw || []).map(loan => ({
      id: loan.id,
      application_number: loan.application_number,
      loan_type: loan.loan_type,
      loan_purpose: loan.loan_purpose,
      requested_amount: loan.requested_amount,
      approved_amount: loan.approved_amount,
      tenure_months: loan.tenure_months,
      interest_rate: loan.interest_rate,
      emi_amount: loan.emi_amount,
      status: loan.status,
      disbursement_date: loan.disbursement_date,
      next_emi_date: null, // Would come from loan_accounts table
      outstanding_principal: null,
      paid_emis: null,
      total_emis: null,
      created_at: loan.created_at
    }));

    // Fetch credit bureau loans
    const bureauLoans = await getCreditBureauLoans(user.id);

    // Get credit metadata
    const creditMetadata = await getCreditMetadata(user.id);

    const response: LoansApiResponse = {
      success: true,
      data: {
        loanz360_loans: loanz360Loans,
        bureau_loans: bureauLoans,
        last_fetched_at: creditMetadata.last_bureau_fetch_at,
        credit_score: creditMetadata.credit_score,
        credit_score_updated_at: creditMetadata.credit_score_updated_at,
        next_refresh_allowed_at: creditMetadata.next_refresh_allowed_at
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    apiLogger.error('Error fetching loans', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
