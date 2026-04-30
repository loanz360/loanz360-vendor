import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// POST - Log banner view or click
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { banner_id, action_type } = body

    // Validate action_type
    if (!action_type || !['view', 'click'].includes(action_type)) {
      return NextResponse.json(
        { error: 'Invalid action_type. Must be "view" or "click"' },
        { status: 400 }
      )
    }

    // Validate banner_id
    if (!banner_id || typeof banner_id !== 'string') {
      return NextResponse.json(
        { error: 'Banner ID is required' },
        { status: 400 }
      )
    }

    // Validate banner_id is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(banner_id)) {
      return NextResponse.json(
        { error: 'Invalid banner ID format' },
        { status: 400 }
      )
    }

    const functionName = action_type === 'view' ? 'log_banner_view' : 'log_banner_click'
    const { error } = await supabase.rpc(functionName, { banner_uuid: banner_id })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    apiLogger.error('Error logging banner analytics', error)
    logApiError(error as Error, request, { action: 'log_analytics' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Fetch banner analytics (Super Admin only)
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.ANALYTICS)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Verify Super Admin
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userData?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const bannerId = searchParams.get('banner_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const reportType = searchParams.get('type') || 'summary' // summary | detailed | by_banner

    // Validate banner_id if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (bannerId && !uuidRegex.test(bannerId)) {
      return NextResponse.json(
        { error: 'Invalid banner ID format' },
        { status: 400 }
      )
    }

    // Build base query
    let query = supabase
      .from('banner_analytics')
      .select(`
        *,
        banners (
          id,
          title,
          status,
          priority,
          banner_type,
          views_count,
          clicks_count
        ),
        users (
          id,
          email,
          full_name,
          role,
          sub_role
        )
      `)

    // Apply filters
    if (bannerId) {
      query = query.eq('banner_id', bannerId)
    }

    if (startDate) {
      query = query.gte('viewed_at', startDate)
    }

    if (endDate) {
      // Add one day to include the end date fully
      const endDateTime = new Date(endDate)
      endDateTime.setDate(endDateTime.getDate() + 1)
      query = query.lt('viewed_at', endDateTime.toISOString())
    }

    const { data, error } = await query
      .order('viewed_at', { ascending: false })
      .limit(10000)

    if (error) throw error

    const analytics = data || []

    // Calculate summary statistics
    const views = analytics.filter(a => a.action_type === 'view')
    const clicks = analytics.filter(a => a.action_type === 'click')
    const uniqueViewers = new Set(analytics.map(a => a.user_id)).size

    const summary = {
      total_views: views.length,
      total_clicks: clicks.length,
      unique_viewers: uniqueViewers,
      click_through_rate: views.length > 0 ? (clicks.length / views.length) * 100 : 0
    }

    if (reportType === 'summary') {
      return NextResponse.json({ analytics: summary })
    }

    if (reportType === 'by_banner') {
      // Group analytics by banner
      const bannerStats: Record<string, any> = {}

      for (const record of analytics) {
        const bid = record.banner_id
        if (!bannerStats[bid]) {
          bannerStats[bid] = {
            banner_id: bid,
            title: record.banners?.title || 'Unknown',
            status: record.banners?.status || 'UNKNOWN',
            priority: record.banners?.priority || 'MEDIUM',
            banner_type: record.banners?.banner_type || 'INFORMATIONAL',
            views: 0,
            clicks: 0,
            unique_viewers: new Set(),
            ctr: 0
          }
        }

        if (record.action_type === 'view') {
          bannerStats[bid].views++
        } else if (record.action_type === 'click') {
          bannerStats[bid].clicks++
        }
        bannerStats[bid].unique_viewers.add(record.user_id)
      }

      // Calculate CTR and convert Set to count
      const bannerAnalytics = Object.values(bannerStats).map((stat: any) => ({
        ...stat,
        unique_viewers: stat.unique_viewers.size,
        ctr: stat.views > 0 ? (stat.clicks / stat.views) * 100 : 0
      }))

      // Sort by views descending
      bannerAnalytics.sort((a, b) => b.views - a.views)

      return NextResponse.json({
        analytics: summary,
        by_banner: bannerAnalytics
      })
    }

    // Detailed report with time series data
    if (reportType === 'detailed') {
      // Group by date for time series
      const dailyStats: Record<string, { date: string; views: number; clicks: number }> = {}

      for (const record of analytics) {
        const date = new Date(record.viewed_at).toISOString().split('T')[0]
        if (!dailyStats[date]) {
          dailyStats[date] = { date, views: 0, clicks: 0 }
        }
        if (record.action_type === 'view') {
          dailyStats[date].views++
        } else if (record.action_type === 'click') {
          dailyStats[date].clicks++
        }
      }

      const timeSeries = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))

      return NextResponse.json({
        analytics: summary,
        time_series: timeSeries,
        recent_activity: analytics.slice(0, 50)
      })
    }

    // Default: return summary with recent activity
    return NextResponse.json({
      analytics: {
        ...summary,
        recent_activity: analytics.slice(0, 50)
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching banner analytics', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
