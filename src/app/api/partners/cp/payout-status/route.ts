import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logger } from '@/lib/utils/logger'


/**
 * GET /api/partners/cp/payout-status
 * Get all applications with payout status for the authenticated CP
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, sub_role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (userData.role !== 'PARTNER' || userData.sub_role !== 'CHANNEL_PARTNER') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only Channel Partners can access this resource.' },
        { status: 403 }
      )
    }

    // Get all applications for this CP
    const { data: applications, error: appError } = await supabase
      .from('cp_applications')
      .select(`
        id,
        app_id,
        cp_user_id,
        cp_partner_id,
        application_number,
        customer_name,
        customer_mobile,
        customer_email,
        loan_amount_disbursed,
        bank_name,
        loan_type,
        disbursement_date,
        expected_payout_percentage,
        expected_payout_amount,
        actual_payout_amount,
        notes,
        supporting_document_url,
        status,
        status_reason,
        accounts_verified_at,
        sa_approved_at,
        finance_processed_at,
        payment_transaction_id,
        payment_date,
        payment_amount,
        created_at,
        updated_at
      `)
      .eq('cp_user_id', user.id)
      .order('created_at', { ascending: false })

    if (appError) {
      logger.error('Error fetching CP applications:', { error: appError })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch applications' },
        { status: 500 }
      )
    }

    // Calculate stats
    const stats = {
      total_applications: applications?.length || 0,
      pending_count: applications?.filter(a => a.status === 'PENDING').length || 0,
      accounts_verification_count: applications?.filter(a => a.status === 'ACCOUNTS_VERIFICATION').length || 0,
      accounts_verified_count: applications?.filter(a => a.status === 'ACCOUNTS_VERIFIED').length || 0,
      sa_approved_count: applications?.filter(a => ['SA_APPROVED', 'APPROVED'].includes(a.status)).length || 0,
      finance_processing_count: applications?.filter(a => a.status === 'FINANCE_PROCESSING').length || 0,
      payout_credited_count: applications?.filter(a => ['PAYOUT_CREDITED', 'PAYOUT_PROCESSED'].includes(a.status)).length || 0,
      rejected_count: applications?.filter(a => a.status === 'REJECTED').length || 0,
      on_hold_count: applications?.filter(a => a.status === 'ON_HOLD').length || 0,
      total_loan_amount: applications?.reduce((sum, a) => sum + (a.loan_amount_disbursed || 0), 0) || 0,
      total_expected_payout: applications?.reduce((sum, a) => sum + (a.expected_payout_amount || 0), 0) || 0,
      total_credited_payout: applications
        ?.filter(a => ['PAYOUT_CREDITED', 'PAYOUT_PROCESSED'].includes(a.status))
        .reduce((sum, a) => sum + (a.actual_payout_amount || a.expected_payout_amount || 0), 0) || 0,
    }

    return NextResponse.json({
      success: true,
      applications: applications || [],
      stats,
    })
  } catch (error) {
    logger.error('Error in CP payout status API:', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
