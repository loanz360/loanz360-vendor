import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'


/**
 * GET /api/tools/analytics
 * Get tool usage analytics for CRO portal
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || '30' // days
    const userId = searchParams.get('user_id') || user.id

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - parseInt(period))

    // Get tool usage counts from tool_usage_logs table
    const { data: usageLogs, error: logsError } = await supabase
      .from('tool_usage_logs')
      .select('tool_name, action, created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceDate.toISOString())
      .order('created_at', { ascending: false })

    if (logsError) {
      // If table doesn't exist, return empty analytics gracefully
      apiLogger.error('Tool usage logs query error:', logsError)
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            total_actions: 0,
            unique_tools: 0,
            most_used_tool: null,
            period_days: parseInt(period),
          },
          by_tool: {},
          daily_trend: [],
        }
      })
    }

    // Aggregate by tool
    const byTool: Record<string, { count: number; actions: Record<string, number> }> = {}
    const dailyMap: Record<string, number> = {}

    for (const log of usageLogs || []) {
      // By tool
      if (!byTool[log.tool_name]) {
        byTool[log.tool_name] = { count: 0, actions: {} }
      }
      byTool[log.tool_name].count++
      byTool[log.tool_name].actions[log.action] = (byTool[log.tool_name].actions[log.action] || 0) + 1

      // Daily trend
      const day = log.created_at.split('T')[0]
      dailyMap[day] = (dailyMap[day] || 0) + 1
    }

    // Find most used tool
    let mostUsedTool = null
    let maxCount = 0
    for (const [tool, data] of Object.entries(byTool)) {
      if (data.count > maxCount) {
        maxCount = data.count
        mostUsedTool = tool
      }
    }

    // Build daily trend
    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_actions: usageLogs?.length || 0,
          unique_tools: Object.keys(byTool).length,
          most_used_tool: mostUsedTool,
          period_days: parseInt(period),
        },
        by_tool: byTool,
        daily_trend: dailyTrend,
      }
    })
  } catch (error) {
    apiLogger.error('Tool analytics error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/tools/analytics
 * Log a tool usage event
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { tool_name, action, metadata } = body

    if (!tool_name || !action) {
      return NextResponse.json({
        success: false,
        error: 'tool_name and action are required'
      }, { status: 400 })
    }

    const validTools = ['emi_calculator', 'eligibility_checker', 'knowledge_base', 'offers', 'bank_products', 'product_comparison']
    if (!validTools.includes(tool_name)) {
      return NextResponse.json({
        success: false,
        error: `Invalid tool name. Must be one of: ${validTools.join(', ')}`
      }, { status: 400 })
    }

    const { error: insertError } = await supabase
      .from('tool_usage_logs')
      .insert({
        user_id: user.id,
        tool_name,
        action,
        metadata: metadata || {},
      })

    if (insertError) {
      apiLogger.error('Tool usage log insert error:', insertError)
      // Don't fail the request for analytics logging
      return NextResponse.json({ success: true, logged: false })
    }

    return NextResponse.json({ success: true, logged: true })
  } catch (error) {
    apiLogger.error('Tool analytics log error:', error)
    return NextResponse.json({ success: true, logged: false })
  }
}
