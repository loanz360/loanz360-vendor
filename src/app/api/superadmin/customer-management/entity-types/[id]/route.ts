import { parseBody } from '@/lib/utils/parse-body'

/**
 * Entity Type Detail API
 * SuperAdmin endpoint for managing individual entity types
 *
 * GET    - Fetch single entity type
 * PUT    - Update entity type
 * DELETE - Delete entity type (soft delete)
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
const roleSchema = z.object({
  code: z.string(),
  name: z.string(),
  can_apply_loan: z.boolean().optional(),
  can_view_financials: z.boolean().optional(),
  can_manage_members: z.boolean().optional(),
  can_sign_documents: z.boolean().optional(),
})

const updateEntityTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  short_name: z.string().max(20).optional(),
  description: z.string().optional(),
  category: z.enum(['INDIVIDUAL', 'PARTNERSHIP', 'CORPORATE', 'TRUST_NGO', 'COOPERATIVE', 'JOINT_VENTURE']).optional(),
  governing_act: z.string().optional(),
  registration_authority: z.string().optional(),
  pan_prefix: z.string().max(5).optional(),
  min_members: z.number().optional(),
  max_members: z.number().optional(),
  requires_registration: z.boolean().optional(),
  requires_din: z.boolean().optional(),
  requires_llpin: z.boolean().optional(),
  available_roles: z.array(roleSchema).optional(),
  required_documents: z.array(z.string()).optional(),
  compliance_requirements: z.array(z.string()).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  display_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/entity-types/[id]
 * Fetch single entity type with detailed info
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

    // Fetch entity type
    const { data: entityType, error } = await supabaseAdmin
      .from('entity_types')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !entityType) {
      return NextResponse.json(
        { success: false, error: 'Entity type not found' },
        { status: 404 }
      )
    }

    // Get entity count for this type
    const { count: entityCount } = await supabaseAdmin
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type_id', id)

    // Get recent entities of this type
    const { data: recentEntities } = await supabaseAdmin
      .from('entities')
      .select('id, display_id, legal_name, created_at')
      .eq('entity_type_id', id)
      .order('created_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      data: {
        ...entityType,
        entity_count: entityCount || 0,
        recent_entities: recentEntities || []
      }
    })

  } catch (error) {
    apiLogger.error('Entity Type GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/entity-types/[id]
 * Update an entity type
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
    const validatedData = updateEntityTypeSchema.parse(body)

    // Check if entity type exists
    const { data: existing } = await supabaseAdmin
      .from('entity_types')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Entity type not found' },
        { status: 404 }
      )
    }

    // Update entity type
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('entity_types')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating entity type', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update entity type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Entity type updated successfully'
    })

  } catch (error) {
    apiLogger.error('Entity Type PUT error', error)

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
 * DELETE /api/superadmin/customer-management/entity-types/[id]
 * Soft delete an entity type (set is_active = false)
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

    // Check if entity type has entities
    const { count: entityCount } = await supabaseAdmin
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('entity_type_id', id)

    if (entityCount && entityCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete entity type with ${entityCount} entities. Deactivate instead.` },
        { status: 400 }
      )
    }

    // Soft delete - set is_active to false
    const { error: deleteError } = await supabaseAdmin
      .from('entity_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting entity type', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete entity type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Entity type deactivated successfully'
    })

  } catch (error) {
    apiLogger.error('Entity Type DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
