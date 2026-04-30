/**
 * MSG91 SMS Webhook Handler
 * Handles delivery status updates from MSG91 SMS gateway
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

interface MSG91WebhookPayload {
  requestId?: string
  report?: Array<{
    date: string
    number: string
    status: string
    desc?: string
  }>
  // Alternative format
  mobile?: string
  status?: string
  senttime?: string
  donetime?: string
  reason?: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const payload: MSG91WebhookPayload = await request.json()


    const supabase = createSupabaseAdmin()

    // Store the webhook event
    const { data: webhookEvent } = await supabase
      .from('webhook_events')
      .insert({
        provider_name: 'msg91',
        event_type: payload.report?.[0]?.status || payload.status || 'unknown',
        external_message_id: payload.requestId,
        raw_payload: payload,
        status: 'received',
        received_at: new Date().toISOString()
      })
      .select('id')
      .maybeSingle()

    // Map MSG91 status to our internal status
    const statusMapping: Record<string, string> = {
      '1': 'delivered',
      '2': 'failed',
      '3': 'delivered',
      '5': 'queued',
      '6': 'sent',
      '7': 'sent',
      '9': 'failed',
      '16': 'failed',
      '17': 'failed',
      '25': 'failed',
      '26': 'failed',
      'DELIVERED': 'delivered',
      'DELIVRD': 'delivered',
      'FAILED': 'failed',
      'REJECT': 'failed',
      'SUBMITTED': 'sent',
      'PENDING': 'queued'
    }

    // Handle batch report format
    if (payload.report && Array.isArray(payload.report)) {
      for (const report of payload.report) {
        const internalStatus = statusMapping[report.status?.toUpperCase() || report.status || ''] || 'unknown'

        await supabase
          .from('communication_delivery_log')
          .update({
            delivery_status: internalStatus,
            delivered_at: internalStatus === 'delivered' ? new Date().toISOString() : null,
            error_message: report.desc,
            provider_response_payload: report,
            updated_at: new Date().toISOString()
          })
          .eq('provider_message_id', payload.requestId)
          .eq('recipient', report.number)
      }
    } else if (payload.requestId) {
      // Handle single message format
      const internalStatus = statusMapping[payload.status || ''] || 'unknown'

      await supabase
        .from('communication_delivery_log')
        .update({
          delivery_status: internalStatus,
          delivered_at: internalStatus === 'delivered' ? payload.donetime || new Date().toISOString() : null,
          error_message: payload.reason,
          provider_response_payload: payload,
          updated_at: new Date().toISOString()
        })
        .eq('provider_message_id', payload.requestId)

      // Update message queue if exists
      await supabase
        .from('message_queue')
        .update({
          status: internalStatus === 'delivered' ? 'delivered' : internalStatus === 'failed' ? 'failed' : 'sent',
          delivered_at: internalStatus === 'delivered' ? new Date().toISOString() : null,
          error_message: payload.reason,
          updated_at: new Date().toISOString()
        })
        .eq('external_message_id', payload.requestId)
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
      processingTimeMs: processingTime
    })
  } catch (error: unknown) {
    apiLogger.error('[Webhook:MSG91] Error', error)

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'msg91',
    message: 'Webhook endpoint active'
  })
}
