
/**
 * Webhook Handler for Lead Updates
 * Automatically updates incentive progress when leads are converted/updated
 *
 * POST /api/webhooks/leads-updated
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProgress } from '@/lib/incentives/progress-tracking'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

interface LeadWebhookPayload {
  event: 'lead.created' | 'lead.converted' | 'lead.status_changed'
  timestamp: string
  data: {
    lead_id: string
    assigned_to?: string
    created_by?: string
    status: string
    previous_status?: string
    converted_at?: string
    deal_value?: number
  }
}

/**
 * Verify webhook signature (if configured)
 */
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET

  if (!webhookSecret) {
    // If no secret configured, allow for development
    return true
  }

  const signature = request.headers.get('x-webhook-signature')
  if (!signature) {
    return false
  }

  const hmac = crypto.createHmac('sha256', webhookSecret)
  const expectedSignature = hmac.update(body).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
}

/**
 * Process lead update and trigger incentive progress updates
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()

    // Verify signature
    if (!verifyWebhookSignature(request, body)) {
      return NextResponse.json({ success: false, error: 'Invalid webhook signature' }, { status: 401 })
    }

    // Parse payload
    const payload: LeadWebhookPayload = JSON.parse(body)

    const supabase = await createClient()

    // Determine which user's progress to update
    const userId = payload.data.assigned_to || payload.data.created_by

    if (!userId) {
      return NextResponse.json({
        success: true,
        message: 'No user to update'
      })
    }

    // Get active incentives for this user
    const { data: allocations, error } = await supabase
      .from('incentive_allocations')
      .select(`
        *,
        incentive:incentives (
          id,
          performance_criteria,
          status
        )
      `)
      .eq('user_id', userId)
      .eq('incentive.status', 'active')
      .eq('allocation_status', 'eligible')

    if (error || !allocations || allocations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active incentives for this user'
      })
    }

    let updatesTriggered = 0

    // Update progress for relevant incentives
    for (const allocation of allocations) {
      const incentive = allocation.incentive as any
      const criteria = incentive.performance_criteria || {}
      const metricType = criteria.metric_type

      // Check if this webhook event is relevant for the metric
      const isRelevant = isEventRelevantForMetric(payload.event, payload.data.status, metricType)

      if (isRelevant) {
        try {
          // Get current metric value (count from leads table)
          const currentValue = await getCurrentMetricValue(
            supabase,
            userId,
            metricType,
            payload.event,
            payload.data
          )

          if (currentValue !== null) {
            await updateProgress({
              userId,
              incentiveId: incentive.id,
              metricType,
              currentValue,
              targetValue: criteria.target_value || 100,
              source: 'webhook',
              timestamp: new Date(payload.timestamp),
              metadata: {
                webhook_event: payload.event,
                lead_id: payload.data.lead_id,
                lead_status: payload.data.status,
                previous_status: payload.data.previous_status
              }
            })

            updatesTriggered++
          }
        } catch (err) {
          apiLogger.error(`Failed to update progress for allocation ${allocation.id}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Triggered ${updatesTriggered} progress update(s)`,
      updatesTriggered
    })
  } catch (error: unknown) {
    apiLogger.error('Error processing lead webhook', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Check if webhook event is relevant for the metric type
 */
function isEventRelevantForMetric(
  event: string,
  status: string,
  metricType: string
): boolean {
  switch (metricType) {
    case 'leads_converted':
      return event === 'lead.converted' || (event === 'lead.status_changed' && status === 'CONVERTED')

    case 'leads_created':
      return event === 'lead.created'

    case 'deals_closed':
      return event === 'lead.converted' || status === 'WON' || status === 'CLOSED'

    case 'revenue_generated':
      return event === 'lead.converted' && status === 'WON'

    default:
      return false
  }
}

/**
 * Get current metric value based on event type
 */
async function getCurrentMetricValue(
  supabase: any,
  userId: string,
  metricType: string,
  event: string,
  data: any
): Promise<number | null> {
  // For simplicity, trigger a full sync for this user
  // In production, you might want to increment the existing value

  const startDate = getStartDateForCurrentPeriod()

  switch (metricType) {
    case 'leads_converted': {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .in('status', ['CONVERTED', 'WON', 'CLOSED'])
        .gte('converted_at', startDate.toISOString())

      return count || 0
    }

    case 'leads_created': {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', userId)
        .gte('created_at', startDate.toISOString())

      return count || 0
    }

    case 'deals_closed': {
      const { count } = await supabase
        .from('crm_deals')
        .select('*', { count: 'exact', head: true })
        .eq('cro_id', userId)
        .in('status', ['won', 'closed'])
        .gte('updated_at', startDate.toISOString())

      return count || 0
    }

    case 'revenue_generated': {
      const { data: deals } = await supabase
        .from('crm_deals')
        .select('loan_amount')
        .eq('cro_id', userId)
        .in('status', ['won', 'closed'])
        .gte('updated_at', startDate.toISOString())

      return deals?.reduce((sum: number, deal: any) => sum + (deal.loan_amount || 0), 0) || 0
    }

    default:
      return null
  }
}

/**
 * Get start date for current measurement period (monthly by default)
 */
function getStartDateForCurrentPeriod(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
