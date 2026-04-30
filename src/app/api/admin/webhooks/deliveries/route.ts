
/**
 * Webhook Deliveries API
 * Get list of webhook delivery attempts
 * Admin access only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      const adminId = payload.sub as string

      if (!adminId) {
        throw new Error('Invalid token payload')
      }

      // Verify admin role
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', adminId)
        .maybeSingle()

      if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized access' },
          { status: 403 }
        )
      }
    } catch (error) {
      apiLogger.error('JWT verification error', error)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const endpointId = searchParams.get('endpoint_id')
    const eventType = searchParams.get('event_type')
    const status = searchParams.get('status') // 'success', 'failed', 'pending'

    // Build query
    let query = supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhook_endpoints!inner (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (endpointId) {
      query = query.eq('endpoint_id', endpointId)
    }

    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (status === 'success') {
      query = query.not('delivered_at', 'is', null)
    } else if (status === 'failed') {
      query = query.not('failed_at', 'is', null)
    } else if (status === 'pending') {
      query = query.is('delivered_at', null).is('failed_at', null)
    }

    const { data: deliveries, error } = await query

    if (error) {
      apiLogger.error('Error fetching webhook deliveries', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch webhook deliveries' },
        { status: 500 }
      )
    }

    // Transform data to include endpoint name at root level
    const transformedDeliveries = (deliveries || []).map((delivery: any) => ({
      id: delivery.id,
      endpoint_id: delivery.endpoint_id,
      endpoint_name: delivery.webhook_endpoints?.name || 'Unknown',
      endpoint_url: delivery.endpoint_url,
      event_type: delivery.event_type,
      event_id: delivery.event_id,
      payload: delivery.payload,
      http_status: delivery.http_status,
      response_body: delivery.response_body,
      retry_count: delivery.retry_count,
      max_retries: delivery.max_retries,
      next_retry_at: delivery.next_retry_at,
      delivered_at: delivery.delivered_at,
      failed_at: delivery.failed_at,
      error_message: delivery.error_message,
      delivery_time_ms: delivery.delivery_time_ms,
      created_at: delivery.created_at
    }))

    return NextResponse.json({
      success: true,
      deliveries: transformedDeliveries,
      pagination: {
        limit,
        offset,
        total: transformedDeliveries.length
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/webhooks/deliveries', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
