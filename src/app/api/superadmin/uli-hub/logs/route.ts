/**
 * API Route: ULI API Logs
 * GET /api/superadmin/uli-hub/logs — Paginated, filterable API call history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category')
    const service_code = searchParams.get('service_code')
    const environment = searchParams.get('environment')
    const is_success = searchParams.get('is_success')
    const from_date = searchParams.get('from')
    const to_date = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const supabase = createAdminClient()

    let query = supabase
      .from('uli_api_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) query = query.eq('category', category)
    if (service_code) query = query.eq('service_code', service_code)
    if (environment) query = query.eq('environment', environment)
    if (is_success === 'true') query = query.eq('is_success', true)
    if (is_success === 'false') query = query.eq('is_success', false)
    if (from_date) query = query.gte('created_at', from_date)
    if (to_date) query = query.lte('created_at', to_date)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('ULI logs error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ULI API logs' },
      { status: 500 }
    )
  }
}
