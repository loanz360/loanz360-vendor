import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * GET /api/realtime/stream
 * Server-Sent Events endpoint for real-time notifications
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let isConnectionClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const connectMessage = `data: ${JSON.stringify({ type: 'connected', user_id: user.id })}\n\n`
      controller.enqueue(encoder.encode(connectMessage))

      // Update user presence
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        status: 'online',
        last_seen_at: new Date().toISOString()
      })

      // Poll for new notifications every 5 seconds
      const pollInterval = setInterval(async () => {
        if (isConnectionClosed) {
          clearInterval(pollInterval)
          return
        }

        try {
          // Get unread notifications
          const { data: notifications } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .eq('read', false)
            .eq('delivered', false)
            .order('created_at', { ascending: false })
            .limit(10)

          if (notifications && notifications.length > 0) {
            for (const notification of notifications) {
              const message = `data: ${JSON.stringify({
                type: 'notification',
                notification: {
                  id: notification.id,
                  type: notification.type,
                  title: notification.title,
                  message: notification.message,
                  data: notification.data,
                  created_at: notification.created_at
                }
              })}\n\n`

              controller.enqueue(encoder.encode(message))

              // Mark as delivered
              await supabase
                .from('notifications')
                .update({ delivered: true })
                .eq('id', notification.id)
            }
          }

          // Send heartbeat
          const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`
          controller.enqueue(encoder.encode(heartbeat))

          // Update presence
          await supabase.from('user_presence').upsert({
            user_id: user.id,
            status: 'online',
            last_seen_at: new Date().toISOString()
          })
        } catch (error) {
          apiLogger.error('SSE poll error', error)
        }
      }, 5000)

      // Handle connection close
      request.signal.addEventListener('abort', () => {
        isConnectionClosed = true
        clearInterval(pollInterval)

        // Update presence to offline
        supabase.from('user_presence').upsert({
          user_id: user.id,
          status: 'offline',
          last_seen_at: new Date().toISOString()
        })
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
