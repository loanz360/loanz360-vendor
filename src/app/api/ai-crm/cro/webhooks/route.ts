/**
 * Webhook Management API
 *
 * Enterprise webhook system for external integrations
 * Features:
 * - CRUD operations for webhooks
 * - Secure secret generation
 * - Event type subscription
 * - Delivery history tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes, createHmac } from 'crypto'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
  logAuditTrail,
} from '@/lib/api/ai-crm-middleware'


// Valid event types
const VALID_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.converted',
  'lead.deleted',
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'deal.created',
  'deal.updated',
  'deal.status_changed',
  'deal.deleted',
] as const

// Create webhook schema
const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().startsWith('https://'),
  events: z.array(z.enum(VALID_EVENTS)).min(1).max(20),
  headers: z.record(z.string()).optional().default({}),
})

// Update webhook schema
const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().startsWith('https://').optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).max(20).optional(),
  headers: z.record(z.string()).optional(),
  is_active: z.boolean().optional(),
})

// List webhooks
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select(`
        id,
        name,
        url,
        events,
        is_active,
        headers,
        created_at,
        updated_at,
        last_triggered_at,
        total_deliveries,
        successful_deliveries,
        failed_deliveries
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      logApiError(error as Error, request, { action: 'list_webhooks', requestId })
      return createErrorResponse('Failed to fetch webhooks', 500, requestId)
    }

    return NextResponse.json({
      success: true,
      data: webhooks || [],
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        available_events: VALID_EVENTS,
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'list_webhooks', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

// Create webhook
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Parse and validate request body
    const body = await request.json()
    const parseResult = createWebhookSchema.safeParse(body)

    if (!parseResult.success) {
      return createErrorResponse(
        'Invalid webhook data',
        400,
        requestId,
        parseResult.error.flatten().fieldErrors
      )
    }

    const { name, url, events, headers } = parseResult.data

    // Generate secure secret for signature verification
    const secret = `whsec_${randomBytes(32).toString('hex')}`

    // Check webhook limit (max 10 per user)
    const { count } = await supabase
      .from('webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count || 0) >= 10) {
      return createErrorResponse(
        'Maximum webhook limit reached (10)',
        400,
        requestId
      )
    }

    // Create webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        user_id: user.id,
        name,
        url,
        secret,
        events,
        headers,
      })
      .select()
      .maybeSingle()

    if (error) {
      logApiError(error as Error, request, { action: 'create_webhook', requestId })
      return createErrorResponse('Failed to create webhook', 500, requestId)
    }

    // Log audit trail
    await logAuditTrail(supabase, {
      tableName: 'webhooks',
      recordId: webhook.id,
      action: 'create',
      userId: user.id,
      newData: { name, url, events },
      requestId,
    })

    return NextResponse.json({
      success: true,
      data: {
        ...webhook,
        secret, // Only return secret on creation
      },
      message: 'Webhook created successfully. Save the secret - it will not be shown again.',
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    }, { status: 201 })
  } catch (error) {
    logApiError(error as Error, request, { action: 'create_webhook', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

// Update webhook
export async function PUT(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return createErrorResponse('Webhook ID is required', 400, requestId)
    }

    // Validate update data
    const parseResult = updateWebhookSchema.safeParse(updateData)
    if (!parseResult.success) {
      return createErrorResponse(
        'Invalid webhook data',
        400,
        requestId,
        parseResult.error.flatten().fieldErrors
      )
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return createErrorResponse('Webhook not found', 404, requestId)
    }

    // Update webhook
    const { data: webhook, error } = await supabase
      .from('webhooks')
      .update({
        ...parseResult.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      logApiError(error as Error, request, { action: 'update_webhook', requestId })
      return createErrorResponse('Failed to update webhook', 500, requestId)
    }

    // Log audit trail
    await logAuditTrail(supabase, {
      tableName: 'webhooks',
      recordId: id,
      action: 'update',
      userId: user.id,
      oldData: existing,
      newData: parseResult.data,
      requestId,
    })

    return NextResponse.json({
      success: true,
      data: webhook,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'update_webhook', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

// Delete webhook
export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return createErrorResponse('Webhook ID is required', 400, requestId)
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('webhooks')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !existing) {
      return createErrorResponse('Webhook not found', 404, requestId)
    }

    // Delete webhook (cascade deletes deliveries)
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)

    if (error) {
      logApiError(error as Error, request, { action: 'delete_webhook', requestId })
      return createErrorResponse('Failed to delete webhook', 500, requestId)
    }

    // Log audit trail
    await logAuditTrail(supabase, {
      tableName: 'webhooks',
      recordId: id,
      action: 'delete',
      userId: user.id,
      oldData: existing,
      requestId,
    })

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'delete_webhook', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}

/**
 * Generate webhook signature for payload verification
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const signaturePayload = `${timestamp}.${payload}`
  const signature = createHmac('sha256', secret)
    .update(signaturePayload)
    .digest('hex')

  return `t=${timestamp},v1=${signature}`
}
