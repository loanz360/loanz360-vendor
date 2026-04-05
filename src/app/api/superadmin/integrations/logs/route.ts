import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Verify the request is from a super_admin user.
 */
async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: 'Unauthorized', status: 401 }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userError || userData?.role !== 'super_admin') {
    return { user: null, error: 'Forbidden', status: 403 }
  }

  return { user }
}

/** Sanitize search input */
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\(),.\"']/g, '')
}

/**
 * GET /api/superadmin/integrations/logs
 * Paginated list of integration logs with filters
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const providerId = searchParams.get('provider_id')
    const eventType = searchParams.get('event_type')
    const statusCodeMin = searchParams.get('status_code_min')
    const statusCodeMax = searchParams.get('status_code_max')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('integration_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (providerId) {
      query = query.eq('provider_id', providerId)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (statusCodeMin) {
      const min = parseInt(statusCodeMin)
      if (!isNaN(min)) {
        query = query.gte('status_code', min)
      }
    }

    if (statusCodeMax) {
      const max = parseInt(statusCodeMax)
      if (!isNaN(max)) {
        query = query.lte('status_code', max)
      }
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    if (search) {
      const sanitized = sanitizeSearch(search)
      if (sanitized.length > 0) {
        query = query.or(
          `endpoint.ilike.%${sanitized}%,event_type.ilike.%${sanitized}%,error_message.ilike.%${sanitized}%`
        )
      }
    }

    query = query.range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching integration logs', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch integration logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      meta: {
        total: count || 0,
        page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/integrations/logs', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
