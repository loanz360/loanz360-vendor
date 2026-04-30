import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getTicketMetrics,
  getAgentMetrics,
  getCategoryMetrics,
  getTicketTrends,
  getSourceMetrics,
  getPriorityMetrics,
  getHourlyDistribution,
  getDayDistribution,
  generateReport,
  comparePeriods
} from '@/lib/tickets/analytics-engine'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/analytics
 * Get ticket analytics and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'overview'

    // Parse date range
    const startStr = searchParams.get('start_date')
    const endStr = searchParams.get('end_date')
    const period = searchParams.get('period') || '7d'

    let endDate = new Date()
    let startDate = new Date()

    if (startStr && endStr) {
      startDate = new Date(startStr)
      endDate = new Date(endStr)
    } else {
      // Use period
      switch (period) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24)
          break
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(startDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(startDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        default:
          startDate.setDate(startDate.getDate() - 7)
      }
    }

    // Mode: Overview metrics
    if (mode === 'overview') {
      const source = searchParams.get('source') as 'EMPLOYEE' | 'CUSTOMER' | 'PARTNER' | undefined
      const metrics = await getTicketMetrics(startDate, endDate, source)
      return NextResponse.json({ metrics })
    }

    // Mode: Agent performance
    if (mode === 'agents') {
      const limit = parseInt(searchParams.get('limit') || '20')
      const agents = await getAgentMetrics(startDate, endDate, limit)
      return NextResponse.json({ agents })
    }

    // Mode: Category breakdown
    if (mode === 'categories') {
      const categories = await getCategoryMetrics(startDate, endDate)
      return NextResponse.json({ categories })
    }

    // Mode: Trends over time
    if (mode === 'trends') {
      const granularity = (searchParams.get('granularity') || 'day') as 'day' | 'week' | 'month'
      const trends = await getTicketTrends(startDate, endDate, granularity)
      return NextResponse.json({ trends })
    }

    // Mode: Source breakdown
    if (mode === 'sources') {
      const sources = await getSourceMetrics(startDate, endDate)
      return NextResponse.json({ sources })
    }

    // Mode: Priority breakdown
    if (mode === 'priorities') {
      const priorities = await getPriorityMetrics(startDate, endDate)
      return NextResponse.json({ priorities })
    }

    // Mode: Hourly distribution
    if (mode === 'hourly') {
      const distribution = await getHourlyDistribution(startDate, endDate)
      return NextResponse.json({ distribution })
    }

    // Mode: Daily distribution
    if (mode === 'daily') {
      const distribution = await getDayDistribution(startDate, endDate)
      return NextResponse.json({ distribution })
    }

    // Mode: Full report
    if (mode === 'report') {
      const report = await generateReport(startDate, endDate)
      return NextResponse.json({ report })
    }

    // Mode: Period comparison
    if (mode === 'compare') {
      const previousPeriodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const previousEnd = new Date(startDate)
      const previousStart = new Date(startDate)
      previousStart.setDate(previousStart.getDate() - previousPeriodDays)

      const comparison = await comparePeriods(startDate, endDate, previousStart, previousEnd)
      return NextResponse.json({ comparison })
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Analytics API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/analytics
 * Generate or schedule reports
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bodySchema = z.object({


      action: z.string().optional(),


      start_date: z.string().optional(),


      end_date: z.string().optional(),


      config: z.record(z.unknown()),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action, start_date, end_date, config } = body

    if (action === 'generate_report') {
      if (!start_date || !end_date) {
        return NextResponse.json(
          { error: 'start_date and end_date are required' },
          { status: 400 }
        )
      }

      const report = await generateReport(new Date(start_date), new Date(end_date), config)

      // Store report in database
      const { data: savedReport, error } = await supabase
        .from('analytics_reports')
        .insert({
          generated_by_id: user.id,
          report_type: config?.type || 'custom',
          period_start: start_date,
          period_end: end_date,
          data: report,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        // Table might not exist, just return the report
        return NextResponse.json({ report, saved: false })
      }

      return NextResponse.json({ report, saved: true, report_id: savedReport?.id })
    }

    if (action === 'schedule_report') {
      if (!config) {
        return NextResponse.json({ success: false, error: 'config required for scheduling' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('scheduled_reports')
        .insert({
          name: config.name,
          report_type: config.type,
          config,
          created_by_id: user.id,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .maybeSingle()

      if (error) {
        return NextResponse.json({ success: false, error: 'Failed to schedule report' }, { status: 500 })
      }

      return NextResponse.json({ schedule: data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    apiLogger.error('Analytics API Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
