export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/webhooks/resend
 * Receive delivery status updates from Resend
 *
 * Resend sends webhooks for:
 * - email.sent
 * - email.delivered
 * - email.delivery_delayed
 * - email.bounced
 * - email.complained
 *
 * Documentation: https://resend.com/docs/dashboard/webhooks/introduction
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('svix-signature')
    const timestamp = request.headers.get('svix-timestamp')
    const webhookId = request.headers.get('svix-id')

    if (!signature || !timestamp || !webhookId) {
      apiLogger.error('[Resend Webhook] Missing required headers')
      return NextResponse.json(
        { error: 'Missing webhook headers' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.text()

    // Verify signature (if RESEND_WEBHOOK_SECRET is configured)
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const isValid = verifyResendSignature(body, signature, timestamp, webhookSecret)
      if (!isValid) {
        apiLogger.error('[Resend Webhook] Invalid signature')
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      }
    }

    // Parse webhook data
    const event = JSON.parse(body)

    const supabase = await createClient()

    // Handle different event types
    switch (event.type) {
      case 'email.sent':
        await handleEmailSent(supabase, event.data)
        break

      case 'email.delivered':
        await handleEmailDelivered(supabase, event.data)
        break

      case 'email.delivery_delayed':
        await handleEmailDelayed(supabase, event.data)
        break

      case 'email.bounced':
        await handleEmailBounced(supabase, event.data)
        break

      case 'email.complained':
        await handleEmailComplained(supabase, event.data)
        break

      default:
    }

    return NextResponse.json({ success: true, received: true })
  } catch (error: unknown) {
    apiLogger.error('[Resend Webhook] Error processing webhook', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to verify Resend webhook signature
function verifyResendSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    // Resend uses HMAC SHA256 for webhook signatures
    const signedContent = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex')

    // Extract signature from header (format: "v1,signature")
    const actualSignature = signature.split(',')[1]

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(actualSignature)
    )
  } catch (error) {
    apiLogger.error('[Resend Webhook] Signature verification error', error)
    return false
  }
}

// Event handlers
async function handleEmailSent(supabase: any, data: any) {
  const { email_id, to, from } = data

  await supabase
    .from('notification_delivery_log')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('external_id', email_id)
}

async function handleEmailDelivered(supabase: any, data: any) {
  const { email_id, to } = data

  await supabase
    .from('notification_delivery_log')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString()
    })
    .eq('external_id', email_id)

}

async function handleEmailDelayed(supabase: any, data: any) {
  const { email_id, to, reason } = data

  await supabase
    .from('notification_delivery_log')
    .update({
      status: 'pending',
      error_message: `Delivery delayed: ${reason}`
    })
    .eq('external_id', email_id)

}

async function handleEmailBounced(supabase: any, data: any) {
  const { email_id, to, bounce_type, bounce_reason } = data

  await supabase
    .from('notification_delivery_log')
    .update({
      status: 'bounced',
      error_message: `Bounced (${bounce_type}): ${bounce_reason}`
    })
    .eq('external_id', email_id)

  // Mark user email as invalid if hard bounce
  if (bounce_type === 'hard') {
    // You might want to mark the user's email as invalid
    apiLogger.error(`[Resend Webhook] Hard bounce for ${to} - email may be invalid`)
  }

}

async function handleEmailComplained(supabase: any, data: any) {
  const { email_id, to } = data

  await supabase
    .from('notification_delivery_log')
    .update({
      status: 'failed',
      error_message: 'User marked as spam'
    })
    .eq('external_id', email_id)

  // You might want to automatically unsubscribe the user
}
