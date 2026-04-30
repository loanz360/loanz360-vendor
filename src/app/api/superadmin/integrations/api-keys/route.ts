import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import crypto from 'crypto'

export const runtime = 'nodejs'

/**
 * Verify the request is from a super_admin user.
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

/** Mask an API key - show only prefix */
function maskApiKey(keyPrefix: string): string {
  return `${keyPrefix}${'*'.repeat(32)}`
}

/**
 * GET /api/superadmin/integrations/api-keys
 * List API keys for a provider (keys are masked)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const providerId = searchParams.get('provider_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const supabase = createSupabaseAdmin()

    let query = supabase
      .from('integration_api_keys')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (providerId) {
      query = query.eq('provider_id', providerId)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: keys, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching API keys', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    // Mask the actual keys - only show prefix
    const maskedKeys = (keys || []).map((key: Record<string, unknown>) => ({
      ...key,
      key_hash: undefined, // Never expose the hash
      masked_key: key.key_prefix ? maskApiKey(key.key_prefix as string) : '****',
    }))

    return NextResponse.json({
      success: true,
      data: maskedKeys,
      meta: {
        total: count || 0,
        page,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/integrations/api-keys', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/integrations/api-keys
 * Create a new API key. Returns the full key ONLY on creation.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const bodySchema = z.object({


      provider_id: z.string().uuid(),


      key_name: z.string().optional(),


      scopes: z.string().optional(),


      rate_limit_per_minute: z.string().optional(),


      expires_at: z.string().optional(),


      id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    if (!body.provider_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: provider_id' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Verify provider exists
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id')
      .eq('id', body.provider_id)
      .neq('status', 'deleted')
      .maybeSingle()

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Generate the API key
    const rawKey = crypto.randomBytes(32).toString('hex')
    const keyPrefix = rawKey.substring(0, 8)
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const insertData: Record<string, unknown> = {
      provider_id: body.provider_id,
      key_name: body.key_name || 'Default Key',
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: body.scopes || ['read'],
      rate_limit_per_minute: body.rate_limit_per_minute || 60,
      is_active: true,
      created_by: auth.user.id,
    }

    if (body.expires_at) {
      insertData.expires_at = body.expires_at
    }

    const { data: apiKey, error } = await supabase
      .from('integration_api_keys')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      apiLogger.error('Error creating API key', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to create API key' },
        { status: 500 }
      )
    }

    // Return the full key ONLY on creation - it cannot be retrieved later
    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        key_hash: undefined,
        api_key: rawKey, // Full key returned only on creation
      },
      meta: {
        warning: 'Store this API key securely. It cannot be retrieved again after this response.',
      },
    }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/superadmin/integrations/api-keys', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/integrations/api-keys
 * Update an API key (name, scopes, rate limit, active status)
 */
export async function PUT(request: NextRequest) {
  try {
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

    const ALLOWED_FIELDS = ['key_name', 'scopes', 'rate_limit_per_minute', 'is_active'] as const
    const updateData: Record<string, unknown> = {}

    for (const key of ALLOWED_FIELDS) {
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

    const { data: apiKey, error } = await supabase
      .from('integration_api_keys')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      apiLogger.error('Error updating API key', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to update API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...apiKey,
        key_hash: undefined,
        masked_key: apiKey.key_prefix ? maskApiKey(apiKey.key_prefix) : '****',
      },
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/superadmin/integrations/api-keys', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/integrations/api-keys
 * Revoke an API key (set is_active to false)
 */
export async function DELETE(request: NextRequest) {
  try {
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

    const { data: apiKey, error } = await supabase
      .from('integration_api_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, key_name, is_active, revoked_at')
      .single()

    if (error) {
      apiLogger.error('Error revoking API key', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to revoke API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: apiKey,
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/superadmin/integrations/api-keys', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
