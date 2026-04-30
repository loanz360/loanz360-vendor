import { parseBody } from '@/lib/utils/parse-body'

/**
 * Profile Entity Type Detail API
 * SuperAdmin endpoint for managing individual profile-entity mappings
 *
 * GET    - Fetch single mapping with details
 * PUT    - Update mapping (enable/disable, display order)
 * DELETE - Delete mapping (removes the link)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema for updates
const updateProfileEntityTypeSchema = z.object({
  is_enabled: z.boolean().optional(),
  display_order: z.number().optional()
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/profile-entity-types/[id]
 * Fetch single profile-entity mapping with full details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Fetch mapping with related data
    const { data: mapping, error } = await supabaseAdmin
      .from('profile_entity_types')
      .select(`
        id,
        income_profile_id,
        entity_type_id,
        is_enabled,
        display_order,
        created_at,
        updated_at,
        created_by,
        updated_by,
        income_profiles!inner (
          id,
          key,
          name,
          description,
          icon,
          category_id,
          income_categories!inner (
            id,
            key,
            name,
            show_entity_profile
          )
        ),
        entity_types!inner (
          id,
          key,
          name,
          description,
          icon,
          color,
          liability_type,
          min_members,
          max_members,
          requires_registration,
          registration_authority
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !mapping) {
      return NextResponse.json(
        { success: false, error: 'Profile-entity mapping not found' },
        { status: 404 }
      )
    }

    // Get audit history for this mapping
    const { data: auditHistory } = await supabaseAdmin
      .from('profile_entity_audit_log')
      .select('*')
      .eq('profile_entity_id', id)
      .order('changed_at', { ascending: false })
      .limit(10)

    // Transform the data
    const profile = mapping.income_profiles as {
      id: string
      key: string
      name: string
      description: string | null
      icon: string | null
      category_id: string
      income_categories: {
        id: string
        key: string
        name: string
        show_entity_profile: boolean
      }
    }

    const entityType = mapping.entity_types as {
      id: string
      key: string
      name: string
      description: string | null
      icon: string | null
      color: string | null
      liability_type: string
      min_members: number
      max_members: number | null
      requires_registration: boolean
      registration_authority: string | null
    }

    return NextResponse.json({
      success: true,
      data: {
        id: mapping.id,
        is_enabled: mapping.is_enabled,
        display_order: mapping.display_order,
        created_at: mapping.created_at,
        updated_at: mapping.updated_at,
        created_by: mapping.created_by,
        updated_by: mapping.updated_by,
        profile: {
          id: profile.id,
          key: profile.key,
          name: profile.name,
          description: profile.description,
          icon: profile.icon
        },
        category: {
          id: profile.income_categories.id,
          key: profile.income_categories.key,
          name: profile.income_categories.name,
          show_entity_profile: profile.income_categories.show_entity_profile
        },
        entity_type: entityType,
        audit_history: auditHistory || []
      }
    })

  } catch (error) {
    apiLogger.error('Profile Entity Type GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/profile-entity-types/[id]
 * Update a profile-entity mapping
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = updateProfileEntityTypeSchema.parse(body)

    // Check if mapping exists
    const { data: existing } = await supabaseAdmin
      .from('profile_entity_types')
      .select('id, is_enabled, display_order')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Profile-entity mapping not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: auth.userId || null
    }

    if (validatedData.is_enabled !== undefined) {
      updateData.is_enabled = validatedData.is_enabled
    }

    if (validatedData.display_order !== undefined) {
      updateData.display_order = validatedData.display_order
    }

    // Update mapping
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profile_entity_types')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        income_profile_id,
        entity_type_id,
        is_enabled,
        display_order,
        updated_at,
        income_profiles (
          id,
          key,
          name
        ),
        entity_types (
          id,
          key,
          name
        )
      `)
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating profile entity type', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update mapping' },
        { status: 500 }
      )
    }

    // Determine what changed for the message
    const changes: string[] = []
    if (validatedData.is_enabled !== undefined && validatedData.is_enabled !== existing.is_enabled) {
      changes.push(validatedData.is_enabled ? 'enabled' : 'disabled')
    }
    if (validatedData.display_order !== undefined && validatedData.display_order !== existing.display_order) {
      changes.push('display order updated')
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: changes.length > 0
        ? `Mapping ${changes.join(' and ')}`
        : 'Mapping updated successfully'
    })

  } catch (error) {
    apiLogger.error('Profile Entity Type PUT error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/customer-management/profile-entity-types/[id]
 * Delete a profile-entity mapping
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Check if mapping exists and get details for confirmation
    const { data: existing } = await supabaseAdmin
      .from('profile_entity_types')
      .select(`
        id,
        income_profiles (
          key,
          name
        ),
        entity_types (
          key,
          name
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Profile-entity mapping not found' },
        { status: 404 }
      )
    }

    // Delete the mapping
    const { error: deleteError } = await supabaseAdmin
      .from('profile_entity_types')
      .delete()
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting profile entity type', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete mapping' },
        { status: 500 }
      )
    }

    const profile = existing.income_profiles as { key: string; name: string }
    const entityType = existing.entity_types as { key: string; name: string }

    return NextResponse.json({
      success: true,
      message: `Removed "${entityType.name}" from "${profile.name}" profile`
    })

  } catch (error) {
    apiLogger.error('Profile Entity Type DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
