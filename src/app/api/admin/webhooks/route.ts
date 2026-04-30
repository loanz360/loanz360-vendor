import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

/**
 * Webhooks API
 * Manage webhook endpoints for real-time event notifications
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

// GET: List all webhook endpoints
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

    // Fetch all webhook endpoints
    const { data: endpoints, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching webhook endpoints', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch webhook endpoints' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoints: endpoints || []
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/webhooks', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Create new webhook endpoint
export async function POST(request: NextRequest) {
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

    let adminId: string

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET)
      adminId = payload.sub as string

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

    // Parse request body
    const bodySchema = z.object({

      name: z.string().optional(),

      url: z.string().optional(),

      subscribed_events: z.array(z.unknown()).optional(),

      is_active: z.boolean().optional(),

      max_retries: z.string().optional(),

      custom_headers: z.string().optional(),

      partner_id: z.string().uuid().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      name,
      url,
      subscribed_events,
      is_active,
      max_retries,
      custom_headers,
      partner_id
    } = body

    // Validate required fields
    if (!name || !url || !subscribed_events || subscribed_events.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol !== 'https:') {
        return NextResponse.json(
          { success: false, error: 'Webhook URL must use HTTPS' },
          { status: 400 }
        )
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook URL' },
        { status: 400 }
      )
    }

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex')

    // Insert new webhook endpoint
    const { data: newEndpoint, error } = await supabase
      .from('webhook_endpoints')
      .insert([{
        name,
        url,
        secret,
        subscribed_events,
        is_active: is_active !== undefined ? is_active : true,
        retry_config: {
          max_retries: max_retries || 3,
          backoff_strategy: 'exponential'
        },
        custom_headers: custom_headers || {},
        partner_id: partner_id || null,
        created_by: adminId
      }])
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating webhook endpoint', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create webhook endpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoint: newEndpoint,
      message: 'Webhook endpoint created successfully. Save the secret for signature verification.'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Error in POST /api/admin/webhooks', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
