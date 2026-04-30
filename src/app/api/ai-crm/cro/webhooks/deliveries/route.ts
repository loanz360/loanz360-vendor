/**
 * Webhook Deliveries API
 *
 * View delivery history and status for webhooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import {
  verifyCROAuth,
  createErrorResponse,
} from '@/lib/api/ai-crm-middleware'


const deliveriesQuerySchema = z.object({
  webhook_id: z.string().uuid(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const authResult = await verifyCROAuth(request)
  if (!authResult.success) {
    return authResult.response
  }

  const { user, supabase, requestId } = authResult.context

  try {
    // Validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const parseResult = deliveriesQuerySchema.safeParse(searchParams)

    if (!parseResult.success) {
      return createErrorResponse(
        'Invalid query parameters',
        400,
        requestId,
        parseResult.error.flatten().fieldErrors
      )
    }

    const { webhook_id, page, limit, status } = parseResult.data
    const offset = (page - 1) * limit

    // Verify webhook ownership
    const { data: webhook, error: webhookError } = await supabase
      .from('webhooks')
      .select('id')
      .eq('id', webhook_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (webhookError || !webhook) {
      return createErrorResponse('Webhook not found', 404, requestId)
    }

    // Build query
    let query = supabase
      .from('webhook_deliveries')
      .select(`
        id,
        event_type,
        status,
        attempts,
        max_attempts,
        response_status,
        response_time_ms,
        error_message,
        created_at,
        delivered_at,
        next_retry_at
      `, { count: 'exact' })
      .eq('webhook_id', webhook_id)

    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: deliveries, error, count } = await query

    if (error) {
      logApiError(error as Error, request, { action: 'list_deliveries', requestId })
      return createErrorResponse('Failed to fetch deliveries', 500, requestId)
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('webhook_deliveries')
      .select('status')
      .eq('webhook_id', webhook_id)

    const summary = {
      total: stats?.length || 0,
      pending: stats?.filter(d => d.status === 'pending').length || 0,
      success: stats?.filter(d => d.status === 'success').length || 0,
      failed: stats?.filter(d => d.status === 'failed').length || 0,
      retrying: stats?.filter(d => d.status === 'retrying').length || 0,
    }

    return NextResponse.json({
      success: true,
      data: deliveries || [],
      summary,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    logApiError(error as Error, request, { action: 'list_deliveries', requestId })
    return createErrorResponse('Internal server error', 500, requestId)
  }
}
