import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

// Enum validation constants
const VALID_CUSTOMER_CATEGORIES = [
  'INDIVIDUAL', 'SALARIED', 'PROPRIETOR', 'PARTNERSHIP',
  'PRIVATE_LIMITED_COMPANY', 'PUBLIC_LIMITED_COMPANY', 'LLP', 'HUF',
  'DOCTOR', 'LAWYER', 'PURE_RENTAL', 'AGRICULTURE', 'NRI',
  'CHARTERED_ACCOUNTANT', 'COMPANY_SECRETARY'
]

const VALID_USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']
const VALID_KYC_STATUSES = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED']

/**
 * GET /api/superadmin/customer-management/customers
 * Fetch paginated list of customers with filters and search
 *
 * Rate Limit: 60 requests per minute
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search by name or email
 * - category: Customer category filter
 * - status: User status filter
 * - kyc_status: KYC status filter
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  return readRateLimiter(request, async (req) => {
    return await getCustomersHandler(req)
  })
}

async function getCustomersHandler(request: NextRequest) {
  try {
    // Use unified auth to support both Supabase Auth and Super Admin sessions
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Validate and sanitize pagination parameters
    let page = parseInt(searchParams.get('page') || '1')
    let limit = parseInt(searchParams.get('limit') || '20')

    // Enforce bounds to prevent DoS attacks
    if (isNaN(page) || page < 1) page = 1
    if (isNaN(limit) || limit < 1) limit = 20
    if (limit > 100) limit = 100 // Maximum 100 items per page

    // Sanitize search input to prevent SQL injection
    const rawSearch = searchParams.get('search') || ''
    const search = rawSearch.replace(/[%_'";\\\[\]{}()]/g, '')

    // Validate enum filters
    const categoryFilter = searchParams.get('category') || ''
    const statusFilter = searchParams.get('status') || ''
    const kycFilter = searchParams.get('kyc_status') || ''

    // Validate category filter
    if (categoryFilter && !VALID_CUSTOMER_CATEGORIES.includes(categoryFilter)) {
      return NextResponse.json({
        success: false,
        error: `Invalid category. Must be one of: ${VALID_CUSTOMER_CATEGORIES.join(', ')}`
      }, { status: 400 })
    }

    // Validate status filter
    if (statusFilter && !VALID_USER_STATUSES.includes(statusFilter)) {
      return NextResponse.json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_USER_STATUSES.join(', ')}`
      }, { status: 400 })
    }

    // Validate KYC status filter
    if (kycFilter && !VALID_KYC_STATUSES.includes(kycFilter)) {
      return NextResponse.json({
        success: false,
        error: `Invalid KYC status. Must be one of: ${VALID_KYC_STATUSES.join(', ')}`
      }, { status: 400 })
    }

    // Use admin client for database queries
    const supabase = createSupabaseAdmin()

    // Calculate pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Build optimized query with JOIN to fetch related data in single query
    let query = supabase
      .from('customers')
      .select(`
        *,
        users!inner(id, email, full_name, sub_role, status, created_at, last_login),
        loan_applications(customer_id, application_status, loan_amount),
        customer_activities(customer_id, activity_type, activity_title, created_at)
      `, { count: 'exact' })

    // Apply search filter with sanitized input
    if (search) {
      query = query.or(`users.full_name.ilike.%${search}%,users.email.ilike.%${search}%`)
    }

    // Apply category filter
    if (categoryFilter) {
      query = query.eq('users.sub_role', categoryFilter)
    }

    // Apply status filter
    if (statusFilter) {
      query = query.eq('users.status', statusFilter)
    }

    // Apply KYC filter
    if (kycFilter) {
      query = query.eq('kyc_status', kycFilter)
    }

    // Apply pagination and ordering
    query = query
      .range(from, to)
      .order('created_at', { ascending: false })

    const { data: customersData, error: customersError, count } = await query

    if (customersError) {
      apiLogger.error('Error fetching customers', customersError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch customers'
      }, { status: 500 })
    }

    const customers = customersData || []

    // Process customer data with improved performance (avoid N+1)
    const enrichedCustomers = customers.map((customer: any) => {
      const customerLoans = customer.loan_applications || []
      const customerActivities = customer.customer_activities || []

      return {
        id: customer.id,
        user_id: customer.user_id,
        name: customer.users?.full_name || 'N/A',
        email: customer.users?.email || 'N/A',
        sub_role: customer.users?.sub_role || 'INDIVIDUAL',
        status: customer.users?.status || 'PENDING_VERIFICATION',
        kyc_status: customer.kyc_status || 'PENDING',
        credit_score: customer.credit_score || null,
        created_at: customer.created_at,
        last_login: customer.users?.last_login || null,
        loan_applications: {
          total: customerLoans.length,
          active: customerLoans.filter((l: any) =>
            ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(l.application_status)
          ).length,
          approved: customerLoans.filter((l: any) =>
            l.application_status === 'APPROVED'
          ).length,
          disbursed: customerLoans.filter((l: any) =>
            l.application_status === 'DISBURSED'
          ).length,
          total_amount: customerLoans.reduce((sum: number, l: any) =>
            sum + (parseFloat(l.loan_amount) || 0), 0
          ),
        },
        recent_activities: customerActivities
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((a: any) => ({
            activity_type: a.activity_type,
            activity_title: a.activity_title,
            created_at: a.created_at,
          })),
        activity_count: customerActivities.length,
      }
    })

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      customers: enrichedCustomers,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      },
    }, { status: 200 })

  } catch (error) {
    apiLogger.error('Error in customers list API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
