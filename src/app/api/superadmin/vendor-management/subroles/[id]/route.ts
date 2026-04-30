import { parseBody } from '@/lib/utils/parse-body'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { apiLogger } from '@/lib/utils/logger'
import { encodeHtmlEntities } from '@/lib/utils/sanitize'

export const runtime = 'nodejs'

/**
 * GET /api/superadmin/vendor-management/subroles/[id]
 * Fetch a single vendor sub-role by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createSupabaseAdmin()

    const { data, error } = await supabase
      .from('vendor_sub_roles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Vendor sub-role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('Error fetching vendor sub-role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendor sub-role' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/vendor-management/subroles/[id]
 * Update a vendor sub-role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { name, description, category, status } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const updateData: Record<string, string> = {
      name: encodeHtmlEntities(name),
      updated_at: new Date().toISOString(),
    }

    if (description !== undefined) updateData.description = encodeHtmlEntities(description)
    if (category !== undefined) updateData.category = encodeHtmlEntities(category)
    if (status !== undefined) updateData.status = status

    const { data: role, error } = await supabase
      .from('vendor_sub_roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { success: false, error: 'vendor_sub_roles table not found. Please run the migration first.' },
          { status: 503 }
        )
      }
      apiLogger.error('Error updating vendor sub-role', { error, id })
      return NextResponse.json(
        { success: false, error: 'Failed to update role' },
        { status: 500 }
      )
    }

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: role,
      message: 'Vendor sub-role updated successfully',
    })
  } catch (error) {
    apiLogger.error('Error in PUT /api/superadmin/vendor-management/subroles/[id]', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/vendor-management/subroles/[id]
 * Delete a vendor sub-role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params

    const supabase = createSupabaseAdmin()

    const { error } = await supabase
      .from('vendor_sub_roles')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { success: false, error: 'vendor_sub_roles table not found. Please run the migration first.' },
          { status: 503 }
        )
      }
      apiLogger.error('Error deleting vendor sub-role', { error, id })
      return NextResponse.json(
        { success: false, error: 'Failed to delete role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Vendor sub-role deleted successfully',
    })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/superadmin/vendor-management/subroles/[id]', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
