
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GraphDataResponse, GraphDataPoint } from '@/lib/types/cro-performance.types'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const supabase = await createClient()

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const compareWith = searchParams.get('compare') // comma-separated employee IDs

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get current user's daily metrics
    const { data: userMetrics } = await supabase
      .from('cro_daily_metrics')
      .select('date, calls_made, leads_converted, cases_sanctioned, cases_disbursed, revenue_generated')
      .eq('cro_id', user.id)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true })

    // Transform to GraphDataPoint
    const dailyData: GraphDataPoint[] = (userMetrics || []).map(m => ({
      date: m.date,
      calls_made: m.calls_made || 0,
      leads_converted: m.leads_converted || 0,
      cases_sanctioned: m.cases_sanctioned || 0,
      cases_disbursed: m.cases_disbursed || 0,
      revenue: m.revenue_generated || 0
    }))

    // Get comparison data if requested
    const croComparison: { employee_id: string; data: GraphDataPoint[] }[] = []

    if (compareWith) {
      const employeeIds = compareWith.split(',').map(id => id.trim())

      // Get user IDs for the employee IDs
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, employee_id')
        .in('employee_id', employeeIds)

      if (profiles && profiles.length > 0) {
        const compareUserIds = profiles.map(p => p.user_id)
        const userIdToEmployeeId = new Map(profiles.map(p => [p.user_id, p.employee_id]))

        // Single batched query instead of N+1 loop
        const { data: allCompareMetrics } = await supabase
          .from('cro_daily_metrics')
          .select('cro_id, date, calls_made, leads_converted, cases_sanctioned, cases_disbursed, revenue_generated')
          .in('cro_id', compareUserIds)
          .gte('date', startDateStr)
          .lte('date', endDateStr)
          .order('date', { ascending: true })

        // Group results by cro_id
        const metricsByCro = new Map<string, typeof allCompareMetrics>()
        for (const m of allCompareMetrics || []) {
          if (!metricsByCro.has(m.cro_id)) metricsByCro.set(m.cro_id, [])
          metricsByCro.get(m.cro_id)!.push(m)
        }

        for (const userId of compareUserIds) {
          croComparison.push({
            employee_id: userIdToEmployeeId.get(userId) || userId,
            data: (metricsByCro.get(userId) || []).map(m => ({
              date: m.date,
              calls_made: m.calls_made || 0,
              leads_converted: m.leads_converted || 0,
              cases_sanctioned: m.cases_sanctioned || 0,
              cases_disbursed: m.cases_disbursed || 0,
              revenue: m.revenue_generated || 0
            }))
          })
        }
      }
    }

    // If no comparison specified, get top 3 CROs for comparison
    if (!compareWith) {
      const currentMonth = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`

      const { data: topCros } = await supabase
        .from('cro_monthly_summary')
        .select('cro_id')
        .eq('month', currentMonth)
        .neq('cro_id', user.id)
        .order('performance_score', { ascending: false })
        .limit(3)

      if (topCros && topCros.length > 0) {
        // Get employee IDs for top CROs
        const topCroIds = topCros.map(c => c.cro_id)
        const { data: topProfiles } = await supabase
          .from('profiles')
          .select('user_id, employee_id')
          .in('user_id', topCroIds)

        const topUserIdToEmployeeId = new Map((topProfiles || []).map(p => [p.user_id, p.employee_id]))

        // Single batched query instead of N+1 loop
        const { data: allTopMetrics } = await supabase
          .from('cro_daily_metrics')
          .select('cro_id, date, calls_made, leads_converted, cases_sanctioned, cases_disbursed, revenue_generated')
          .in('cro_id', topCroIds)
          .gte('date', startDateStr)
          .lte('date', endDateStr)
          .order('date', { ascending: true })

        // Group results by cro_id
        const topMetricsByCro = new Map<string, typeof allTopMetrics>()
        for (const m of allTopMetrics || []) {
          if (!topMetricsByCro.has(m.cro_id)) topMetricsByCro.set(m.cro_id, [])
          topMetricsByCro.get(m.cro_id)!.push(m)
        }

        for (const croId of topCroIds) {
          croComparison.push({
            employee_id: topUserIdToEmployeeId.get(croId) || croId,
            data: (topMetricsByCro.get(croId) || []).map(m => ({
              date: m.date,
              calls_made: m.calls_made || 0,
              leads_converted: m.leads_converted || 0,
              cases_sanctioned: m.cases_sanctioned || 0,
              cases_disbursed: m.cases_disbursed || 0,
              revenue: m.revenue_generated || 0
            }))
          })
        }
      }
    }

    const response: GraphDataResponse = {
      success: true,
      data: {
        daily_data: dailyData,
        cro_comparison: croComparison,
        period: {
          start_date: startDateStr,
          end_date: endDateStr
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    apiLogger.error('Error fetching graph data', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graph data' },
      { status: 500 }
    )
  }
}
