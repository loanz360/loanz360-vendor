/**
 * SmartPing/VCon SMS Webhook Handler
 * Handles delivery status updates from SmartPing SMS gateway
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SmartPingWebhookPayload {
  messageId?: string
  requestId?: string
  mobile?: string
  status?: string
  deliveredTime?: string
  errorCode?: string
  errorMessage?: string
  dltTemplateId?: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const payload: SmartPingWebhookPayload = await request.json()


    const supabase = createSupabaseAdmin()

    // Store the webhook event
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        provider_name: 'smartping',
        event_type: payload.status || 'unknown',
        external_message_id: payload.messageId || payload.requestId,
        raw_payload: payload,
        parsed_data: {
          mobile: payload.mobile,
          status: payload.status,
          deliveredTime: payload.deliveredTime,
          errorCode: payload.errorCode,
          errorMessage: payload.errorMessage
        },
        status: 'received',
        received_at: new Date().toISOString()
      })
      .select('id')
      .maybeSingle()

    if (webhookError) {
      apiLogger.error('[Webhook:SmartPing] Failed to store event', webhookError)
    }

    // Map SmartPing status to our internal status
    const statusMapping: Record<string, string> = {
      'DELIVERED': 'delivered',
      'SENT': 'sent',
      'FAILED': 'failed',
      'REJECTED': 'failed',
      'PENDING': 'queued',
      'SUBMITTED': 'sent',
      'UNDELIVERED': 'failed'
    }

    const internalStatus = statusMapping[payload.status?.toUpperCase() || ''] || 'unknown'
    const externalId = payload.messageId || payload.requestId

    if (!externalId) {
      return NextResponse.json({ success: true, message: 'No message ID' })
    }

    // Update delivery log
    const { error: updateError } = await supabase
      .from('communication_delivery_log')
      .update({
        delivery_status: internalStatus,
        delivered_at: internalStatus === 'delivered' ? payload.deliveredTime || new Date().toISOString() : null,
        error_code: payload.errorCode,
        error_message: payload.errorMessage,
        provider_response_payload: payload,
        updated_at: new Date().toISOString()
      })
      .eq('provider_message_id', externalId)

    if (updateError) {
      apiLogger.error('[Webhook:SmartPing] Failed to update delivery log', updateError)
    }

    // Update message queue if exists
    await supabase
      .from('message_queue')
      .update({
        status: internalStatus === 'delivered' ? 'delivered' : internalStatus === 'failed' ? 'failed' : 'sent',
        delivered_at: internalStatus === 'delivered' ? new Date().toISOString() : null,
        error_message: payload.errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('external_message_id', externalId)

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
      processingTimeMs: processingTime
    })
  } catch (error: unknown) {
    apiLogger.error('[Webhook:SmartPing] Error', error)

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'smartping',
    message: 'Webhook endpoint active'
  })
}
