import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/** Sanitize search input to prevent PostgREST filter injection (BUG-05) */
function sanitizeSearch(input: string): string {
  return input.replace(/[(),."\\]/g, '').trim().substring(0, 100)
}

/**
 * GET /api/employees/accounting/overview
 * Returns payout ledger data for CP, BA, and BP tabs
 * Supports date range filtering, search, pagination
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tab = searchParams.get('tab') || 'cp'
    const status = searchParams.get('status') || 'ALL'
    const rawSearch = searchParams.get('search')
    const search = rawSearch ? sanitizeSearch(rawSearch) : null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const allowedRoles = ['SUPER_ADMIN']
    const allowedSubRoles = ['ACCOUNTS_EXECUTIVE', 'ACCOUNTS_MANAGER', 'FINANCE_MANAGER', 'FINANCE_EXECUTIVE']

    if (!allowedRoles.includes(userData.role) &&
        !(userData.role === 'EMPLOYEE' && allowedSubRoles.includes(userData.sub_role))) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    if (tab === 'cp') {
      // CP Payout Ledger
      let query = supabase
        .from('cp_applications')
        .select(`
          id, app_id, application_number, customer_name, bank_name, loan_type,
          loan_amount_disbursed, expected_payout_amount, expected_payout_percentage,
          status, status_reason, disbursement_date, created_at, updated_at,
          accounts_verified_at,
          cp_user:users!cp_applications_cp_user_id_fkey (full_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      if (status !== 'ALL') {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(`app_id.ilike.%${search}%,customer_name.ilike.%${search}%,bank_name.ilike.%${search}%`)
      }

      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00+05:30`)
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59+05:30`)

      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        logger.error('Error fetching CP ledger:', { error })
        return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 })
      }

      // Summary stats (BUG-18 fix: correct labels)
      const [pendingSum, verifiedSum, paidSum] = await Promise.all([
        supabase.from('cp_applications').select('expected_payout_amount').in('status', ['PENDING', 'UNDER_REVIEW', 'ACCOUNTS_VERIFICATION']),
        supabase.from('cp_applications').select('expected_payout_amount').in('status', ['ACCOUNTS_VERIFIED', 'SA_APPROVED']),
        supabase.from('cp_applications').select('expected_payout_amount').eq('status', 'PAYOUT_CREDITED'),
      ])

      const summary = {
        pending_amount: pendingSum.data?.reduce((s, r) => s + (r.expected_payout_amount || 0), 0) || 0,
        verified_amount: verifiedSum.data?.reduce((s, r) => s + (r.expected_payout_amount || 0), 0) || 0,
        paid_amount: paidSum.data?.reduce((s, r) => s + (r.expected_payout_amount || 0), 0) || 0,
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        summary,
        pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      })
    } else {
      // BA or BP Commission Ledger
      const sourceType = tab === 'ba' ? 'ULAP_BA' : 'ULAP_BP'

      let query = supabase
        .from('leads')
        .select(`
          id, lead_number, source_partner_name, source_partner_code,
          customer_name, sanctioned_bank, loan_type,
          disbursed_amount, commission_amount, commission_status, commission_paid_at,
          disbursed_at, created_at, updated_at
        `, { count: 'exact' })
        .eq('source_type', sourceType)
        .eq('commission_eligible', true)
        .eq('lead_status', 'DISBURSED')
        .order('disbursed_at', { ascending: false, nullsFirst: false })

      if (status !== 'ALL') {
        query = query.eq('commission_status', status)
      }

      if (search) {
        query = query.or(`lead_number.ilike.%${search}%,customer_name.ilike.%${search}%,source_partner_name.ilike.%${search}%`)
      }

      if (dateFrom) query = query.gte('disbursed_at', `${dateFrom}T00:00:00+05:30`)
      if (dateTo) query = query.lte('disbursed_at', `${dateTo}T23:59:59+05:30`)

      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        logger.error(`Error fetching ${tab.toUpperCase()} ledger:`, { error })
        return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 })
      }

      // Summary
      const [pendingSum, approvedSum, paidSum] = await Promise.all([
        supabase.from('leads').select('commission_amount').eq('source_type', sourceType).eq('commission_eligible', true).eq('commission_status', 'PENDING'),
        supabase.from('leads').select('commission_amount').eq('source_type', sourceType).eq('commission_eligible', true).eq('commission_status', 'APPROVED'),
        supabase.from('leads').select('commission_amount').eq('source_type', sourceType).eq('commission_eligible', true).eq('commission_status', 'PAID'),
      ])

      const summary = {
        pending_amount: pendingSum.data?.reduce((s, r) => s + (r.commission_amount || 0), 0) || 0,
        verified_amount: approvedSum.data?.reduce((s, r) => s + (r.commission_amount || 0), 0) || 0,
        paid_amount: paidSum.data?.reduce((s, r) => s + (r.commission_amount || 0), 0) || 0,
      }

      return NextResponse.json({
        success: true,
        data: data || [],
        summary,
        pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      })
    }
  } catch (error) {
    logger.error('Error in accounting overview API:', { error })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
