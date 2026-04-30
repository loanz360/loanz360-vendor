/**
 * Webhook Trigger System
 * Triggers webhooks for lead events across all systems
 * Supports: lead.created, lead.assigned, lead.status_changed, etc.
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// Event Types
// ============================================================================
export type WebhookEvent =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.deleted'
  | 'lead.assigned'
  | 'lead.status_changed'
  | 'lead.form_submitted'
  | 'lead.form_completed'
  | 'lead.converted'
  | 'lead.rejected'

export interface WebhookPayload {
  event: WebhookEvent
  data: unknown  timestamp: string
  id: string
}

// ============================================================================
// HMAC Signature Generation
// ============================================================================
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

// ============================================================================
// Trigger Webhook
// ============================================================================
/**
 * Triggers webhooks for a specific event
 * @param event - The event type (e.g., 'lead.created')
 * @param data - The event data
 */
export async function triggerWebhook(event: WebhookEvent, data: unknown): Promise<void> {
  try {
    // 1. Fetch active webhook endpoints subscribed to this event
    const { data: endpoints, error: fetchError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('is_active', true)
      .contains('subscribed_events', [event])

    if (fetchError) {
      console.error('[Webhook Trigger] Error fetching endpoints:', fetchError)
      return
    }

    if (!endpoints || endpoints.length === 0) {
      // No webhooks subscribed to this event - that's OK
      return
    }

    // 2. Create webhook payload
    const webhookId = crypto.randomUUID()
    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      id: webhookId,
    }

    const payloadString = JSON.stringify(payload)

    // 3. Send webhook to each endpoint
    const deliveryPromises = endpoints.map(async (endpoint) => {
      try {
        // Generate HMAC signature
        const signature = generateSignature(payloadString, endpoint.secret)

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-ID': webhookId,
          'X-Webhook-Timestamp': payload.timestamp,
          'User-Agent': 'LOANZ360-Webhooks/1.0',
          ...(endpoint.custom_headers || {}),
        }

        // Send HTTP request
        const startTime = Date.now()
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })

        const duration = Date.now() - startTime
        const responseBody = await response.text()

        // Log delivery
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event_type: event,
          payload,
          http_status: response.status,
          response_body: responseBody.substring(0, 1000), // Limit to 1KB
          duration_ms: duration,
          success: response.ok,
          retry_count: 0,
        })

        if (!response.ok) {
          console.error(`[Webhook Trigger] Delivery failed for ${endpoint.name}: ${response.status}`)
          // Trigger retry logic (handled by database trigger)
        }
      } catch (error: unknown) {
        console.error(`[Webhook Trigger] Error delivering to ${endpoint.name}:`, error)

        // Log failed delivery
        await supabase.from('webhook_deliveries').insert({
          webhook_endpoint_id: endpoint.id,
          event_type: event,
          payload,
          http_status: 0,
          error_message: error.message,
          success: false,
          retry_count: 0,
        })
      }
    })

    // Wait for all deliveries (but don't block on them)
    await Promise.allSettled(deliveryPromises)
  } catch (error) {
    console.error('[Webhook Trigger] Unexpected error:', error)
  }
}

// ============================================================================
// Convenience Functions for Common Events
// ============================================================================

export async function triggerLeadCreated(leadData: unknown): Promise<void> {
  await triggerWebhook('lead.created', leadData)
}

export async function triggerLeadAssigned(leadId: string, croId: string, croName: string): Promise<void> {
  await triggerWebhook('lead.assigned', {
    lead_id: leadId,
    cro_id: croId,
    cro_name: croName,
    assigned_at: new Date().toISOString(),
  })
}

export async function triggerLeadStatusChanged(
  leadId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  await triggerWebhook('lead.status_changed', {
    lead_id: leadId,
    old_status: oldStatus,
    new_status: newStatus,
    changed_at: new Date().toISOString(),
  })
}

export async function triggerFormSubmitted(leadId: string, formData: unknown): Promise<void> {
  await triggerWebhook('lead.form_submitted', {
    lead_id: leadId,
    form_data: formData,
    submitted_at: new Date().toISOString(),
  })
}

export async function triggerFormCompleted(leadId: string): Promise<void> {
  await triggerWebhook('lead.form_completed', {
    lead_id: leadId,
    completed_at: new Date().toISOString(),
  })
}

export async function triggerLeadConverted(leadId: string, conversionData: unknown): Promise<void> {
  await triggerWebhook('lead.converted', {
    lead_id: leadId,
    conversion_data: conversionData,
    converted_at: new Date().toISOString(),
  })
}

export async function triggerLeadRejected(leadId: string, reason: string): Promise<void> {
  await triggerWebhook('lead.rejected', {
    lead_id: leadId,
    rejection_reason: reason,
    rejected_at: new Date().toISOString(),
  })
}
