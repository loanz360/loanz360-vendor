/**
 * API Route: ULI Cost & Usage Analytics
 * GET /api/superadmin/uli-hub/analytics — Usage stats, cost breakdown, trends
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


export async function GET() {
  try {
    const supabase = createAdminClient()

    // Get service-level stats
    const { data: services, error: svcError } = await supabase
      .from('uli_services')
      .select('service_code, service_name, category, cost_per_call, total_calls_this_month, total_cost_this_month, success_rate, avg_response_time_ms, is_enabled')
      .order('total_calls_this_month', { ascending: false })

    if (svcError) throw svcError

    // Get recent log stats (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentLogs, error: logError } = await supabase
      .from('uli_api_logs')
      .select('category, is_success, cost, response_time_ms, environment, created_at')
      .gte('created_at', thirtyDaysAgo)

    if (logError) throw logError

    const logs = recentLogs || []
    const allServices = services || []

    // Aggregate stats
    const totalCalls = logs.length
    const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0)
    const successfulCalls = logs.filter(l => l.is_success).length
    const overallSuccessRate = totalCalls > 0 ? (successfulCalls / totalCalls * 100) : 0
    const avgResponseTime = totalCalls > 0
      ? logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / totalCalls
      : 0

    // Category breakdown
    const categoryStats: Record<string, { calls: number; cost: number; success: number; total: number }> = {}
    for (const log of logs) {
      if (!categoryStats[log.category]) {
        categoryStats[log.category] = { calls: 0, cost: 0, success: 0, total: 0 }
      }
      categoryStats[log.category].calls++
      categoryStats[log.category].total++
      categoryStats[log.category].cost += log.cost || 0
      if (log.is_success) categoryStats[log.category].success++
    }

    // Environment breakdown
    const sandboxCalls = logs.filter(l => l.environment === 'SANDBOX').length
    const productionCalls = logs.filter(l => l.environment === 'PRODUCTION').length

    // Top 10 most-called services
    const topServices = allServices
      .filter(s => s.total_calls_this_month > 0)
      .slice(0, 10)
      .map(s => ({
        service_code: s.service_code,
        service_name: s.service_name,
        category: s.category,
        calls: s.total_calls_this_month,
        cost: s.total_cost_this_month,
        success_rate: s.success_rate,
      }))

    // Get budget info
    const { data: envConfig } = await supabase
      .from('uli_environment_config')
      .select('monthly_budget_limit, alert_threshold_percentage')
      .limit(1)
      .maybeSingle()

    const budgetLimit = envConfig?.monthly_budget_limit || 0
    const budgetUsed = totalCost
    const budgetPercentage = budgetLimit > 0 ? (budgetUsed / budgetLimit * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_calls: totalCalls,
          total_cost: totalCost,
          success_rate: overallSuccessRate,
          avg_response_time_ms: avgResponseTime,
          sandbox_calls: sandboxCalls,
          production_calls: productionCalls,
          enabled_services: allServices.filter(s => s.is_enabled).length,
          total_services: allServices.length,
        },
        budget: {
          limit: budgetLimit,
          used: budgetUsed,
          percentage: budgetPercentage,
          alert_threshold: envConfig?.alert_threshold_percentage || 80,
        },
        category_breakdown: categoryStats,
        top_services: topServices,
      },
    })
  } catch (error) {
    apiLogger.error('ULI analytics error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ULI analytics' },
      { status: 500 }
    )
  }
}
