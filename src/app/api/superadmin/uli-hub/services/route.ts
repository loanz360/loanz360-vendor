/**
 * API Route: ULI Services Management
 * GET    /api/superadmin/uli-hub/services  — List services (optional ?category=)
 * POST   /api/superadmin/uli-hub/services  — Create new service
 * PATCH  /api/superadmin/uli-hub/services  — Update service
 * DELETE /api/superadmin/uli-hub/services  — Delete service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'
import { invalidateServiceCache } from '@/lib/uli/services/service-registry'


// GET — List ULI services (optionally filtered by category)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category')
    const enabledOnly = searchParams.get('enabled') === 'true'

    const supabase = createAdminClient()

    let query = supabase
      .from('uli_services')
      .select('*')
      .order('category')
      .order('display_order')
      .order('service_name')

    if (category) {
      query = query.eq('category', category)
    }

    if (enabledOnly) {
      query = query.eq('is_enabled', true)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    apiLogger.error('ULI services list error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ULI services' },
      { status: 500 }
    )
  }
}

// POST — Create a new ULI service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('uli_services')
      .insert({
        service_code: body.service_code,
        service_name: body.service_name,
        service_description: body.service_description || null,
        category: body.category,
        uli_api_path: body.uli_api_path || null,
        uli_api_method: body.uli_api_method || 'POST',
        uli_api_version: body.uli_api_version || 'v1',
        request_schema: body.request_schema || {},
        response_schema: body.response_schema || {},
        is_enabled: body.is_enabled ?? false,
        is_sandbox_only: body.is_sandbox_only ?? true,
        requires_consent: body.requires_consent ?? false,
        timeout_ms: body.timeout_ms ?? 30000,
        retry_count: body.retry_count ?? 2,
        retry_delay_ms: body.retry_delay_ms ?? 1000,
        rate_limit_per_minute: body.rate_limit_per_minute ?? 60,
        rate_limit_per_day: body.rate_limit_per_day ?? 10000,
        cost_per_call: body.cost_per_call ?? 0,
        feature_flag_key: body.feature_flag_key || null,
        display_order: body.display_order ?? 0,
        icon_name: body.icon_name || null,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('ULI service create error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create ULI service' },
      { status: 500 }
    )
  }
}

// PATCH — Update an existing ULI service
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'service_name', 'service_description', 'category',
      'uli_api_path', 'uli_api_method', 'uli_api_version',
      'request_schema', 'response_schema',
      'is_enabled', 'is_sandbox_only', 'requires_consent',
      'timeout_ms', 'retry_count', 'retry_delay_ms',
      'rate_limit_per_minute', 'rate_limit_per_day',
      'cost_per_call', 'feature_flag_key', 'config_overrides',
      'display_order', 'icon_name',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('uli_services')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) throw error

    // Invalidate in-memory service cache so feature flag changes take effect immediately
    if (data?.service_code) {
      invalidateServiceCache(data.service_code)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('ULI service update error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ULI service' },
      { status: 500 }
    )
  }
}

// DELETE — Delete a ULI service
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Service ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('uli_services')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('ULI service delete error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete ULI service' },
      { status: 500 }
    )
  }
}
