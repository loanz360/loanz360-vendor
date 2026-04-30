
/**
 * Webhook Test API
 * Send a test webhook to verify endpoint configuration
 * Admin access only
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

async function verifyAdmin(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const adminId = payload.sub as string

    if (!adminId) {
      throw new Error('Invalid token payload')
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminId)
      .maybeSingle()

    if (userError || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return null
    }

    return adminId
  } catch (error) {
    return null
  }
}

// POST: Send test webhook
export async function POST(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const adminId = await verifyAdmin(token)
    if (!adminId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    // Get webhook endpoint
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', params.webhookId)
      .maybeSingle()

    if (endpointError || !endpoint) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint not found' },
        { status: 404 }
      )
    }

    // Create test payload
    const testPayload = {
      event_type: 'webhook.test',
      event_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from LOANZ 360',
        endpoint_id: endpoint.id,
        endpoint_name: endpoint.name
      }
    }

    // Generate signature
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex')

    // Send webhook
    const startTime = Date.now()
    let httpStatus: number | null = null
    let responseBody: string | null = null
    let errorMessage: string | null = null

    try {
      const webhookResponse = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'webhook.test',
          'User-Agent': 'LOANZ360-Webhook/1.0',
          ...endpoint.custom_headers
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      httpStatus = webhookResponse.status
      responseBody = await webhookResponse.text()

      if (!webhookResponse.ok) {
        errorMessage = `HTTP ${httpStatus}: ${responseBody}`
      }
    } catch (error: unknown) {
      errorMessage = (error instanceof Error ? error.message : String(error)) || 'Failed to send webhook'
    }

    const deliveryTime = Date.now() - startTime

    // Log the test delivery
    const { data: delivery, error: logError } = await supabase
      .from('webhook_deliveries')
      .insert([{
        endpoint_id: endpoint.id,
        endpoint_url: endpoint.url,
        event_type: 'webhook.test',
        event_id: testPayload.event_id,
        payload: testPayload,
        http_status: httpStatus,
        response_body: responseBody,
        retry_count: 0,
        max_retries: 0,
        delivered_at: httpStatus && httpStatus >= 200 && httpStatus < 300 ? new Date().toISOString() : null,
        failed_at: httpStatus && (httpStatus < 200 || httpStatus >= 300) ? new Date().toISOString() : null,
        error_message: errorMessage,
        delivery_time_ms: deliveryTime
      }])
      .select()
      .maybeSingle()

    if (logError) {
      apiLogger.error('Error logging webhook delivery', logError)
    }

    if (httpStatus && httpStatus >= 200 && httpStatus < 300) {
      return NextResponse.json({
        success: true,
        message: 'Test webhook sent successfully',
        delivery: {
          http_status: httpStatus,
          delivery_time_ms: deliveryTime,
          response_body: responseBody?.substring(0, 500) // Limit response body
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Test webhook failed',
        delivery: {
          http_status: httpStatus,
          delivery_time_ms: deliveryTime,
          error_message: errorMessage
        }
      }, { status: 400 })
    }

  } catch (error) {
    apiLogger.error('Error in POST /api/admin/webhooks/[webhookId]/test', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
