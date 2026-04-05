export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/entity/members
 *
 * Fetches all members of an entity.
 * User must be an admin of the entity.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')

    if (!entityId) {
      return NextResponse.json(
        { success: false, error: 'Entity ID is required' },
        { status: 400 }
      )
    }

    // Verify user is admin of this entity
    const isAdmin = await verifyEntityAdmin(supabase, user.id, entityId)

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have admin access to this entity' },
        { status: 403 }
      )
    }

    // Fetch all members with their individual details
    const { data: members, error } = await supabase
      .from('entity_members')
      .select(`
        id,
        role_key,
        role_name,
        is_primary,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        status,
        joined_date,
        created_at,
        individual:individuals(
          id,
          full_name,
          email,
          phone,
          profile_photo_url
        )
      `)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching entity members', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      members: members || []
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/entity/members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/entity/members
 *
 * Adds a new member to an entity.
 * User must be an admin of the entity.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entityId, individualId, role_key, role_name, canSignDocuments, canApplyForLoans, canManageEntity } = body

    if (!entityId || !individualId || !role_key) {
      return NextResponse.json(
        { success: false, error: 'Entity ID, individual ID, and role_key are required' },
        { status: 400 }
      )
    }

    // Verify user is admin of this entity
    const isEntityAdmin = await verifyEntityAdmin(supabase, user.id, entityId)

    if (!isEntityAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have admin access to this entity' },
        { status: 403 }
      )
    }

    // Check if the individual exists
    const { data: individual, error: individualError } = await supabase
      .from('individuals')
      .select('id, full_name')
      .eq('id', individualId)
      .maybeSingle()

    if (individualError || !individual) {
      return NextResponse.json(
        { success: false, error: 'Individual not found' },
        { status: 404 }
      )
    }

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('entity_members')
      .select('id')
      .eq('entity_id', entityId)
      .eq('individual_id', individualId)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: 'This individual is already a member of this entity' },
        { status: 409 }
      )
    }

    // Create member record
    const { data: member, error: memberError } = await supabase
      .from('entity_members')
      .insert({
        entity_id: entityId,
        individual_id: individualId,
        role_key,
        role_name: role_name || role_key,
        can_sign_documents: canSignDocuments || false,
        can_apply_for_loans: canApplyForLoans || false,
        can_manage_entity: canManageEntity || false,
        status: 'ACTIVE'
      })
      .select(`
        id,
        role_key,
        role_name,
        is_primary,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        status,
        created_at,
        individual:individuals(
          id,
          full_name,
          email,
          phone
        )
      `)
      .maybeSingle()

    if (memberError) {
      apiLogger.error('Error adding entity member', memberError)
      return NextResponse.json(
        { success: false, error: 'Failed to add member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Member added successfully',
      member
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/entity/members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/customers/entity/members
 *
 * Updates an existing member's role or status.
 * User must be an admin of the entity.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { memberId, entityId, role_key, role_name, canSignDocuments, canApplyForLoans, canManageEntity, isPrimary, status } = body

    if (!memberId || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Member ID and Entity ID are required' },
        { status: 400 }
      )
    }

    // Verify user is admin of this entity
    const isEntityAdmin = await verifyEntityAdmin(supabase, user.id, entityId)

    if (!isEntityAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have admin access to this entity' },
        { status: 403 }
      )
    }

    // Build update object with correct column names
    const updateData: Record<string, unknown> = {}

    if (role_key !== undefined) updateData.role_key = role_key
    if (role_name !== undefined) updateData.role_name = role_name
    if (canSignDocuments !== undefined) updateData.can_sign_documents = canSignDocuments
    if (canApplyForLoans !== undefined) updateData.can_apply_for_loans = canApplyForLoans
    if (canManageEntity !== undefined) updateData.can_manage_entity = canManageEntity
    if (isPrimary !== undefined) updateData.is_primary = isPrimary
    if (status !== undefined) updateData.status = status

    // Update member
    const { data: member, error: memberError } = await supabase
      .from('entity_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('entity_id', entityId)
      .select(`
        id,
        role_key,
        role_name,
        is_primary,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        status,
        created_at,
        individual:individuals(
          id,
          full_name,
          email,
          phone
        )
      `)
      .maybeSingle()

    if (memberError) {
      apiLogger.error('Error updating entity member', memberError)
      return NextResponse.json(
        { success: false, error: 'Failed to update member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Member updated successfully',
      member
    })
  } catch (error) {
    apiLogger.error('Unexpected error in PUT /api/customers/entity/members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/entity/members
 *
 * Removes a member from an entity (soft delete by setting status to INACTIVE).
 * User must be an admin of the entity.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const entityId = searchParams.get('entityId')

    if (!memberId || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Member ID and Entity ID are required' },
        { status: 400 }
      )
    }

    // Verify user is admin of this entity
    const isEntityAdmin = await verifyEntityAdmin(supabase, user.id, entityId)

    if (!isEntityAdmin) {
      return NextResponse.json(
        { success: false, error: 'You do not have admin access to this entity' },
        { status: 403 }
      )
    }

    // Get the member to check if they are trying to remove themselves
    const { data: memberToRemove } = await supabase
      .from('entity_members')
      .select('individual_id, can_manage_entity')
      .eq('id', memberId)
      .eq('entity_id', entityId)
      .maybeSingle()

    if (!memberToRemove) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      )
    }

    // Get current user's individual identity
    const { data: currentUserIdentity } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // Prevent manager from removing themselves if they are the only manager
    if (currentUserIdentity && memberToRemove.individual_id === currentUserIdentity.id) {
      // Count other managers
      const { count } = await supabase
        .from('entity_members')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', entityId)
        .eq('can_manage_entity', true)
        .eq('status', 'ACTIVE')
        .neq('id', memberId)

      if (count === 0) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the only admin. Please assign another admin first.' },
          { status: 400 }
        )
      }
    }

    // Soft delete by setting status to INACTIVE
    const { error: deleteError } = await supabase
      .from('entity_members')
      .update({
        status: 'INACTIVE',
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .eq('entity_id', entityId)

    if (deleteError) {
      apiLogger.error('Error removing entity member', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })
  } catch (error) {
    apiLogger.error('Unexpected error in DELETE /api/customers/entity/members', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to verify if a user can manage an entity
 * Checks both direct entity ownership and entity_members.can_manage_entity
 */
async function verifyEntityAdmin(
  supabase: SupabaseClient,
  userId: string,
  entityId: string
): Promise<boolean> {
  // Check if user has an individual profile that is a managing member
  const { data: individual } = await supabase
    .from('individuals')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (individual) {
    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', entityId)
      .eq('individual_id', individual.id)
      .eq('can_manage_entity', true)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (membership) {
      return true
    }
  }

  return false
}
