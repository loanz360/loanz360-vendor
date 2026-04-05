import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/loan-products
 * Fetch loan products for Bank Product Matrix and Eligibility Checker
 *
 * Query params:
 *   - active_only: boolean (default true)
 *   - loan_type: string (filter by type)
 *   - bank_name: string (filter by bank)
 *   - search: string (search bank/product name)
 *   - featured: boolean (only featured products)
 *   - sort_by: string (bank_name, min_interest_rate, max_amount, display_order)
 *   - sort_order: 'asc' | 'desc'
 *   - page: number
 *   - limit: number (default 100)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') !== 'false'
    const loanType = searchParams.get('loan_type')
    const bankName = searchParams.get('bank_name')
    const search = searchParams.get('search')
    const featured = searchParams.get('featured') === 'true'
    const sortBy = searchParams.get('sort_by') || 'display_order'
    const sortOrder = searchParams.get('sort_order') === 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('loan_products')
      .select('*', { count: 'exact' })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    if (bankName) {
      query = query.ilike('bank_name', `%${bankName}%`)
    }

    if (search) {
      query = query.or(`bank_name.ilike.%${search}%,name.ilike.%${search}%,loan_type.ilike.%${search}%`)
    }

    if (featured) {
      query = query.eq('featured', true)
    }

    // Validate sort column
    const validSortColumns = ['bank_name', 'min_interest_rate', 'max_amount', 'display_order', 'name', 'loan_type', 'min_income', 'min_cibil']
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'display_order'

    query = query
      .order(safeSortBy, { ascending: !sortOrder })
      .range(offset, offset + limit - 1)

    const { data: products, error, count } = await query

    if (error) {
      apiLogger.error('Failed to fetch loan products:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch loan products' }, { status: 500 })
    }

    // Get distinct loan types for filter dropdown
    const { data: typeData } = await supabase
      .from('loan_products')
      .select('loan_type')
      .eq('is_active', true)

    const loanTypes = [...new Set((typeData || []).map(t => t.loan_type))].sort()

    // Get distinct banks for filter dropdown
    const { data: bankData } = await supabase
      .from('loan_products')
      .select('bank_name')
      .eq('is_active', true)

    const banks = [...new Set((bankData || []).map(b => b.bank_name))].sort()

    return NextResponse.json({
      success: true,
      data: products || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        loanTypes,
        banks,
      },
    })
  } catch (error) {
    apiLogger.error('Loan products API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
