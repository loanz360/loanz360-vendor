import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Verify user is TeleSales
 */
async function verifyTeleSalesUser(supabase: unknown, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  const isTeleSales = profile?.subrole?.toUpperCase().replace(/[\s-]/g, '_') === 'TELE_SALES'

  if (!isTeleSales) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', userId)
      .maybeSingle()

    const normalizedSubRole = userProfile?.sub_role?.toUpperCase().replace(/[\s-]/g, '_')
    return normalizedSubRole === 'TELE_SALES'
  }

  return true
}

/**
 * GET /api/employees/tele-sales/schedule/leads
 * Retrieves leads assigned to the TeleSales executive for scheduling calls
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const leadStage = searchParams.get('lead_stage')
    const loanType = searchParams.get('loan_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('online_leads')
      .select(`
        id,
        customer_name,
        mobile,
        email,
        lead_stage,
        lead_source,
        loan_type,
        loan_amount,
        city,
        state,
        created_at
      `, { count: 'exact' })
      .eq('assigned_to', user.id)
      .not('lead_stage', 'eq', 'CONVERTED')
      .not('lead_stage', 'eq', 'LOST')
      .not('lead_stage', 'eq', 'DO_NOT_CALL')

    // Apply search filter
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Apply lead stage filter
    if (leadStage) {
      query = query.eq('lead_stage', leadStage)
    }

    // Apply loan type filter
    if (loanType) {
      query = query.eq('loan_type', loanType)
    }

    // Order by most recent first
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: leads, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: leads || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales leads', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
