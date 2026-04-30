
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    // Dynamically determine current financial year (April to March)
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1
    const defaultFY = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`
    const financialYear = searchParams.get('financial_year') || defaultFY

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '20', 10), 100)
    const offset = (page - 1) * pageSize
    const statusFilter = searchParams.get('status')

    let query = adminClient
      .from('fbp_declarations')
      .select(`*, employee_profile:employee_id ( first_name, last_name, employee_id )`, { count: 'exact' })
      .eq('financial_year', financialYear)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (statusFilter) query = query.eq('status', statusFilter)

    const { data, error, count } = await query

    if (error) throw error
    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { total: count || 0, page, page_size: pageSize, financial_year: financialYear }
    })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/benefits/fbp', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const body = await request.json()
    const { action, financial_year, id } = body

    if (action === 'lock_all') {
      if (!financial_year) return NextResponse.json({ success: false, error: 'Financial year required' }, { status: 400 })
      const { error } = await adminClient
        .from('fbp_declarations')
        .update({ status: 'locked', approved_by: user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('financial_year', financial_year)
        .eq('status', 'submitted')
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Declarations locked successfully' })
    }

    if (!id) return NextResponse.json({ success: false, error: 'Declaration ID required' }, { status: 400 })

    // Validate amounts are non-negative
    if (body.total_amount !== undefined) {
      const totalAmount = parseFloat(body.total_amount)
      if (isNaN(totalAmount) || totalAmount < 0) {
        return NextResponse.json({ success: false, error: 'Total amount must be a non-negative number' }, { status: 400 })
      }
    }

    // Validate component amounts if provided
    if (body.components && typeof body.components === 'object') {
      for (const [key, value] of Object.entries(body.components)) {
        if (typeof value === 'number' && value < 0) {
          return NextResponse.json({ success: false, error: `Component "${key}" amount cannot be negative` }, { status: 400 })
        }
      }

      // Validate total FBP doesn't exceed limit - fetch employee salary to check
      const { data: declaration } = await adminClient
        .from('fbp_declarations')
        .select('employee_id, financial_year')
        .eq('id', id)
        .maybeSingle()

      if (declaration) {
        const { data: salary } = await adminClient
          .from('employee_salary')
          .select('fbp_limit')
          .eq('user_id', declaration.employee_id)
          .eq('is_active', true)
          .maybeSingle()

        if (salary?.fbp_limit) {
          const componentTotal = Object.values(body.components).reduce(
            (sum: number, val: unknown) => sum + (typeof val === 'number' ? val : 0), 0
          ) as number
          if (componentTotal > salary.fbp_limit) {
            return NextResponse.json({
              success: false,
              error: `Total FBP components (${componentTotal}) exceed the allowed limit (${salary.fbp_limit})`
            }, { status: 400 })
          }
        }
      }
    }

    // Only allow safe fields - approved_by/approved_at are server-controlled, not client-provided
    const allowedFields = ['status', 'components', 'total_amount', 'remarks', 'rejection_reason']
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }
    // Validate status transitions
    const validStatuses = ['draft', 'submitted', 'approved', 'rejected', 'locked']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }
    // Server-controlled: set approved_by/at when status is approved
    if (body.status === 'approved') {
      updatePayload.approved_by = user.id
      updatePayload.approved_at = new Date().toISOString()
    }
    const { data, error } = await adminClient
      .from('fbp_declarations')
      .update(updatePayload)
      .eq('id', id)
      .select(`*, employee_profile:employee_id ( first_name, last_name, employee_id )`)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/benefits/fbp', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}