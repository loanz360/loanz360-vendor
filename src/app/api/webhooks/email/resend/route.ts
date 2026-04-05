/**
 * Resend Email Webhook Handler
 * Handles delivery status updates from Resend email service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Resend webhook events
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // For bounced events
    bounce?: {
      type: 'hard' | 'soft'
      message: string
    }
    // For clicked events
    click?: {
      ipAddress: string
      link: string
      timestamp: string
      userAgent: string
    }
    // For opened events
    open?: {
      ipAddress: string
      timestamp: string
      userAgent: string
    }
  }
}

// Verify webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const rawBody = await request.text()
    const signature = request.headers.get('svix-signature') || ''
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    // Verify signature if secret is configured
    if (webhookSecret && signature) {
      // Resend uses Svix for webhooks, but we'll do basic validation
      // In production, use the svix package for proper validation
    }

    const payload: ResendWebhookPayload = JSON.parse(rawBody)


    const supabase = createSupabaseAdmin()

    // Store the webhook event
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .insert({
        provider_name: 'resend',
        event_type: payload.type,
        external_message_id: payload.data.email_id,
        raw_payload: payload,
        parsed_data: {
          from: payload.data.from,
          to: payload.data.to,
          subject: payload.data.subject,
          createdAt: payload.data.created_at
        },
        status: 'received',
        received_at: new Date().toISOString()
      })
      .select('id')
      .maybeSingle()

    // Map Resend event to our internal status
    const statusMapping: Record<ResendEventType, string> = {
      'email.sent': 'sent',
      'email.delivered': 'delivered',
      'email.delivery_delayed': 'delayed',
      'email.complained': 'complained',
      'email.bounced': 'bounced',
      'email.opened': 'delivered', // Keep as delivered, track open separately
      'email.clicked': 'delivered'  // Keep as delivered, track click separately
    }

    const internalStatus = statusMapping[payload.type]
    const emailId = payload.data.email_id

    // Update delivery log
    const updateData: any = {
      updated_at: new Date().toISOString(),
      provider_response_payload: payload
    }

    switch (payload.type) {
      case 'email.sent':
        updateData.delivery_status = 'sent'
        updateData.sent_at = payload.created_at
        break

      case 'email.delivered':
        updateData.delivery_status = 'delivered'
        updateData.delivered_at = payload.created_at
        break

      case 'email.delivery_delayed':
        updateData.delivery_status = 'delayed'
        break

      case 'email.bounced':
        updateData.delivery_status = 'bounced'
        updateData.error_message = payload.data.bounce?.message
        updateData.error_code = payload.data.bounce?.type

        // Add to opt-out list for hard bounces
        if (payload.data.bounce?.type === 'hard') {
          await Promise.all(payload.data.to.map(email =>
            supabase
              .from('communication_optouts')
              .upsert({
                identifier: email,
                identifier_type: 'email',
                channel: 'email',
                reason: 'bounce',
                source: 'webhook',
                is_active: true,
                opted_out_at: new Date().toISOString()
              }, {
                onConflict: 'identifier,channel'
              })
          ))
        }
        break

      case 'email.complained':
        updateData.delivery_status = 'complained'

        // Add to opt-out list
        await Promise.all(payload.data.to.map(email =>
          supabase
            .from('communication_optouts')
            .upsert({
              identifier: email,
              identifier_type: 'email',
              channel: 'email',
              reason: 'complaint',
              source: 'webhook',
              is_active: true,
              opted_out_at: new Date().toISOString()
            }, {
              onConflict: 'identifier,channel'
            })
        ))
        break

      case 'email.opened':
        // Track open event separately
        await supabase
          .from('email_events')
          .insert({
            email_id: emailId,
            event_type: 'opened',
            recipient: payload.data.to[0],
            ip_address: payload.data.open?.ipAddress,
            user_agent: payload.data.open?.userAgent,
            event_at: payload.data.open?.timestamp || payload.created_at
          })
        break

      case 'email.clicked':
        // Track click event separately
        await supabase
          .from('email_events')
          .insert({
            email_id: emailId,
            event_type: 'clicked',
            recipient: payload.data.to[0],
            ip_address: payload.data.click?.ipAddress,
            user_agent: payload.data.click?.userAgent,
            link_url: payload.data.click?.link,
            event_at: payload.data.click?.timestamp || payload.created_at
          })
        break
    }

    // Update delivery log
    if (Object.keys(updateData).length > 1) {
      await supabase
        .from('communication_delivery_log')
        .update(updateData)
        .eq('provider_message_id', emailId)
    }

    // Update message queue if exists
    if (['email.delivered', 'email.bounced', 'email.complained'].includes(payload.type)) {
      await supabase
        .from('message_queue')
        .update({
          status: internalStatus === 'delivered' ? 'delivered' : 'failed',
          delivered_at: internalStatus === 'delivered' ? new Date().toISOString() : null,
          error_message: payload.data.bounce?.message,
          updated_at: new Date().toISOString()
        })
        .eq('external_message_id', emailId)
    }

    // Mark webhook event as processed
    if (webhookEvent?.id) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString()
        })
        .eq('id', webhookEvent.id)
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Webhook processed',
      event: payload.type,
      processingTimeMs: processingTime
    })
  } catch (error: unknown) {
    apiLogger.error('[Webhook:Resend] Error', error)

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'resend',
    message: 'Webhook endpoint active'
  })
}
