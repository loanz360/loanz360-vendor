
/**
 * Webhook Statistics API
 * Get analytics about webhook performance
 * Admin access only
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
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
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
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

    // Get total endpoints count
    const { count: totalEndpoints, error: totalError } = await supabase
      .from('webhook_endpoints')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      apiLogger.error('Error counting total endpoints', totalError)
    }

    // Get active endpoints count
    const { count: activeEndpoints, error: activeError } = await supabase
      .from('webhook_endpoints')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (activeError) {
      apiLogger.error('Error counting active endpoints', activeError)
    }

    // Get total deliveries
    const { count: totalDeliveries, error: deliveriesError } = await supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact', head: true })

    if (deliveriesError) {
      apiLogger.error('Error counting deliveries', deliveriesError)
    }

    // Get successful deliveries count (last 1000)
    const { count: successfulDeliveries, error: successError } = await supabase
      .from('webhook_deliveries')
      .select('*', { count: 'exact', head: true })
      .not('delivered_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (successError) {
      apiLogger.error('Error counting successful deliveries', successError)
    }

    // Calculate success rate
    let successRate = 0
    if (totalDeliveries && totalDeliveries > 0 && successfulDeliveries) {
      successRate = Math.round((successfulDeliveries / Math.min(totalDeliveries, 1000)) * 100)
    }

    // Get average delivery time (last 100 deliveries)
    const { data: recentDeliveries, error: timeError } = await supabase
      .from('webhook_deliveries')
      .select('delivery_time_ms')
      .not('delivered_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    let avgDeliveryTime = 0
    if (!timeError && recentDeliveries && recentDeliveries.length > 0) {
      const sum = recentDeliveries.reduce((acc, curr) => acc + (curr.delivery_time_ms || 0), 0)
      avgDeliveryTime = Math.round(sum / recentDeliveries.length)
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalEndpoints: totalEndpoints || 0,
        activeEndpoints: activeEndpoints || 0,
        totalDeliveries: totalDeliveries || 0,
        successRate: successRate,
        avgDeliveryTime: avgDeliveryTime
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/webhooks/stats', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
