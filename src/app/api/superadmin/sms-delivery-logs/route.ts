
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/sms-delivery-logs
 * Fetch SMS delivery logs with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const templateCode = searchParams.get('templateCode')
    const recipient = searchParams.get('recipient')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('communication_delivery_log')
      .select('*', { count: 'exact' })
      .eq('message_type', 'sms')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (templateCode) {
      query = query.eq('template_code', templateCode)
    }

    if (recipient) {
      query = query.ilike('recipient_identifier', `%${recipient}%`)
    }

    if (from) {
      query = query.gte('created_at', from)
    }

    if (to) {
      query = query.lte('created_at', to)
    }

    const { data: logs, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching SMS delivery logs', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    apiLogger.error('SMS delivery logs API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
