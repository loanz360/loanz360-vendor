
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

/**
 * GET /api/notifications/recipients
 * Search and select individual users for notification targeting
 *
 * Query params:
 * - search: string (optional) - search by name or email
 * - role: string (optional) - filter by role (employee, partner, customer)
 * - subrole: string (optional) - filter by specific subrole
 * - state_id: UUID (optional) - filter by state
 * - city_id: UUID (optional) - filter by city
 * - branch_id: UUID (optional) - filter by branch
 * - limit: number (optional) - max results (default 50, max 100)
 *
 * Returns: Array of users with id, name, email, role, subrole, geography
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') // employee, partner, customer
    const subrole = searchParams.get('subrole')
    const stateId = searchParams.get('state_id')
    const cityId = searchParams.get('city_id')
    const branchId = searchParams.get('branch_id')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Get authenticated user to check permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's role to enforce permissions
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = userData?.role
    const userSubRole = userData?.sub_role

    // Build the response based on user's permissions
    let recipients: { id: string; name: string; email: string; role: string; subrole: string; [key: string]: unknown }[] = []

    // SUPER_ADMIN: Can search all users
    if (userRole === 'SUPER_ADMIN') {
      if (!role || role === 'employee') {
        const { data: employees } = await fetchEmployees(supabase, search, subrole, stateId, cityId, branchId, limit)
        recipients.push(...(employees || []))
      }
      if (!role || role === 'partner') {
        const { data: partners } = await fetchPartners(supabase, search, subrole, stateId, cityId, branchId, limit)
        recipients.push(...(partners || []))
      }
      if (!role || role === 'customer') {
        const { data: customers } = await fetchCustomers(supabase, search, subrole, limit)
        recipients.push(...(customers || []))
      }
    }
    // HR: Can only search employees
    else if (userRole === 'EMPLOYEE' && userSubRole === 'HR') {
      const { data: employees } = await fetchEmployees(supabase, search, subrole, stateId, cityId, branchId, limit)
      recipients = employees || []
    }
    // ACCOUNTS: Can only search partners
    else if (userRole === 'EMPLOYEE' && userSubRole === 'ACCOUNTS_MANAGER') {
      const { data: partners } = await fetchPartners(supabase, search, subrole, stateId, cityId, branchId, limit)
      recipients = partners || []
    }
    else {
      return NextResponse.json(
        { error: 'You do not have permission to search recipients' },
        { status: 403 }
      )
    }

    // Limit results
    const limitedRecipients = recipients.slice(0, limit)

    return NextResponse.json({
      success: true,
      count: limitedRecipients.length,
      recipients: limitedRecipients
    })
  } catch (error: unknown) {
    apiLogger.error('Error searching recipients', error)
    return NextResponse.json(
      { error: 'Failed to search recipients' },
      { status: 500 }
    )
  }
}

// Helper function to fetch employees
async function fetchEmployees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  search: string,
  subrole: string | null,
  stateId: string | null,
  cityId: string | null,
  branchId: string | null,
  limit: number
) {
  let query = supabase
    .from('employees')
    .select(`
      user_id,
      full_name,
      employee_id,
      sub_role,
      designation,
      avatar_url,
      state_id,
      city_id,
      branch_id,
      user:users!inner(email)
    `)
    .limit(limit)

  // Search filter
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%`)
  }

  // Subrole filter
  if (subrole) {
    query = query.eq('sub_role', subrole)
  }

  // Geography filters
  if (stateId) query = query.eq('state_id', stateId)
  if (cityId) query = query.eq('city_id', cityId)
  if (branchId) query = query.eq('branch_id', branchId)

  const { data, error } = await query

  if (error) {
    apiLogger.error('Error fetching employees', error)
    return { data: [] }
  }

  return {
    data: data?.map((emp: typeof data[number]) => ({
      id: emp.user_id,
      name: emp.full_name,
      email: emp.user?.email,
      role: 'employee',
      subrole: emp.sub_role,
      employee_id: emp.employee_id,
      designation: emp.designation,
      avatar_url: emp.avatar_url,
      state_id: emp.state_id,
      city_id: emp.city_id,
      branch_id: emp.branch_id
    })) || []
  }
}

// Helper function to fetch partners
async function fetchPartners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  search: string,
  subrole: string | null,
  stateId: string | null,
  cityId: string | null,
  branchId: string | null,
  limit: number
) {
  let query = supabase
    .from('partners')
    .select(`
      user_id,
      full_name,
      company_name,
      partner_type,
      state_id,
      city_id,
      branch_id,
      user:users!inner(email)
    `)
    .limit(limit)

  // Search filter
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%`)
  }

  // Partner type filter
  if (subrole) {
    query = query.eq('partner_type', subrole)
  }

  // Geography filters
  if (stateId) query = query.eq('state_id', stateId)
  if (cityId) query = query.eq('city_id', cityId)
  if (branchId) query = query.eq('branch_id', branchId)

  const { data, error } = await query

  if (error) {
    apiLogger.error('Error fetching partners', error)
    return { data: [] }
  }

  return {
    data: data?.map((partner: typeof data[number]) => ({
      id: partner.user_id,
      name: partner.full_name,
      email: partner.user?.email,
      role: 'partner',
      subrole: partner.partner_type,
      company_name: partner.company_name,
      state_id: partner.state_id,
      city_id: partner.city_id,
      branch_id: partner.branch_id
    })) || []
  }
}

// Helper function to fetch customers
async function fetchCustomers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  search: string,
  subrole: string | null,
  limit: number
) {
  let query = supabase
    .from('customers')
    .select(`
      user_id,
      full_name,
      customer_type,
      user:users!inner(email)
    `)
    .limit(limit)

  // Search filter
  if (search) {
    const safeSearch = sanitizeSearchInput(search)
    if (safeSearch) {
      query = query.ilike('full_name', `%${safeSearch}%`)
    }
  }

  // Customer type filter
  if (subrole) {
    query = query.eq('customer_type', subrole)
  }

  const { data, error } = await query

  if (error) {
    apiLogger.error('Error fetching customers', error)
    return { data: [] }
  }

  return {
    data: data?.map((customer: typeof data[number]) => ({
      id: customer.user_id,
      name: customer.full_name,
      email: customer.user?.email,
      role: 'customer',
      subrole: customer.customer_type
    })) || []
  }
}
