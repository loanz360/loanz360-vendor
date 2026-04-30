/**
 * Real-Time Activity Feed SSE Stream
 * Server-Sent Events endpoint for live activity updates
 */

import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

// Track connected clients for cleanup
const clients = new Set<ReadableStreamDefaultController>()

export async function GET(request: NextRequest) {
  const supabase = createSupabaseAdmin()

  // Parse filter parameters from query string
  const { searchParams } = new URL(request.url)
  const categories = searchParams.get('categories')?.split(',').filter(Boolean)
  const severityLevels = searchParams.get('severity_levels')?.split(',').filter(Boolean)
  const securityOnly = searchParams.get('security_only') === 'true'

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller)

      // Helper to send events
      const sendEvent = (type: string, data: unknown) => {
        try {
          const event = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(event))
        } catch (error) {
          apiLogger.error('[SSE] Error sending event', error)
        }
      }

      // Send initial connection event
      sendEvent('connected', {
        message: 'Connected to real-time activity feed',
        timestamp: new Date().toISOString()
      })

      // Heartbeat interval to keep connection alive
      const heartbeatInterval = setInterval(() => {
        sendEvent('heartbeat', {
          timestamp: new Date().toISOString()
        })
      }, 30000) // Every 30 seconds

      // Poll for new activities every 2 seconds
      let lastCheckedAt = new Date().toISOString()

      const pollInterval = setInterval(async () => {
        try {
          // Build query for new activities
          let query = supabase
            .from('realtime_activities')
            .select('*')
            .gt('created_at', lastCheckedAt)
            .order('created_at', { ascending: false })
            .limit(10)

          // Apply filters
          if (categories?.length) {
            query = query.in('event_category', categories)
          }

          if (severityLevels?.length) {
            query = query.in('severity_level', severityLevels)
          }

          if (securityOnly) {
            query = query.eq('is_security_event', true)
          }

          const { data: newActivities, error } = await query

          if (error) {
            apiLogger.error('[SSE] Poll error', error)
            return
          }

          if (newActivities && newActivities.length > 0) {
            // Send each new activity
            for (const activity of newActivities.reverse()) {
              sendEvent('activity', activity)
            }

            // Update last checked timestamp
            lastCheckedAt = newActivities[0].created_at
          }
        } catch (error) {
          apiLogger.error('[SSE] Poll exception', error)
        }
      }, 2000) // Poll every 2 seconds

      // Get statistics update every 30 seconds
      const statsInterval = setInterval(async () => {
        try {
          const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

          // Get summary stats
          const { data: stats, error } = await supabase
            .from('realtime_activities')
            .select('severity_level, is_security_event, is_suspicious')
            .gte('created_at', startDate)

          if (!error && stats) {
            const summary = {
              total: stats.length,
              critical: stats.filter(s => s.severity_level === 'critical').length,
              errors: stats.filter(s => s.severity_level === 'error').length,
              warnings: stats.filter(s => s.severity_level === 'warning').length,
              security: stats.filter(s => s.is_security_event).length,
              suspicious: stats.filter(s => s.is_suspicious).length
            }

            sendEvent('stats_update', {
              ...summary,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          apiLogger.error('[SSE] Stats error', error)
        }
      }, 30000) // Every 30 seconds

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        clearInterval(pollInterval)
        clearInterval(statsInterval)
        clients.delete(controller)
        controller.close()
      })
    },

    cancel() {
      // Cleanup handled in abort event
    }
  })

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    }
  })
}
