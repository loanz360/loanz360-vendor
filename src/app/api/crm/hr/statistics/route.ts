import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'


// GET /api/crm/hr/statistics - Get CRO-wise statistics for HR dashboard
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role, subrole')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // Only HR and Super Admin can access statistics
    if (profile.role !== 'hr' && profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only HR and Super Admin can access CRO statistics' }, { status: 403 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const cro_user_id = searchParams.get('cro_user_id') || ''
    const from_date = searchParams.get('from_date') || ''
    const to_date = searchParams.get('to_date') || ''
    const view_type = searchParams.get('view_type') || 'realtime' // 'realtime' or 'daily'

    if (view_type === 'daily') {
      // Fetch from daily stats table (historical data)
      let query = supabase
        .from('crm_cro_daily_stats')
        .select(`
          *,
          cro:auth.users!crm_cro_daily_stats_cro_user_id_fkey(id, email)
        `)
        .order('stats_date', { ascending: false })

      // Filter by CRO if specified
      if (cro_user_id) {
        query = query.eq('cro_user_id', cro_user_id)
      }

      // Filter by date range
      if (from_date) {
        query = query.gte('stats_date', from_date)
      }
      if (to_date) {
        query = query.lte('stats_date', to_date)
      }

      // Limit to last 90 days if no filters
      if (!from_date && !to_date) {
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        query = query.gte('stats_date', ninetyDaysAgo.toISOString().split('T')[0])
      }

      const { data: stats, error: statsError } = await query

      if (statsError) {
        apiLogger.error('Error fetching daily stats', statsError)
        return NextResponse.json({ success: false, error: 'Failed to fetch statistics' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        view_type: 'daily',
        data: stats
      })

    } else {
      // Fetch from real-time view (current data)
      const { data: stats, error: statsError } = await supabase
        .from('crm_hr_statistics')
        .select('*')

      if (statsError) {
        apiLogger.error('Error fetching HR statistics', statsError)
        return NextResponse.json({ success: false, error: 'Failed to fetch statistics' }, { status: 500 })
      }

      // Filter by CRO if specified
      let filteredStats = stats || []
      if (cro_user_id) {
        filteredStats = filteredStats.filter(s => s.cro_user_id === cro_user_id)
      }

      return NextResponse.json({
        success: true,
        view_type: 'realtime',
        data: filteredStats
      })
    }

  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/crm/hr/statistics', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/crm/hr/statistics/refresh - Manually refresh daily statistics
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 403 })
    }

    // Only Super Admin can manually refresh statistics
    if (profile.role !== 'superadmin') {
      return NextResponse.json({ success: false, error: 'Only Super Admin can manually refresh statistics' }, { status: 403 })
    }

    // Parse request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const target_date = body.target_date || new Date().toISOString().split('T')[0]

    // Call the refresh function
    const { error: refreshError } = await supabase.rpc('refresh_cro_daily_stats', {
      target_date
    })

    if (refreshError) {
      apiLogger.error('Error refreshing statistics', refreshError)
      return NextResponse.json({ success: false, error: 'Failed to refresh statistics' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Statistics refreshed for ${target_date}`
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/crm/hr/statistics/refresh', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
