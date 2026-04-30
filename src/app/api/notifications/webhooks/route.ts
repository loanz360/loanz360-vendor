
// Delivery Webhooks Handler
// POST: Handle delivery status updates from providers

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.text()
    const provider = request.headers.get('x-provider') || detectProvider(request)

    // Verify webhook signature if available
    const signature = request.headers.get('x-webhook-signature') ||
                     request.headers.get('x-sendgrid-signature') ||
                     request.headers.get('x-mailgun-signature')

    if (signature && !verifySignature(provider, body, signature)) {
      apiLogger.error('Invalid webhook signature')
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const events = normalizeEvents(provider, payload)

    for (const event of events) {
      // Update delivery log status
      if (event.message_id) {
        await supabase
          .from('communication_delivery_logs')
          .update({
            status: event.status,
            error: event.error,
            delivered_at: event.status === 'delivered' ? new Date().toISOString() : undefined,
            bounced_at: event.status === 'bounced' ? new Date().toISOString() : undefined,
            opened_at: event.status === 'opened' ? new Date().toISOString() : undefined,
            clicked_at: event.status === 'clicked' ? new Date().toISOString() : undefined,
            updated_at: new Date().toISOString()
          })
          .eq('message_id', event.message_id)

        // Also update notification_logs if exists
        await supabase
          .from('notification_logs')
          .update({
            status: event.status,
            updated_at: new Date().toISOString()
          })
          .eq('external_id', event.message_id)
      }

      // Log webhook event
      await supabase
        .from('webhook_events')
        .insert({
          provider,
          event_type: event.type,
          message_id: event.message_id,
          recipient: event.recipient,
          status: event.status,
          error: event.error,
          raw_payload: payload,
          created_at: new Date().toISOString()
        })

      // Handle bounces and complaints
      if (event.status === 'bounced' || event.status === 'complained') {
        await handleBounceOrComplaint(supabase, event)
      }
    }

    return NextResponse.json({ success: true, processed: events.length })
  } catch (error) {
    apiLogger.error('Webhook error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function detectProvider(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || ''
  if (userAgent.includes('SendGrid')) return 'sendgrid'
  if (userAgent.includes('Mailgun')) return 'mailgun'
  if (userAgent.includes('Postmark')) return 'postmark'
  if (userAgent.includes('MSG91')) return 'msg91'
  return 'unknown'
}

function verifySignature(provider: string, body: string, signature: string): boolean {
  // Get webhook secret from environment
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`]
  if (!secret) return true // Skip verification if no secret configured

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

interface NormalizedEvent {
  type: string
  message_id?: string
  recipient?: string
  status: string
  error?: string
  timestamp?: string
}

function normalizeEvents(provider: string, payload: Record<string, any>): NormalizedEvent[] {
  const events: NormalizedEvent[] = []

  switch (provider) {
    case 'sendgrid':
      // SendGrid sends array of events
      const sgEvents = Array.isArray(payload) ? payload : [payload]
      for (const e of sgEvents) {
        events.push({
          type: e.event,
          message_id: e.sg_message_id,
          recipient: e.email,
          status: mapSendGridStatus(e.event),
          error: e.reason,
          timestamp: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : undefined
        })
      }
      break

    case 'mailgun':
      const mgData = payload['event-data'] || payload
      events.push({
        type: mgData.event,
        message_id: mgData.message?.headers?.['message-id'],
        recipient: mgData.recipient,
        status: mapMailgunStatus(mgData.event),
        error: mgData['delivery-status']?.message,
        timestamp: mgData.timestamp ? new Date(mgData.timestamp * 1000).toISOString() : undefined
      })
      break

    case 'postmark':
      events.push({
        type: payload.RecordType,
        message_id: payload.MessageID,
        recipient: payload.Recipient || payload.Email,
        status: mapPostmarkStatus(payload.RecordType),
        error: payload.Description,
        timestamp: payload.DeliveredAt || payload.BouncedAt
      })
      break

    case 'msg91':
      events.push({
        type: payload.status,
        message_id: payload.requestId,
        recipient: payload.mobile,
        status: mapMSG91Status(payload.status),
        error: payload.desc,
        timestamp: payload.date
      })
      break

    case 'resend':
      events.push({
        type: payload.type,
        message_id: payload.data?.email_id,
        recipient: payload.data?.to?.[0],
        status: mapResendStatus(payload.type),
        error: payload.data?.error?.message,
        timestamp: payload.created_at
      })
      break

    default:
      events.push({
        type: payload.event || payload.type || 'unknown',
        message_id: payload.message_id || payload.messageId,
        recipient: payload.recipient || payload.to || payload.email,
        status: payload.status || 'unknown',
        error: payload.error || payload.reason
      })
  }

  return events
}

function mapSendGridStatus(event: string): string {
  const statusMap: Record<string, string> = {
    processed: 'sent',
    delivered: 'delivered',
    open: 'opened',
    click: 'clicked',
    bounce: 'bounced',
    dropped: 'failed',
    deferred: 'pending',
    spamreport: 'complained',
    unsubscribe: 'unsubscribed'
  }
  return statusMap[event] || event
}

function mapMailgunStatus(event: string): string {
  const statusMap: Record<string, string> = {
    accepted: 'sent',
    delivered: 'delivered',
    opened: 'opened',
    clicked: 'clicked',
    failed: 'failed',
    bounced: 'bounced',
    complained: 'complained',
    unsubscribed: 'unsubscribed'
  }
  return statusMap[event] || event
}

function mapPostmarkStatus(recordType: string): string {
  const statusMap: Record<string, string> = {
    Delivery: 'delivered',
    Bounce: 'bounced',
    SpamComplaint: 'complained',
    Open: 'opened',
    Click: 'clicked',
    SubscriptionChange: 'unsubscribed'
  }
  return statusMap[recordType] || recordType.toLowerCase()
}

function mapMSG91Status(status: string): string {
  const statusMap: Record<string, string> = {
    '1': 'sent',
    '2': 'failed',
    '3': 'delivered',
    '5': 'pending',
    '6': 'failed',
    '7': 'failed',
    DELIVRD: 'delivered',
    FAILED: 'failed',
    PENDING: 'pending'
  }
  return statusMap[status] || status
}

function mapResendStatus(type: string): string {
  const statusMap: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained'
  }
  return statusMap[type] || type.replace('email.', '')
}

async function handleBounceOrComplaint(supabase: Awaited<ReturnType<typeof createClient>>, event: NormalizedEvent) {
  if (!event.recipient) return

  try {
    // Add to suppression list
    await supabase.from('communication_suppressions').upsert({
      email: event.recipient,
      reason: event.status,
      source: 'webhook',
      provider_response: event.error,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'email'
    })

    // If complaint, also unsubscribe
    if (event.status === 'complained') {
      await supabase.from('notification_unsubscribes').upsert({
        email: event.recipient,
        channel: 'email',
        source: 'complaint',
        unsubscribed_at: new Date().toISOString()
      }, {
        onConflict: 'email,channel'
      })
    }
  } catch (error) {
    apiLogger.error('Error handling bounce/complaint', error)
  }
}
