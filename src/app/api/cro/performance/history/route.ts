
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PerformanceHistoryResponse, MetricTrend } from '@/lib/types/cro-performance.types'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Get user's joining date from employees table (canonical employee table)
    const { data: employeeRecord } = await supabase
      .from('employees')
      .select('created_at, date_of_joining')
      .eq('user_id', user.id)
      .maybeSingle()

    const joiningDate = employeeRecord?.date_of_joining || employeeRecord?.created_at || new Date().toISOString()

    // Get all monthly summaries for the user since joining
    const { data: monthlyPerformance, error: summaryError } = await supabase
      .from('cro_monthly_summary')
      .select('*')
      .eq('cro_id', user.id)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (summaryError) {
      apiLogger.error('Error fetching monthly performance', summaryError)
    }

    const performanceData = monthlyPerformance || []

    // Calculate statistics
    let bestMonth = { month: 'N/A', score: 0 }
    let totalScore = 0

    for (const perf of performanceData) {
      totalScore += perf.performance_score || 0
      if ((perf.performance_score || 0) > bestMonth.score) {
        bestMonth = {
          month: perf.month,
          score: perf.performance_score || 0
        }
      }
    }

    const averageScore = performanceData.length > 0
      ? totalScore / performanceData.length
      : 0

    // Calculate trend (compare last 3 months)
    let trend: MetricTrend = 'stable'
    if (performanceData.length >= 3) {
      const last3 = performanceData.slice(-3)
      const firstScore = last3[0].performance_score || 0
      const lastScore = last3[2].performance_score || 0

      if (lastScore > firstScore * 1.05) trend = 'up'
      else if (lastScore < firstScore * 0.95) trend = 'down'
    }

    const response: PerformanceHistoryResponse = {
      success: true,
      data: {
        monthly_performance: performanceData,
        joining_date: joiningDate,
        total_months: performanceData.length,
        best_month: bestMonth,
        average_score: Math.round(averageScore * 100) / 100,
        trend
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error fetching performance history', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch performance history' },
      { status: 500 }
    )
  }
}
