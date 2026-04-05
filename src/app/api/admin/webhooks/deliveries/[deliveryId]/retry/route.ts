export const dynamic = 'force-dynamic'

/**
 * Webhook Delivery Retry API
 * Manually retry a failed webhook delivery
 * Admin access only
 */

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

// POST: Retry webhook delivery
export async function POST(
  request: NextRequest,
  { params }: { params: { deliveryId: string } }
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

    // Get delivery
    const { data: delivery, error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhook_endpoints!inner (*)
      `)
      .eq('id', params.deliveryId)
      .maybeSingle()

    if (deliveryError || !delivery) {
      return NextResponse.json(
        { success: false, error: 'Webhook delivery not found' },
        { status: 404 }
      )
    }

    // Check if retry is allowed
    if (delivery.retry_count >= delivery.max_retries) {
      return NextResponse.json(
        { success: false, error: 'Maximum retry attempts reached' },
        { status: 400 }
      )
    }

    if (delivery.delivered_at) {
      return NextResponse.json(
        { success: false, error: 'Webhook already delivered successfully' },
        { status: 400 }
      )
    }

    const endpoint = delivery.webhook_endpoints

    // Generate signature
    const signature = crypto
      .createHmac('sha256', endpoint.secret)
      .update(JSON.stringify(delivery.payload))
      .digest('hex')

    // Attempt delivery
    const startTime = Date.now()
    let httpStatus: number | null = null
    let responseBody: string | null = null
    let errorMessage: string | null = null

    try {
      const webhookResponse = await fetch(delivery.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event_type,
          'X-Webhook-Delivery-ID': delivery.id,
          'X-Webhook-Retry-Count': String(delivery.retry_count + 1),
          'User-Agent': 'LOANZ360-Webhook/1.0',
          ...endpoint.custom_headers
        },
        body: JSON.stringify(delivery.payload),
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

    // Update delivery record
    const updateData: any = {
      http_status: httpStatus,
      response_body: responseBody,
      retry_count: delivery.retry_count + 1,
      delivery_time_ms: deliveryTime,
      error_message: errorMessage
    }

    if (httpStatus && httpStatus >= 200 && httpStatus < 300) {
      // Success
      updateData.delivered_at = new Date().toISOString()
      updateData.failed_at = null
      updateData.next_retry_at = null
    } else {
      // Failed
      updateData.failed_at = new Date().toISOString()

      // Calculate next retry time if retries remaining
      if (delivery.retry_count + 1 < delivery.max_retries) {
        const backoffMs = Math.pow(2, delivery.retry_count + 1) * 60 * 1000 // Exponential backoff
        updateData.next_retry_at = new Date(Date.now() + backoffMs).toISOString()
      }
    }

    const { data: updatedDelivery, error: updateError } = await supabase
      .from('webhook_deliveries')
      .update(updateData)
      .eq('id', params.deliveryId)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating delivery', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update delivery record' },
        { status: 500 }
      )
    }

    if (httpStatus && httpStatus >= 200 && httpStatus < 300) {
      return NextResponse.json({
        success: true,
        message: 'Webhook delivered successfully',
        delivery: updatedDelivery
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Webhook delivery failed',
        delivery: updatedDelivery
      }, { status: 400 })
    }

  } catch (error) {
    apiLogger.error('Error in POST /api/admin/webhooks/deliveries/[deliveryId]/retry', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
