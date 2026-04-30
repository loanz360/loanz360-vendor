
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import {
  calculatePunctualityScore,
  calculateAttendanceTrend,
  calculateOvertimeHours,
  detectAttendanceAnomalies
} from '@/lib/utils/attendance-enhancements'

/**
 * GET /api/employees/attendance/analytics
 *
 * Returns comprehensive attendance analytics for the authenticated user:
 * - Punctuality score (last 30 days)
 * - Attendance streak (current consecutive present days)
 * - Overtime hours this month
 * - Late arrival trend (count per week for last 4 weeks)
 * - Average working hours
 * - Comp-off balance
 * - Attendance rate comparison (this month vs last month)
 */
export async function GET(request: Request) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // ── Date ranges ──────────────────────────────────────────────────────────
    // Last 30 days
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // Current month
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Last month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
    const lastMonthEndStr = lastMonthEnd.toISOString().split('T')[0]

    // 4 weeks ago (for weekly late trend)
    const fourWeeksAgo = new Date(now)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

    // ── Parallel queries ─────────────────────────────────────────────────────
    const [
      last30DaysResult,
      currentMonthResult,
      lastMonthResult,
      compOffResult,
      streakResult
    ] = await Promise.all([
      // 1. Last 30 days attendance (for punctuality score & anomalies)
      supabase
        .from('attendance')
        .select('date, status, check_in, check_out, is_late, late_by_minutes, total_hours')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgoStr)
        .lte('date', today)
        .order('date', { ascending: true }),

      // 2. Current month attendance (for overtime, avg hours, attendance rate)
      supabase
        .from('attendance')
        .select('date, status, check_in, is_late, late_by_minutes, total_hours')
        .eq('user_id', user.id)
        .gte('date', currentMonthStart)
        .lte('date', today)
        .order('date', { ascending: true }),

      // 3. Last month attendance (for comparison)
      supabase
        .from('attendance')
        .select('date, status, is_late')
        .eq('user_id', user.id)
        .gte('date', lastMonthStart)
        .lte('date', lastMonthEndStr)
        .order('date', { ascending: true }),

      // 4. Comp-off balance (available credits)
      supabase
        .from('comp_off_credits')
        .select('id, status, credit_type, work_date, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'available')
        .gte('expires_at', today),

      // 5. Recent attendance for streak calculation (last 90 days, descending)
      supabase
        .from('attendance')
        .select('date, status')
        .eq('user_id', user.id)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(90)
    ])

    // ── Process: Punctuality Score (last 30 days) ────────────────────────────
    const last30Days = last30DaysResult.data || []

    const punctualityRecords = last30Days
      .filter(r => r.status === 'present' || r.status === 'late')
      .map(r => ({
        isLate: r.is_late === true,
        lateByMinutes: r.late_by_minutes || 0
      }))

    const punctualityScore = calculatePunctualityScore(punctualityRecords)

    // ── Process: Attendance Streak ───────────────────────────────────────────
    const streakRecords = streakResult.data || []
    let currentStreak = 0

    for (const record of streakRecords) {
      const status = record.status?.toLowerCase()
      if (status === 'present' || status === 'late') {
        currentStreak++
      } else {
        break // streak broken
      }
    }

    // ── Process: Overtime Hours (current month) ──────────────────────────────
    const currentMonth = currentMonthResult.data || []

    const overtimeRecords = currentMonth.map(r => ({
      totalHours: r.total_hours ?? null
    }))

    const overtimeStats = calculateOvertimeHours(overtimeRecords)

    // ── Process: Late Arrival Trend (last 4 weeks) ───────────────────────────
    const lateWeeklyTrend: Array<{ weekLabel: string; lateCount: number; weekStart: string }> = []

    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay() - 1)) // Align to Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekStartStr = weekStart.toISOString().split('T')[0]
      const weekEndStr = weekEnd.toISOString().split('T')[0]

      const lateInWeek = last30Days.filter(r => {
        return r.date >= weekStartStr && r.date <= weekEndStr && r.is_late === true
      })

      lateWeeklyTrend.push({
        weekLabel: `${weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
        lateCount: lateInWeek.length,
        weekStart: weekStartStr
      })
    }

    // ── Process: Average Working Hours (current month) ───────────────────────
    const hoursRecords = currentMonth.filter(r => r.total_hours !== null && r.total_hours > 0)
    const totalWorkingHours = hoursRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0)
    const averageWorkingHours = hoursRecords.length > 0
      ? Math.round((totalWorkingHours / hoursRecords.length) * 100) / 100
      : 0

    // ── Process: Comp-off Balance ────────────────────────────────────────────
    const compOffCredits = compOffResult.data || []
    const compOffBalance = {
      fullDays: compOffCredits.filter(c => c.credit_type === 'full_day').length,
      halfDays: compOffCredits.filter(c => c.credit_type === 'half_day').length,
      total: compOffCredits.length,
      nearingExpiry: compOffCredits.filter(c => {
        const expiresAt = new Date(c.expires_at)
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilExpiry <= 7
      }).length
    }

    // ── Process: Attendance Rate Comparison ──────────────────────────────────
    const lastMonthRecords = lastMonthResult.data || []

    const currentMonthPresent = currentMonth.filter(r =>
      r.status === 'present' || r.status === 'late'
    ).length
    const currentMonthTotal = currentMonth.length
    const currentMonthRate = currentMonthTotal > 0
      ? Math.round((currentMonthPresent / currentMonthTotal) * 100)
      : 0

    const lastMonthPresent = lastMonthRecords.filter(r =>
      r.status === 'present' || r.status === 'late'
    ).length
    const lastMonthTotal = lastMonthRecords.length
    const lastMonthRate = lastMonthTotal > 0
      ? Math.round((lastMonthPresent / lastMonthTotal) * 100)
      : 0

    const rateChange = currentMonthRate - lastMonthRate

    // ── Process: Attendance Trend (last 30 days) ─────────────────────────────
    const trendRecords = last30Days.map(r => ({
      date: r.date,
      status: r.status || 'absent'
    }))

    const attendanceTrend = calculateAttendanceTrend(trendRecords)

    // ── Process: Anomaly Detection ───────────────────────────────────────────
    const anomalyRecords = last30Days.map(r => ({
      date: r.date,
      status: r.status || 'absent',
      checkIn: r.check_in || null
    }))

    const anomalies = detectAttendanceAnomalies(anomalyRecords)

    // ── Response ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        punctualityScore,
        attendanceStreak: currentStreak,
        overtime: {
          thisMonth: overtimeStats.totalOvertimeHours,
          daysWithOvertime: overtimeStats.daysWithOvertime,
          averagePerDay: overtimeStats.averageOvertimePerDay
        },
        lateArrivalTrend: lateWeeklyTrend,
        averageWorkingHours,
        compOffBalance,
        attendanceRateComparison: {
          currentMonth: {
            rate: currentMonthRate,
            presentDays: currentMonthPresent,
            totalDays: currentMonthTotal
          },
          lastMonth: {
            rate: lastMonthRate,
            presentDays: lastMonthPresent,
            totalDays: lastMonthTotal
          },
          change: rateChange,
          trend: rateChange > 0 ? 'improving' : rateChange < 0 ? 'declining' : 'stable'
        },
        weeklyTrends: attendanceTrend.weeklyTrends,
        anomalies,
        period: {
          from: thirtyDaysAgoStr,
          to: today
        }
      }
    })

  } catch (error) {
    apiLogger.error('Attendance analytics error', error)
    logApiError(error as Error, request, { action: 'get_attendance_analytics' })

    return NextResponse.json(
      { success: false, error: 'Failed to fetch attendance analytics' },
      { status: 500 }
    )
  }
}
