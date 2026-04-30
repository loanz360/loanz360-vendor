
/**
 * BDM Team Pipeline - Trends API
 * GET /api/bdm/team-pipeline/analytics/trends
 *
 * Returns time-series data for trend analysis
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBDMId, getBDEIds } from '@/lib/bdm/bde-utils'
import { getDateRangeFilter, parseDateRangeParams } from '@/lib/bdm/date-utils'
import { formatCurrency, formatNumber } from '@/lib/bdm/analytics'
import { apiLogger } from '@/lib/utils/logger'

type IntervalType = 'daily' | 'weekly' | 'monthly'
type MetricType = 'conversion_rate' | 'lead_count' | 'pipeline_value' | 'avg_tat'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user is BDM
    const bdmId = await getCurrentBDMId()
    if (!bdmId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - BDM role required' },
        { status: 401 }
      )
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const { range, startDate, endDate } = parseDateRangeParams(searchParams)
    const interval = (searchParams.get('interval') as IntervalType) || 'daily'
    const metric = (searchParams.get('metric') as MetricType) || 'conversion_rate'
    const bdeIdsParam = searchParams.get('bdeIds')?.split(',').filter(Boolean)

    // 3. Get BDEs under this BDM
    const allBDEIds = await getBDEIds(bdmId)
    const bdeIds = bdeIdsParam && bdeIdsParam.length > 0 ? bdeIdsParam : allBDEIds

    if (bdeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          metric,
          interval,
          dataPoints: [],
          summary: { min: 0, max: 0, avg: 0, trend: 'neutral' as const },
        },
      })
    }

    // 4. Get date range
    const dateRange = getDateRangeFilter(range, startDate, endDate)
    const supabase = createClient()

    // 5. Determine the SQL interval and date format
    const sqlInterval = interval === 'daily' ? '1 day' : interval === 'weekly' ? '7 days' : '1 month'
    const dateFormat = interval === 'daily' ? 'YYYY-MM-DD' : interval === 'weekly' ? 'IYYY-IW' : 'YYYY-MM'

    // 6. Fetch leads data
    const { data: leads, error } = await supabase
      .from('leads')
      .select('created_at, lead_status, loan_amount, disbursement_date')
      .in('assigned_bde_id', bdeIds)
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (error) {
      apiLogger.error('[Trends API] Error fetching leads', error)
      throw new Error(`Failed to fetch leads: ${error.message}`)
    }

    // 7. Group data by interval
    const groupedData = new Map<string, {
      leadCount: number
      conversions: number
      pipelineValue: number
      tatDays: number[]
    }>()

    leads?.forEach((lead) => {
      const createdDate = new Date(lead.created_at)
      let key: string

      if (interval === 'daily') {
        key = createdDate.toISOString().split('T')[0]
      } else if (interval === 'weekly') {
        const year = createdDate.getFullYear()
        const week = getWeekNumber(createdDate)
        key = `${year}-W${week.toString().padStart(2, '0')}`
      } else {
        const year = createdDate.getFullYear()
        const month = (createdDate.getMonth() + 1).toString().padStart(2, '0')
        key = `${year}-${month}`
      }

      const existing = groupedData.get(key) || {
        leadCount: 0,
        conversions: 0,
        pipelineValue: 0,
        tatDays: [],
      }

      existing.leadCount++
      existing.pipelineValue += lead.loan_amount || 0

      if (lead.lead_status === 'DISBURSED') {
        existing.conversions++

        if (lead.disbursement_date) {
          const tat = Math.ceil(
            (new Date(lead.disbursement_date).getTime() - createdDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
          existing.tatDays.push(tat)
        }
      }

      groupedData.set(key, existing)
    })

    // 8. Calculate metric values and build data points
    const dataPoints = Array.from(groupedData.entries())
      .map(([date, data]) => {
        let value: number
        let formattedValue: string

        switch (metric) {
          case 'conversion_rate':
            value = data.leadCount > 0 ? (data.conversions / data.leadCount) * 100 : 0
            formattedValue = `${value.toFixed(1)}%`
            break
          case 'lead_count':
            value = data.leadCount
            formattedValue = formatNumber(value)
            break
          case 'pipeline_value':
            value = data.pipelineValue
            formattedValue = formatCurrency(value)
            break
          case 'avg_tat':
            value =
              data.tatDays.length > 0
                ? data.tatDays.reduce((sum, tat) => sum + tat, 0) / data.tatDays.length
                : 0
            formattedValue = `${Math.round(value)} days`
            break
          default:
            value = 0
            formattedValue = '0'
        }

        return {
          date,
          value: Math.round(value * 100) / 100,
          formattedValue,
          leadCount: data.leadCount,
          conversions: data.conversions,
          pipelineValue: data.pipelineValue,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    // 9. Calculate summary statistics
    const values = dataPoints.map((dp) => dp.value)
    const min = values.length > 0 ? Math.min(...values) : 0
    const max = values.length > 0 ? Math.max(...values) : 0
    const avg = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

    // Determine trend (comparing first half to second half)
    const midPoint = Math.floor(values.length / 2)
    const firstHalfAvg =
      midPoint > 0
        ? values.slice(0, midPoint).reduce((sum, v) => sum + v, 0) / midPoint
        : 0
    const secondHalfAvg =
      values.length > midPoint
        ? values.slice(midPoint).reduce((sum, v) => sum + v, 0) / (values.length - midPoint)
        : 0

    const trend: 'up' | 'down' | 'neutral' =
      secondHalfAvg > firstHalfAvg * 1.05
        ? 'up'
        : secondHalfAvg < firstHalfAvg * 0.95
        ? 'down'
        : 'neutral'

    // 10. Return response
    return NextResponse.json({
      success: true,
      data: {
        metric,
        interval,
        dataPoints,
        summary: {
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
          avg: Math.round(avg * 100) / 100,
          trend,
          firstHalfAvg: Math.round(firstHalfAvg * 100) / 100,
          secondHalfAvg: Math.round(secondHalfAvg * 100) / 100,
        },
      },
      metadata: {
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          type: range,
        },
        bdeCount: bdeIds.length,
        dataPointCount: dataPoints.length,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('[Trends API] Error', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trends data',
      },
      { status: 500 }
    )
  }
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
