/**
 * Message Queue Status API
 * Real-time queue monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()

    // Get counts by status
    const [pendingRes, processingRes, failedRes, scheduledRes] = await Promise.all([
      supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing'),
      supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase
        .from('message_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
    ])

    // Get recent failed messages for details
    const { data: recentFailed } = await supabase
      .from('message_queue')
      .select('id, message_type, recipient, error_message, created_at, retry_count')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)

    // Get processing metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: hourlyStats } = await supabase
      .from('message_queue')
      .select('status')
      .gte('updated_at', oneHourAgo)

    const hourlyBreakdown = {
      delivered: hourlyStats?.filter(m => m.status === 'delivered').length || 0,
      failed: hourlyStats?.filter(m => m.status === 'failed').length || 0,
      processing: hourlyStats?.filter(m => m.status === 'processing').length || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        pending: pendingRes.count || 0,
        processing: processingRes.count || 0,
        failed: failedRes.count || 0,
        scheduled: scheduledRes.count || 0,
        recentFailed: recentFailed || [],
        hourlyBreakdown
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Queue Status API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
