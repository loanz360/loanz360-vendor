import { createClient } from '@/lib/supabase/server'

/**
 * Analytics Aggregation Service
 * Handles daily analytics aggregation, node-level analytics, and conversion tracking
 */

interface DailyStats {
  date: string
  chatbot_id: string
  total_sessions: number
  completed_sessions: number
  total_messages: number
  total_leads: number
  unique_visitors: number
  avg_session_duration: number
  completion_rate: number
  bounce_rate: number
}

interface NodeAnalytics {
  node_id: string
  node_type: string
  visits: number
  completions: number
  drop_offs: number
  avg_time_spent: number
  completion_rate: number
}

interface ConversionFunnel {
  step: string
  node_id: string
  visitors: number
  drop_off_rate: number
  conversion_rate: number
}

export class AnalyticsService {
  /**
   * Aggregate daily analytics for all chatbots
   * Should be run as a cron job at end of day
   */
  static async aggregateDailyAnalytics(date?: Date): Promise<{
    success: boolean
    processed: number
    errors: string[]
  }> {
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
    const dateStr = targetDate.toISOString().split('T')[0]
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z')

    const errors: string[] = []
    let processed = 0

    try {
      const supabase = await createClient()

      // Get all active chatbots
      const { data: chatbots, error: chatbotError } = await supabase
        .from('chatbots')
        .select('id, organization_id')
        .eq('is_active', true)

      if (chatbotError) {
        return { success: false, processed: 0, errors: [chatbotError.message] }
      }

      for (const chatbot of chatbots || []) {
        try {
          // Get sessions for this chatbot on this date
          const { data: sessions } = await supabase
            .from('chatbot_sessions')
            .select('*')
            .eq('chatbot_id', chatbot.id)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())

          // Get messages for this chatbot on this date
          const { data: messages } = await supabase
            .from('chatbot_messages')
            .select('session_id')
            .eq('chatbot_id', chatbot.id)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())

          // Get leads for this chatbot on this date
          const { data: leads } = await supabase
            .from('online_leads')
            .select('id')
            .eq('chatbot_id', chatbot.id)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())

          const totalSessions = sessions?.length || 0
          const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0
          const uniqueVisitors = new Set(sessions?.map(s => s.visitor_id)).size
          const totalMessages = messages?.length || 0
          const totalLeads = leads?.length || 0

          // Calculate average session duration
          let avgDuration = 0
          if (sessions && sessions.length > 0) {
            const durations = sessions
              .filter(s => s.ended_at)
              .map(s => {
                const start = new Date(s.created_at).getTime()
                const end = new Date(s.ended_at).getTime()
                return (end - start) / 1000 // in seconds
              })
            if (durations.length > 0) {
              avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
            }
          }

          // Calculate completion and bounce rates
          const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
          const bounceSessions = sessions?.filter(s => {
            const msgCount = messages?.filter(m => m.session_id === s.id).length || 0
            return msgCount <= 1
          }).length || 0
          const bounceRate = totalSessions > 0 ? (bounceSessions / totalSessions) * 100 : 0

          // Upsert daily stats
          await supabase
            .from('chatbot_daily_stats')
            .upsert({
              date: dateStr,
              chatbot_id: chatbot.id,
              organization_id: chatbot.organization_id,
              total_sessions: totalSessions,
              completed_sessions: completedSessions,
              total_messages: totalMessages,
              total_leads: totalLeads,
              unique_visitors: uniqueVisitors,
              avg_session_duration: Math.round(avgDuration),
              completion_rate: Math.round(completionRate * 100) / 100,
              bounce_rate: Math.round(bounceRate * 100) / 100,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'date,chatbot_id'
            })

          processed++
        } catch (err) {
          errors.push(`Chatbot ${chatbot.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      return { success: errors.length === 0, processed, errors }
    } catch (error) {
      return {
        success: false,
        processed,
        errors: [error instanceof Error ? error.message : 'Aggregation failed']
      }
    }
  }

  /**
   * Get node-level analytics for a chatbot
   */
  static async getNodeAnalytics(
    chatbotId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; data?: NodeAnalytics[]; error?: string }> {
    try {
      const supabase = await createClient()

      // Get all messages with node tracking
      const { data: messages, error } = await supabase
        .from('chatbot_messages')
        .select('node_id, session_id, created_at')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('node_id', 'is', null)

      if (error) {
        return { success: false, error: error.message }
      }

      // Get flow nodes for this chatbot
      const { data: flow } = await supabase
        .from('chatbot_flows')
        .select('nodes')
        .eq('chatbot_id', chatbotId)
        .eq('is_published', true)
        .maybeSingle()

      const nodes = flow?.nodes || []
      const nodeMap = new Map<string, { type: string; label: string }>()
      nodes.forEach((node: { node_id: string; type: string; data?: { label?: string } }) => {
        nodeMap.set(node.node_id, { type: node.type, label: node.data?.label || node.type })
      })

      // Group messages by node
      const nodeVisits = new Map<string, { sessions: Set<string>; timestamps: number[] }>()

      messages?.forEach(msg => {
        if (!msg.node_id) return
        if (!nodeVisits.has(msg.node_id)) {
          nodeVisits.set(msg.node_id, { sessions: new Set(), timestamps: [] })
        }
        const stats = nodeVisits.get(msg.node_id)!
        stats.sessions.add(msg.session_id)
        stats.timestamps.push(new Date(msg.created_at).getTime())
      })

      // Get completed sessions
      const { data: completedSessions } = await supabase
        .from('chatbot_sessions')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const completedSessionIds = new Set(completedSessions?.map(s => s.id) || [])

      const analytics: NodeAnalytics[] = []
      nodeVisits.forEach((stats, nodeId) => {
        const nodeInfo = nodeMap.get(nodeId)
        const visits = stats.sessions.size
        const completions = [...stats.sessions].filter(s => completedSessionIds.has(s)).length
        const dropOffs = visits - completions

        analytics.push({
          node_id: nodeId,
          node_type: nodeInfo?.type || 'unknown',
          visits,
          completions,
          drop_offs: dropOffs,
          avg_time_spent: 0, // Would need more detailed tracking
          completion_rate: visits > 0 ? Math.round((completions / visits) * 10000) / 100 : 0
        })
      })

      // Sort by visits descending
      analytics.sort((a, b) => b.visits - a.visits)

      return { success: true, data: analytics }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get node analytics'
      }
    }
  }

  /**
   * Get conversion funnel for a chatbot
   */
  static async getConversionFunnel(
    chatbotId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; data?: ConversionFunnel[]; error?: string }> {
    try {
      const supabase = await createClient()

      // Get sessions
      const { data: sessions } = await supabase
        .from('chatbot_sessions')
        .select('id, status')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      // Get leads
      const { data: leads } = await supabase
        .from('online_leads')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      const totalSessions = sessions?.length || 0
      const activeSessions = sessions?.filter(s => s.status !== 'abandoned').length || 0
      const completedSessions = sessions?.filter(s => s.status === 'completed').length || 0
      const totalLeads = leads?.length || 0

      const funnel: ConversionFunnel[] = [
        {
          step: 'Started',
          node_id: 'start',
          visitors: totalSessions,
          drop_off_rate: 0,
          conversion_rate: 100
        },
        {
          step: 'Engaged',
          node_id: 'engaged',
          visitors: activeSessions,
          drop_off_rate: totalSessions > 0
            ? Math.round(((totalSessions - activeSessions) / totalSessions) * 10000) / 100
            : 0,
          conversion_rate: totalSessions > 0
            ? Math.round((activeSessions / totalSessions) * 10000) / 100
            : 0
        },
        {
          step: 'Completed',
          node_id: 'completed',
          visitors: completedSessions,
          drop_off_rate: activeSessions > 0
            ? Math.round(((activeSessions - completedSessions) / activeSessions) * 10000) / 100
            : 0,
          conversion_rate: totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 10000) / 100
            : 0
        },
        {
          step: 'Lead Generated',
          node_id: 'lead',
          visitors: totalLeads,
          drop_off_rate: completedSessions > 0
            ? Math.round(((completedSessions - totalLeads) / completedSessions) * 10000) / 100
            : 0,
          conversion_rate: totalSessions > 0
            ? Math.round((totalLeads / totalSessions) * 10000) / 100
            : 0
        }
      ]

      return { success: true, data: funnel }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversion funnel'
      }
    }
  }

  /**
   * Get real-time analytics for a chatbot
   */
  static async getRealTimeStats(chatbotId: string): Promise<{
    success: boolean
    data?: {
      activeVisitors: number
      sessionsToday: number
      leadsToday: number
      avgResponseTime: number
    }
    error?: string
  }> {
    try {
      const supabase = await createClient()
      const now = new Date()
      const todayStart = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z')
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

      // Active visitors (sessions updated in last 5 minutes)
      const { data: activeSessions } = await supabase
        .from('chatbot_sessions')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .eq('status', 'active')
        .gte('updated_at', fiveMinutesAgo.toISOString())

      // Sessions today
      const { data: todaySessions } = await supabase
        .from('chatbot_sessions')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', todayStart.toISOString())

      // Leads today
      const { data: todayLeads } = await supabase
        .from('online_leads')
        .select('id')
        .eq('chatbot_id', chatbotId)
        .gte('created_at', todayStart.toISOString())

      return {
        success: true,
        data: {
          activeVisitors: activeSessions?.length || 0,
          sessionsToday: todaySessions?.length || 0,
          leadsToday: todayLeads?.length || 0,
          avgResponseTime: 0 // Would need message-level timing
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get real-time stats'
      }
    }
  }

  /**
   * Get analytics summary for date range
   */
  static async getAnalyticsSummary(
    chatbotId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    success: boolean
    data?: {
      totalSessions: number
      totalLeads: number
      conversionRate: number
      avgSessionDuration: number
      topNodes: NodeAnalytics[]
      dailyTrend: { date: string; sessions: number; leads: number }[]
    }
    error?: string
  }> {
    try {
      const supabase = await createClient()

      // Get daily stats
      const { data: dailyStats, error } = await supabase
        .from('chatbot_daily_stats')
        .select('*')
        .eq('chatbot_id', chatbotId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error) {
        return { success: false, error: error.message }
      }

      // Aggregate stats
      const totalSessions = dailyStats?.reduce((sum, d) => sum + (d.total_sessions || 0), 0) || 0
      const totalLeads = dailyStats?.reduce((sum, d) => sum + (d.total_leads || 0), 0) || 0
      const avgDuration = dailyStats && dailyStats.length > 0
        ? dailyStats.reduce((sum, d) => sum + (d.avg_session_duration || 0), 0) / dailyStats.length
        : 0

      const conversionRate = totalSessions > 0
        ? Math.round((totalLeads / totalSessions) * 10000) / 100
        : 0

      // Get top nodes
      const nodeResult = await this.getNodeAnalytics(chatbotId, startDate, endDate)
      const topNodes = nodeResult.data?.slice(0, 5) || []

      // Format daily trend
      const dailyTrend = dailyStats?.map(d => ({
        date: d.date,
        sessions: d.total_sessions || 0,
        leads: d.total_leads || 0
      })) || []

      return {
        success: true,
        data: {
          totalSessions,
          totalLeads,
          conversionRate,
          avgSessionDuration: Math.round(avgDuration),
          topNodes,
          dailyTrend
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics summary'
      }
    }
  }
}

export default AnalyticsService
