
/**
 * Loan Customers Management API
 * SuperAdmin endpoint for managing loan customers (remarketing database)
 *
 * GET  - Fetch loan customers with filters and statistics
 * POST - Add customer to loan database (typically done via loan system integration)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const querySchema = z.object({
  tab: z.enum(['all', 'active', 'closed', 'topup', 'newloan', 'npa']).optional(),
  search: z.string().optional(),
  income_category: z.string().optional(),
  lender: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
})

/**
 * GET /api/superadmin/customer-management/loan-customers
 * Fetch loan customers with filters and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      tab: searchParams.get('tab') || 'all',
      search: searchParams.get('search'),
      income_category: searchParams.get('income_category'),
      lender: searchParams.get('lender'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })

    // Build base query
    let query = supabaseAdmin
      .from('loan_customers')
      .select(`
        *,
        individuals!loan_customers_individual_id_fkey(
          id,
          first_name,
          last_name,
          mobile,
          email,
          income_category_id,
          income_profile_id
        )
      `, { count: 'exact' })

    // Apply tab filters
    switch (params.tab) {
      case 'active':
        query = query.eq('loan_status', 'ACTIVE')
        break
      case 'closed':
        query = query.eq('loan_status', 'CLOSED')
        break
      case 'topup':
        query = query.eq('is_topup_eligible', true)
        break
      case 'newloan':
        query = query.eq('is_new_loan_eligible', true)
        break
      case 'npa':
        query = query.eq('loan_status', 'NPA')
        break
    }

    // Apply search filter
    if (params.search) {
      query = query.or(`
        loan_account_number.ilike.%${params.search}%,
        lender_name.ilike.%${params.search}%
      `)
    }

    // Apply lender filter
    if (params.lender) {
      query = query.eq('lender_name', params.lender)
    }

    // Apply pagination
    const from = (params.page - 1) * params.limit
    const to = from + params.limit - 1
    query = query.range(from, to).order('disbursement_date', { ascending: false })

    const { data: customers, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching loan customers', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch loan customers' },
        { status: 500 }
      )
    }

    // Get statistics
    const { data: statsData } = await supabaseAdmin
      .from('loan_customers')
      .select('loan_status, is_topup_eligible, is_new_loan_eligible, disbursed_amount, outstanding_amount, interest_rate')

    const statistics = {
      total_loans: statsData?.length || 0,
      active_loans: statsData?.filter(l => l.loan_status === 'ACTIVE').length || 0,
      closed_loans: statsData?.filter(l => l.loan_status === 'CLOSED').length || 0,
      npa_count: statsData?.filter(l => l.loan_status === 'NPA').length || 0,
      topup_eligible: statsData?.filter(l => l.is_topup_eligible).length || 0,
      new_loan_eligible: statsData?.filter(l => l.is_new_loan_eligible).length || 0,
      total_disbursed: statsData?.reduce((sum, l) => sum + (Number(l.disbursed_amount) || 0), 0) || 0,
      total_outstanding: statsData?.reduce((sum, l) => sum + (Number(l.outstanding_amount) || 0), 0) || 0,
      avg_interest_rate: statsData?.length
        ? (statsData.reduce((sum, l) => sum + (Number(l.interest_rate) || 0), 0) / statsData.length).toFixed(2)
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: customers || [],
      pagination: {
        total: count || 0,
        page: params.page,
        limit: params.limit,
        total_pages: Math.ceil((count || 0) / params.limit),
      },
      statistics,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    apiLogger.error('Loan Customers GET error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/loan-customers
 * Add a loan customer record (typically from loan system integration)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('loan_customers')
      .insert(body)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating loan customer', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create loan customer record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Loan customer record created successfully',
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Loan Customers POST error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
