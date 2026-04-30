import { parseBody } from '@/lib/utils/parse-body'

/**
 * Webhook Endpoint Detail API
 * Get, update, or delete individual webhook endpoints
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

// GET: Get single webhook endpoint
export async function GET(
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

    const { data: endpoint, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', params.webhookId)
      .maybeSingle()

    if (error || !endpoint) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoint
    })

  } catch (error) {
    apiLogger.error('Error in GET /api/admin/webhooks/[webhookId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT: Update entire webhook endpoint
export async function PUT(
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      name,
      url,
      subscribed_events,
      is_active,
      max_retries,
      custom_headers
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

    const { data: updatedEndpoint, error } = await supabase
      .from('webhook_endpoints')
      .update({
        name,
        url,
        subscribed_events,
        is_active: is_active !== undefined ? is_active : true,
        retry_config: {
          max_retries: max_retries || 3,
          backoff_strategy: 'exponential'
        },
        custom_headers: custom_headers || {},
        updated_at: new Date().toISOString()
      })
      .eq('id', params.webhookId)
      .select()
      .maybeSingle()

    if (error || !updatedEndpoint) {
      apiLogger.error('Error updating webhook endpoint', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update webhook endpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoint: updatedEndpoint
    })

  } catch (error) {
    apiLogger.error('Error in PUT /api/admin/webhooks/[webhookId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Partially update webhook endpoint
export async function PATCH(
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate URL if provided
    if (body.url) {
      try {
        const urlObj = new URL(body.url)
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
    }

    const { data: updatedEndpoint, error } = await supabase
      .from('webhook_endpoints')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.webhookId)
      .select()
      .maybeSingle()

    if (error || !updatedEndpoint) {
      apiLogger.error('Error updating webhook endpoint', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update webhook endpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpoint: updatedEndpoint
    })

  } catch (error) {
    apiLogger.error('Error in PATCH /api/admin/webhooks/[webhookId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Delete webhook endpoint
export async function DELETE(
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

    const { error } = await supabase
      .from('webhook_endpoints')
      .delete()
      .eq('id', params.webhookId)

    if (error) {
      apiLogger.error('Error deleting webhook endpoint', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete webhook endpoint' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Error in DELETE /api/admin/webhooks/[webhookId]', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
