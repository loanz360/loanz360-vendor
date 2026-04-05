export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/superadmin/sms-analytics
 * Fetch SMS analytics and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify super admin role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // Default: last 30 days
    const to = searchParams.get('to') || new Date().toISOString()

    // Overall statistics
    const { data: allLogs } = await supabase
      .from('communication_delivery_log')
      .select('status, created_at, sent_at, delivered_at, message_parts, cost_credits')
      .eq('message_type', 'sms')
      .gte('created_at', from)
      .lte('created_at', to)

    const totalSent = allLogs?.length || 0
    const totalDelivered = allLogs?.filter((log: Record<string, any>) => log.status === 'delivered').length || 0
    const totalFailed = allLogs?.filter((log: Record<string, any>) => log.status === 'failed').length || 0
    const totalPending = allLogs?.filter((log: Record<string, any>) => log.status === 'pending').length || 0
    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(2) : 0

    // Calculate average delivery time
    const deliveryTimes = allLogs?.filter((log: Record<string, any>) => log.sent_at && log.delivered_at).map(log => {
      const sent = new Date(log.sent_at).getTime()
      const delivered = new Date(log.delivered_at).getTime()
      return (delivered - sent) / 1000 // seconds
    }) || []

    const avgDeliveryTime = deliveryTimes.length > 0
      ? (deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length).toFixed(2)
      : 0

    // Calculate total cost
    const totalCost = allLogs?.reduce((sum: number, log: Record<string, any>) => sum + (parseFloat(log.cost_credits) || 0), 0).toFixed(2) || '0'

    // Calculate total message parts (for long SMS)
    const totalMessageParts = allLogs?.reduce((sum: number, log: Record<string, any>) => sum + (log.message_parts || 1), 0) || 0

    // Stats by template
    const { data: templateStats } = await supabase
      .from('communication_delivery_log')
      .select('template_code, status')
      .eq('message_type', 'sms')
      .gte('created_at', from)
      .lte('created_at', to)
      .not('template_code', 'is', null)

    const templateBreakdown = templateStats?.reduce((acc: any, log: any) => {
      if (!acc[log.template_code]) {
        acc[log.template_code] = { total: 0, delivered: 0, failed: 0 }
      }
      acc[log.template_code].total++
      if (log.status === 'delivered') acc[log.template_code].delivered++
      if (log.status === 'failed') acc[log.template_code].failed++
      return acc
    }, {})

    // Stats by day (last 30 days)
    const { data: dailyStats } = await supabase
      .from('communication_analytics')
      .select('date, total_sent, total_delivered, total_failed')
      .eq('message_type', 'sms')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })

    // Provider stats
    const { data: providerStats } = await supabase
      .from('communication_delivery_log')
      .select('provider_name, status')
      .eq('message_type', 'sms')
      .gte('created_at', from)
      .lte('created_at', to)

    const providerBreakdown = providerStats?.reduce((acc: any, log: any) => {
      if (!acc[log.provider_name]) {
        acc[log.provider_name] = { total: 0, delivered: 0, failed: 0 }
      }
      acc[log.provider_name].total++
      if (log.status === 'delivered') acc[log.provider_name].delivered++
      if (log.status === 'failed') acc[log.provider_name].failed++
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalSent,
          totalDelivered,
          totalFailed,
          totalPending,
          deliveryRate: parseFloat(deliveryRate as string),
          avgDeliveryTime: parseFloat(avgDeliveryTime as string),
          totalCost: parseFloat(totalCost as string),
          totalMessageParts
        },
        templateBreakdown,
        providerBreakdown,
        dailyStats,
        dateRange: {
          from,
          to
        }
      }
    })
  } catch (error) {
    apiLogger.error('SMS analytics API error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
