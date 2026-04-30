/**
 * Credit Bureau Service
 * Core service for fetching and managing credit bureau data
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CreditBureauLoan,
  CreditBureauFetchLog,
  CreditBureauProviderConfig,
  CreditReport,
  FetchTrigger,
  BureauName,
  PaymentHistoryEntry
} from './types';
import { getProvider, createMockProviderConfig } from './providers';

const REFRESH_COOLDOWN_DAYS = 30; // Rate limit: once per 30 days

interface FetchResult {
  success: boolean;
  loans_count: number;
  credit_score: number | null;
  error?: string;
  next_refresh_allowed_at?: string;
}

/**
 * Get active credit bureau provider configuration
 */
async function getActiveProvider(): Promise<CreditBureauProviderConfig | null> {
  const adminClient = createAdminClient();

  // Try to fetch from cae_providers table
  const { data: providers, error } = await adminClient
    .from('cae_providers')
    .select('*')
    .eq('provider_type', 'CREDIT_BUREAU')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1);

  if (error || !providers || providers.length === 0) {
    // Return mock provider config if no real provider configured
    return createMockProviderConfig('CIBIL');
  }

  return providers[0] as CreditBureauProviderConfig;
}

/**
 * Check if customer can refresh credit data (30 day cooldown)
 */
async function canRefresh(
  customerId: string,
  force: boolean = false
): Promise<{ allowed: boolean; next_refresh_at: string | null }> {
  if (force) {
    return { allowed: true, next_refresh_at: null };
  }

  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('customer_profiles')
    .select('last_bureau_fetch_at')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!profile?.last_bureau_fetch_at) {
    return { allowed: true, next_refresh_at: null };
  }

  const lastFetch = new Date(profile.last_bureau_fetch_at);
  const nextAllowed = new Date(lastFetch);
  nextAllowed.setDate(nextAllowed.getDate() + REFRESH_COOLDOWN_DAYS);

  const now = new Date();
  if (now >= nextAllowed) {
    return { allowed: true, next_refresh_at: null };
  }

  return {
    allowed: false,
    next_refresh_at: nextAllowed.toISOString()
  };
}

/**
 * Get customer's PAN number from profile
 */
async function getCustomerPan(customerId: string): Promise<string | null> {
  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('customer_profiles')
    .select('pan_number')
    .eq('customer_id', customerId)
    .maybeSingle();

  return profile?.pan_number || null;
}

/**
 * Save credit bureau loans to database
 */
async function saveBureauLoans(
  customerId: string,
  panNumber: string,
  bureauName: BureauName,
  report: CreditReport
): Promise<void> {
  const adminClient = createAdminClient();

  // Prepare loan records
  const loanRecords = report.loans.map(loan => ({
    customer_id: customerId,
    pan_number: panNumber,
    bureau_name: bureauName,
    bureau_account_id: loan.bureau_account_id,
    lender_name: loan.lender_name,
    loan_type: loan.loan_type,
    account_number: loan.account_number || null,
    sanctioned_amount: loan.sanctioned_amount || null,
    current_balance: loan.current_balance || null,
    emi_amount: loan.emi_amount || null,
    tenure_months: loan.tenure_months || null,
    interest_rate: loan.interest_rate || null,
    disbursement_date: loan.disbursement_date || null,
    last_payment_date: loan.last_payment_date || null,
    closure_date: loan.closure_date || null,
    account_status: loan.account_status || 'ACTIVE',
    overdue_amount: loan.overdue_amount || 0,
    dpd_days: loan.dpd_days || 0,
    payment_history: loan.payment_history || [],
    fetched_at: new Date().toISOString(),
    raw_response: report.raw_response
  }));

  // Delete old records for this customer/bureau and insert new ones
  await adminClient
    .from('credit_bureau_loans')
    .delete()
    .eq('customer_id', customerId)
    .eq('bureau_name', bureauName);

  if (loanRecords.length > 0) {
    const { error } = await adminClient
      .from('credit_bureau_loans')
      .insert(loanRecords);

    if (error) {
      console.error('Error saving bureau loans:', error);
      throw new Error('Failed to save credit bureau loans');
    }
  }
}

/**
 * Log the fetch operation
 */
async function logFetchOperation(
  customerId: string,
  panNumber: string,
  bureauName: BureauName,
  triggeredBy: FetchTrigger,
  status: 'SUCCESS' | 'FAILED',
  loansCount: number,
  creditScore: number | null,
  errorMessage?: string,
  responseTimeMs?: number
): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient.from('credit_bureau_fetch_log').insert({
    customer_id: customerId,
    pan_number: panNumber,
    bureau_name: bureauName,
    fetch_status: status,
    error_message: errorMessage || null,
    loans_count: loansCount,
    credit_score: creditScore,
    request_id: `REQ-${Date.now()}`,
    response_time_ms: responseTimeMs || null,
    triggered_by: triggeredBy
  });
}

/**
 * Update customer profile with credit score and fetch timestamp
 */
