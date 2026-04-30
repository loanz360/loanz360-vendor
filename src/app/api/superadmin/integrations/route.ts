import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

/**
 * Verify the request is from a super_admin user.
 * Returns { user, error?, status? }
 */
async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: 'Unauthorized', status: 401 }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userError || userData?.role !== 'super_admin') {
    return { user: null, error: 'Forbidden', status: 403 }
  }

  return { user }
}

/** Sanitize search input - remove dangerous characters */
function sanitizeSearch(input: string): string {
  return input.replace(/[%_\\(),.\"']/g, '')
}

/** Allowlist of fields for create */
const CREATE_ALLOWLIST = [
  'category', 'provider_name', 'display_name', 'description', 'base_url',
  'auth_type', 'auth_config', 'icon_url', 'documentation_url',
  'supported_operations', 'rate_limit_per_minute', 'rate_limit_per_day',
  'sandbox_url', 'requires_api_key', 'requires_oauth',
] as const

/** Allowlist of fields for update */
const UPDATE_ALLOWLIST = [
  'display_name', 'description', 'base_url', 'auth_type', 'auth_config',
  'icon_url', 'documentation_url', 'supported_operations',
  'rate_limit_per_minute', 'rate_limit_per_day', 'sandbox_url',
  'requires_api_key', 'requires_oauth', 'status', 'health_status',
  'is_active',
] as const

/**
 * GET /api/superadmin/integrations
 * List all integration providers with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('integration_providers')
      .select('*', { count: 'exact' })
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      const sanitized = sanitizeSearch(search)
      if (sanitized.length > 0) {
        query = query.or(
          `provider_name.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`
        )
      }
    }

    query = query.range(offset, offset + limit - 1)

    const { data: providers, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching integration providers', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch integration providers' },
        { status: 500 }
      )
    }

    // Fetch aggregate stats
    const { data: statsData } = await supabase
      .from('integration_providers')
      .select('status, health_status, category')
      .neq('status', 'deleted')

    const stats = {
      total: statsData?.length || 0,
      by_status: {} as Record<string, number>,
      by_health: {} as Record<string, number>,
      by_category: {} as Record<string, number>,
    }

    if (statsData) {
      for (const row of statsData) {
        stats.by_status[row.status] = (stats.by_status[row.status] || 0) + 1
        if (row.health_status) {
          stats.by_health[row.health_status] = (stats.by_health[row.health_status] || 0) + 1
        }
        stats.by_category[row.category] = (stats.by_category[row.category] || 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      data: providers || [],
      meta: {
        total: count || 0,
        page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
        stats,
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/integrations', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/integrations
 * Create a new integration provider
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const bodySchema = z.object({


      category: z.string().optional(),


      provider_name: z.string().optional(),


      display_name: z.string().optional(),


      id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.category || !body.provider_name || !body.display_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: category, provider_name, display_name' },
        { status: 400 }
      )
    }

    // Filter to allowlisted fields only
    const insertData: Record<string, unknown> = {}
    for (const key of CREATE_ALLOWLIST) {
      if (body[key] !== undefined) {
        insertData[key] = body[key]
      }
    }
    insertData.created_by = auth.user.id

    const supabase = createSupabaseAdmin()

    // Check for duplicate provider_name
    const { data: existing } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('provider_name', body.provider_name)
      .neq('status', 'deleted')
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A provider with this name already exists' },
        { status: 409 }
      )
    }

    const { data: provider, error } = await supabase
      .from('integration_providers')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      apiLogger.error('Error creating integration provider', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to create integration provider' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: provider,
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/superadmin/integrations', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/integrations
 * Update an integration provider
 */
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      )
    }

    // Filter to allowlisted fields only
    const updateData: Record<string, unknown> = {}
    for (const key of UPDATE_ALLOWLIST) {
      if (body[key] !== undefined) {
        updateData[key] = body[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updateData.updated_at = new Date().toISOString()

    const supabase = createSupabaseAdmin()

    // Fetch current state for audit trail
    const { data: currentProvider } = await supabase
      .from('integration_providers')
      .select('*')
      .eq('id', body.id)
      .neq('status', 'deleted')
      .maybeSingle()

    if (!currentProvider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    const { data: provider, error } = await supabase
      .from('integration_providers')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      apiLogger.error('Error updating integration provider', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to update integration provider' },
        { status: 500 }
      )
    }

    // Log changes to audit trail
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const key of Object.keys(updateData)) {
      if (key === 'updated_at') continue
      if (currentProvider[key] !== updateData[key]) {
        changes[key] = { old: currentProvider[key], new: updateData[key] }
      }
    }

    if (Object.keys(changes).length > 0) {
      await supabase
        .from('integration_audit_trail')
        .insert({
          provider_id: body.id,
          action: 'update',
          performed_by: auth.user.id,
          changes,
          previous_state: currentProvider,
          new_state: provider,
        })
    }

    return NextResponse.json({
      success: true,
      data: provider,
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/superadmin/integrations', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/integrations
 * Soft-delete an integration provider (set status to 'deleted')
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: id' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch current state for audit trail
    const { data: currentProvider } = await supabase
      .from('integration_providers')
      .select('*')
      .eq('id', id)
      .neq('status', 'deleted')
      .maybeSingle()

    if (!currentProvider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('integration_providers')
      .update({
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      apiLogger.error('Error soft-deleting integration provider', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to delete integration provider' },
        { status: 500 }
      )
    }

    // Log to audit trail
    await supabase
      .from('integration_audit_trail')
      .insert({
        provider_id: id,
        action: 'delete',
        performed_by: auth.user.id,
        changes: { status: { old: currentProvider.status, new: 'deleted' } },
        previous_state: currentProvider,
        new_state: { ...currentProvider, status: 'deleted' },
      })

    return NextResponse.json({
      success: true,
      data: { id, status: 'deleted' },
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/superadmin/integrations', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
