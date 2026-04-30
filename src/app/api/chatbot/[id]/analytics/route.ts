
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

interface AnalyticsParams {
  startDate?: string
  endDate?: string
  groupBy?: 'day' | 'week' | 'month'
}

// GET - Get chatbot analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatbotId } = await params
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is super admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.role !== 'SUPER_ADMIN' && !superAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Verify chatbot exists
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('id', chatbotId)
      .maybeSingle()

    if (chatbotError || !chatbot) {
      return NextResponse.json(
        { success: false, error: 'Chatbot not found' },
        { status: 404 }
      )
    }

    // Get session stats
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, status, started_at, ended_at, device_type, browser')
      .eq('chatbot_id', chatbotId)
      .gte('started_at', startDate)
      .lte('started_at', endDate)

    if (sessionsError) throw sessionsError

    // Get leads stats
    const { data: leads, error: leadsError } = await supabase
      .from('online_leads')
      .select('id, status, created_at, lead_score')
      .eq('chatbot_id', chatbotId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (leadsError) throw leadsError

    // Calculate metrics
    const totalSessions = sessions?.length || 0
    const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0
    const totalLeads = leads?.length || 0

    const conversionRate = totalSessions > 0
      ? Math.round((totalLeads / totalSessions) * 100 * 10) / 10
      : 0

    const completionRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100 * 10) / 10
      : 0

    // Calculate average session duration
    let avgDuration = 0
    const completedWithDuration = sessions?.filter(s => s.ended_at && s.started_at) || []
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce((acc, s) => {
        const start = new Date(s.started_at).getTime()
        const end = new Date(s.ended_at).getTime()
        return acc + (end - start)
      }, 0)
      avgDuration = Math.round(totalDuration / completedWithDuration.length / 1000) // in seconds
    }

    // Device breakdown
    const deviceBreakdown: Record<string, number> = {}
    sessions?.forEach(s => {
      const device = s.device_type || 'unknown'
      deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1
    })

    // Browser breakdown
    const browserBreakdown: Record<string, number> = {}
    sessions?.forEach(s => {
      const browser = s.browser || 'unknown'
      browserBreakdown[browser] = (browserBreakdown[browser] || 0) + 1
    })

    // Lead score distribution
    const scoreDistribution = {
      high: leads?.filter(l => (l.lead_score || 50) >= 70).length || 0,
      medium: leads?.filter(l => (l.lead_score || 50) >= 40 && (l.lead_score || 50) < 70).length || 0,
      low: leads?.filter(l => (l.lead_score || 50) < 40).length || 0
    }

    // Daily trend (last 30 days)
    const dailyTrend: Array<{ date: string; sessions: number; leads: number }> = []
    const dateMap = new Map<string, { sessions: number; leads: number }>()

    sessions?.forEach(s => {
      const date = s.started_at.split('T')[0]
      const current = dateMap.get(date) || { sessions: 0, leads: 0 }
      dateMap.set(date, { ...current, sessions: current.sessions + 1 })
    })

    leads?.forEach(l => {
      const date = l.created_at.split('T')[0]
      const current = dateMap.get(date) || { sessions: 0, leads: 0 }
      dateMap.set(date, { ...current, leads: current.leads + 1 })
    })

    // Sort by date
    Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, data]) => {
        dailyTrend.push({ date, ...data })
      })

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalSessions,
          completedSessions,
          totalLeads,
          conversionRate,
          completionRate,
          avgDurationSeconds: avgDuration
        },
        devices: deviceBreakdown,
        browsers: browserBreakdown,
        leadScores: scoreDistribution,
        trend: dailyTrend,
        period: {
          startDate,
          endDate
        }
      }
    })
  } catch (error) {
    apiLogger.error('Error fetching analytics', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