async function updateCustomerProfile(
  customerId: string,
  creditScore: number
): Promise<void> {
  const adminClient = createAdminClient();

  await adminClient
    .from('customer_profiles')
    .update({
      credit_score: creditScore,
      credit_score_updated_at: new Date().toISOString(),
      last_bureau_fetch_at: new Date().toISOString(),
      bureau_fetch_count: adminClient.rpc('increment_bureau_fetch_count', {
        customer_id_param: customerId
      })
    })
    .eq('customer_id', customerId);

  // If RPC doesn't exist, just update without incrementing
  // We'll handle the increment separately
  const { error } = await adminClient
    .from('customer_profiles')
    .update({
      credit_score: creditScore,
      credit_score_updated_at: new Date().toISOString(),
      last_bureau_fetch_at: new Date().toISOString()
    })
    .eq('customer_id', customerId);

  if (error) {
    console.error('Error updating customer profile:', error);
  }
}

/**
 * Fetch credit data from bureau and store in database
 */
export async function fetchCreditBureauData(
  customerId: string,
  triggeredBy: FetchTrigger,
  force: boolean = false,
  panNumber?: string
): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    // Check rate limiting
    const { allowed, next_refresh_at } = await canRefresh(customerId, force);
    if (!allowed) {
      return {
        success: false,
        loans_count: 0,
        credit_score: null,
        error: `Refresh not allowed yet. Next refresh available on ${next_refresh_at}`,
        next_refresh_allowed_at: next_refresh_at || undefined
      };
    }

    // Get PAN number
    const pan = panNumber || await getCustomerPan(customerId);
    if (!pan) {
      return {
        success: false,
        loans_count: 0,
        credit_score: null,
        error: 'PAN number not found in customer profile'
      };
    }

    // Get active provider
    const providerConfig = await getActiveProvider();
    if (!providerConfig) {
      return {
        success: false,
        loans_count: 0,
        credit_score: null,
        error: 'No credit bureau provider configured'
      };
    }

    // Get provider instance
    const provider = getProvider(providerConfig);

    // Fetch credit report
    const report = await provider.fetchCreditReport(pan, providerConfig);
    const responseTime = Date.now() - startTime;

    // Save loans to database
    await saveBureauLoans(
      customerId,
      pan,
      providerConfig.provider_code as BureauName,
      report
    );

    // Update customer profile
    await updateCustomerProfile(customerId, report.credit_score);

    // Log the operation
    await logFetchOperation(
      customerId,
      pan,
      providerConfig.provider_code as BureauName,
      triggeredBy,
      'SUCCESS',
      report.loans.length,
      report.credit_score,
      undefined,
      responseTime
    );

    // Calculate next refresh date
    const nextRefresh = new Date();
    nextRefresh.setDate(nextRefresh.getDate() + REFRESH_COOLDOWN_DAYS);

    return {
      success: true,
      loans_count: report.loans.length,
      credit_score: report.credit_score,
      next_refresh_allowed_at: nextRefresh.toISOString()
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log the failed operation
    const pan = panNumber || await getCustomerPan(customerId);
    if (pan) {
      await logFetchOperation(
        customerId,
        pan,
        'CIBIL', // Default bureau for error logging
        triggeredBy,
        'FAILED',
        0,
        null,
        errorMessage,
        responseTime
      );
    }

    return {
      success: false,
      loans_count: 0,
      credit_score: null,
      error: errorMessage
    };
  }
}

/**
 * Get all credit bureau loans for a customer
 */
export async function getCreditBureauLoans(
  customerId: string
): Promise<CreditBureauLoan[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('credit_bureau_loans')
    .select('*')
    .eq('customer_id', customerId)
    .order('account_status', { ascending: true })
    .order('current_balance', { ascending: false });

  if (error) {
    console.error('Error fetching bureau loans:', error);
    return [];
  }

  return (data || []) as CreditBureauLoan[];
}

/**
 * Get credit bureau fetch history for a customer
 */
export async function getFetchHistory(
  customerId: string,
  limit: number = 10
): Promise<CreditBureauFetchLog[]> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('credit_bureau_fetch_log')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return (data || []) as CreditBureauFetchLog[];
}

/**
 * Get customer credit metadata
 */
export async function getCreditMetadata(customerId: string): Promise<{
  credit_score: number | null;
  credit_score_updated_at: string | null;
  last_bureau_fetch_at: string | null;
  bureau_fetch_count: number;
  next_refresh_allowed_at: string | null;
}> {
  const adminClient = createAdminClient();

  const { data: profile } = await adminClient
    .from('customer_profiles')
    .select('credit_score, credit_score_updated_at, last_bureau_fetch_at, bureau_fetch_count')
    .eq('customer_id', customerId)
    .maybeSingle();

  let nextRefreshAt: string | null = null;
  if (profile?.last_bureau_fetch_at) {
    const lastFetch = new Date(profile.last_bureau_fetch_at);
    const nextAllowed = new Date(lastFetch);
    nextAllowed.setDate(nextAllowed.getDate() + REFRESH_COOLDOWN_DAYS);

    if (new Date() < nextAllowed) {
      nextRefreshAt = nextAllowed.toISOString();
    }
  }

  return {
    credit_score: profile?.credit_score || null,
    credit_score_updated_at: profile?.credit_score_updated_at || null,
    last_bureau_fetch_at: profile?.last_bureau_fetch_at || null,
    bureau_fetch_count: profile?.bureau_fetch_count || 0,
    next_refresh_allowed_at: nextRefreshAt
  };
}
