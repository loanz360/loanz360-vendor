import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch all proxies
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const type = searchParams.get('type')

    let query = supabase
      .from('google_maps_proxy_config')
      .select('*')
      .order('success_count', { ascending: false })

    if (active === 'true') {
      query = query.eq('is_active', true)
    }

    if (type) {
      query = query.eq('proxy_type', type)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching proxies', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add new proxy
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      proxy_type: z.string().optional(),

      proxy_url: z.string().optional(),

      proxy_host: z.string().optional(),

      proxy_port: z.string().optional(),

      proxy_username: z.string().optional(),

      proxy_password: z.string().optional(),

      id: z.string().uuid(),

      success: z.string().optional(),

      response_time_ms: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { proxy_type, proxy_url, proxy_host, proxy_port, proxy_username, proxy_password } = body

    const { data, error } = await supabase
      .from('google_maps_proxy_config')
      .insert({
        proxy_type: proxy_type || 'paid',
        proxy_url,
        proxy_host,
        proxy_port,
        proxy_username,
        proxy_password,
        is_active: true
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: unknown) {
    apiLogger.error('Error adding proxy', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update proxy stats (called by Lambda)
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema2 = z.object({

      response_time_ms: z.string().optional(),

      success: z.string().optional(),

      id: z.string().optional(),

    })

    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id, success, response_time_ms } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Proxy ID is required' },
        { status: 400 }
      )
    }

    const { data: proxy } = await supabase
      .from('google_maps_proxy_config')
      .select('success_count, failure_count')
      .eq('id', id)
      .maybeSingle()

    if (!proxy) {
      return NextResponse.json(
        { success: false, error: 'Proxy not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      last_used_at: new Date().toISOString()
    }

    if (success) {
      updateData.success_count = (proxy.success_count || 0) + 1
      updateData.last_success_at = new Date().toISOString()
      if (response_time_ms) {
        updateData.avg_response_time_ms = response_time_ms
      }
    } else {
      updateData.failure_count = (proxy.failure_count || 0) + 1
      updateData.last_failure_at = new Date().toISOString()

      // Disable proxy if too many failures
      if (proxy.failure_count >= 10) {
        updateData.is_active = false
      }
    }

    const { error } = await supabase
      .from('google_maps_proxy_config')
      .update(updateData)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Proxy stats updated'
    })
  } catch (error: unknown) {
    apiLogger.error('Error updating proxy', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete proxy
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Proxy ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('google_maps_proxy_config')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Proxy deleted'
    })
  } catch (error: unknown) {
    apiLogger.error('Error deleting proxy', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
