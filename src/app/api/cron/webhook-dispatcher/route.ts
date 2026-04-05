export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cron/webhook-dispatcher
 * Processes pending webhook deliveries from the queue.
 * Triggered by Vercel Cron every minute.
 *
 * Authorization: Bearer CRON_SECRET
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch pending deliveries (max 50 per run to stay within timeout)
    const now = new Date().toISOString()
    const { data: pending, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select('*, webhook_endpoints(url, secret, name, custom_headers, is_active)')
      .eq('status', 'pending')
      .lte('next_retry_at', now)
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      apiLogger.error('Webhook dispatcher: failed to fetch pending deliveries', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch deliveries' }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    let success = 0
    let failed = 0

    await Promise.allSettled(
      pending.map(async (delivery) => {
        const endpoint = delivery.webhook_endpoints as any
        if (!endpoint || !endpoint.is_active) {
          // Cancel delivery for inactive/deleted endpoints
          await supabase
            .from('webhook_deliveries')
            .update({ status: 'cancelled' })
            .eq('id', delivery.id)
          return
        }

        const payloadString = JSON.stringify(delivery.payload)
        const signature = generateSignature(payloadString, endpoint.secret || '')
        const attemptNumber = (delivery.attempt_number || 0) + 1
        const maxAttempts = delivery.max_attempts || 3

        try {
          const startTime = Date.now()
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': delivery.event_type,
              'X-Webhook-ID': delivery.id,
              'X-Webhook-Timestamp': delivery.created_at,
              'User-Agent': 'LOANZ360-Webhooks/1.0',
              ...(endpoint.custom_headers || {}),
            },
            body: payloadString,
            signal: AbortSignal.timeout(15000),
          })

          const duration = Date.now() - startTime
          const responseBody = (await response.text()).substring(0, 1000)

          if (response.ok) {
            await supabase
              .from('webhook_deliveries')
              .update({
                status: 'success',
                http_status: response.status,
                response_body: responseBody,
                duration_ms: duration,
                attempt_number: attemptNumber,
                sent_at: new Date().toISOString(),
              })
              .eq('id', delivery.id)
            success++
          } else {
            // Failed — schedule retry if attempts remain
            const shouldRetry = attemptNumber < maxAttempts
            const nextRetry = shouldRetry
              ? new Date(Date.now() + Math.pow(2, attemptNumber) * 60 * 1000).toISOString()
              : null

            await supabase
              .from('webhook_deliveries')
              .update({
                status: shouldRetry ? 'pending' : 'failed',
                http_status: response.status,
                response_body: responseBody,
                duration_ms: duration,
                attempt_number: attemptNumber,
                next_retry_at: nextRetry,
              })
              .eq('id', delivery.id)
            failed++
          }
        } catch (err: unknown) {
          // Network error — schedule retry if attempts remain
          const shouldRetry = attemptNumber < maxAttempts
          const nextRetry = shouldRetry
            ? new Date(Date.now() + Math.pow(2, attemptNumber) * 60 * 1000).toISOString()
            : null

          await supabase
            .from('webhook_deliveries')
            .update({
              status: shouldRetry ? 'pending' : 'failed',
              error_message: err.message,
              attempt_number: attemptNumber,
              next_retry_at: nextRetry,
            })
            .eq('id', delivery.id)
          failed++

          apiLogger.error(`Webhook dispatcher: delivery failed for ${endpoint.name}`, err)
        }
      })
    )

    return NextResponse.json({
      success: true,
      processed: pending.length,
      successful: success,
      failed,
    })
  } catch (error) {
    apiLogger.error('Webhook dispatcher error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
