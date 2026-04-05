/**
 * CRO Real-time Events API (Server-Sent Events)
 *
 * Enterprise-grade real-time updates for CRM dashboard
 * Features:
 * - Server-Sent Events for live updates
 * - Heartbeat to keep connection alive
 * - Event filtering by type
 * - Connection management
 */

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Event types
type EventType = 'lead_created' | 'lead_updated' | 'lead_converted' | 'contact_updated' | 'deal_created'

interface SSEEvent {
  type: EventType
  data: Record<string, unknown>
  timestamp: string
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = user.id

  // Create a readable stream for SSE
  const encoder = new TextEncoder()
  let isConnectionOpen = true

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      const connectEvent = formatSSEMessage({
        type: 'connected',
        message: 'Real-time events connected',
        userId,
      })
      controller.enqueue(encoder.encode(connectEvent))

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isConnectionOpen) {
          clearInterval(heartbeatInterval)
          return
        }

        const heartbeat = formatSSEMessage({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
        })
        try {
          controller.enqueue(encoder.encode(heartbeat))
        } catch {
          clearInterval(heartbeatInterval)
          isConnectionOpen = false
        }
      }, 30000) // Every 30 seconds

      // Subscribe to Supabase realtime changes
      const channel = supabase
        .channel(`cro-events-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'crm_leads',
            filter: `cro_id=eq.${userId}`,
          },
          (payload) => {
            if (!isConnectionOpen) return
            const event = formatSSEMessage({
              type: 'lead_created',
              data: payload.new,
              timestamp: new Date().toISOString(),
            })
            try {
              controller.enqueue(encoder.encode(event))
            } catch {
              isConnectionOpen = false
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'crm_leads',
            filter: `cro_id=eq.${userId}`,
          },
          (payload) => {
            if (!isConnectionOpen) return
            const eventType = payload.new.status === 'converted' ? 'lead_converted' : 'lead_updated'
            const event = formatSSEMessage({
              type: eventType,
              data: payload.new,
              old: payload.old,
              timestamp: new Date().toISOString(),
            })
            try {
              controller.enqueue(encoder.encode(event))
            } catch {
              isConnectionOpen = false
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'crm_contacts',
            filter: `cro_id=eq.${userId}`,
          },
          (payload) => {
            if (!isConnectionOpen) return
            const event = formatSSEMessage({
              type: 'contact_updated',
              data: payload.new,
              timestamp: new Date().toISOString(),
            })
            try {
              controller.enqueue(encoder.encode(event))
            } catch {
              isConnectionOpen = false
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'crm_deals',
            filter: `cro_id=eq.${userId}`,
          },
          (payload) => {
            if (!isConnectionOpen) return
            const event = formatSSEMessage({
              type: 'deal_created',
              data: payload.new,
              timestamp: new Date().toISOString(),
            })
            try {
              controller.enqueue(encoder.encode(event))
            } catch {
              isConnectionOpen = false
            }
          }
        )
        .subscribe()

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        isConnectionOpen = false
        clearInterval(heartbeatInterval)
        supabase.removeChannel(channel)
        controller.close()
      })
    },
    cancel() {
      isConnectionOpen = false
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}

/**
 * Format data as SSE message
 */
function formatSSEMessage(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}
