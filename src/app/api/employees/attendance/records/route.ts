
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // 0-11
    const year = searchParams.get('year')

    if (!month || !year) {
      return NextResponse.json(
        { success: false, error: 'Month and year are required' },
        { status: 400 }
      )
    }

    const monthNum = parseInt(month)
    const yearNum = parseInt(year)

    // Calculate date range for the month
    const startDate = new Date(yearNum, monthNum, 1).toISOString().split('T')[0]
    const endDate = new Date(yearNum, monthNum + 1, 0).toISOString().split('T')[0]

    // Fetch attendance records for the month
    const { data: records, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      throw error
    }

    // Fetch stats from the view
    const { data: stats, error: statsError } = await supabase
      .from('attendance_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-01`)
      .maybeSingle()

    if (statsError && statsError.code !== 'PGRST116') {
      apiLogger.error('Stats error', statsError)
    }

    // If stats view doesn't exist or returned an error, signal it to the frontend
    // so it can show "Stats unavailable" instead of misleading 0% attendance
    const statsResponse = stats || (statsError
      ? { stats_unavailable: true }
      : {
          present_days: 0,
          absent_days: 0,
          half_days: 0,
          leave_days: 0,
          attendance_rate: 0,
          total_hours_worked: 0
        })

    return NextResponse.json({
      success: true,
      data: {
        records: records || [],
        stats: statsResponse
      }
    })

  } catch (error) {
    apiLogger.error('Fetch attendance records error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attendance records' },
      { status: 500 }
    )
  }
}
