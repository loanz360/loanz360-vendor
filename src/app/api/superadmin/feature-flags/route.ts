import { parseBody } from '@/lib/utils/parse-body'
/**
 * API Route: Super Admin Feature Flags Management
 * GET    /api/superadmin/feature-flags  — List all flags
 * POST   /api/superadmin/feature-flags  — Create new flag
 * PATCH  /api/superadmin/feature-flags  — Update flag (toggle, rename, etc.)
 * DELETE /api/superadmin/feature-flags  — Delete flag
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


// GET — List all feature flags
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('category')
      .order('portal')
      .order('flag_name')

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    apiLogger.error('Feature flags list error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}

// POST — Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('feature_flags')
      .insert({
        flag_key: body.flag_key,
        flag_name: body.flag_name,
        description: body.description || null,
        portal: body.portal || 'CUSTOMER',
        category: body.category || 'FEATURE',
        is_enabled: body.is_enabled || false,
        rollout_percentage: body.rollout_percentage || 100,
        metadata: body.metadata || {},
        depends_on: body.depends_on || null,
      })
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('Feature flag create error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create feature flag' },
      { status: 500 }
    )
  }
}

// PATCH — Update an existing feature flag
export async function PATCH(request: NextRequest) {
  try {
    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Flag ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}
    if (body.flag_name !== undefined) updateData.flag_name = body.flag_name
    if (body.description !== undefined) updateData.description = body.description
    if (body.portal !== undefined) updateData.portal = body.portal
    if (body.category !== undefined) updateData.category = body.category
    if (body.is_enabled !== undefined) updateData.is_enabled = body.is_enabled
    if (body.rollout_percentage !== undefined) updateData.rollout_percentage = body.rollout_percentage
    if (body.metadata !== undefined) updateData.metadata = body.metadata
    if (body.depends_on !== undefined) updateData.depends_on = body.depends_on

    const { data, error } = await supabase
      .from('feature_flags')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('Feature flag update error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update feature flag' },
      { status: 500 }
    )
  }
}

// DELETE — Delete a feature flag
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Flag ID is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Feature flag delete error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete feature flag' },
      { status: 500 }
    )
  }
}
