export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// DELETE - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; memberId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, memberId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has permission to manage this entity
    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', profileId)
      .eq('status', 'ACTIVE')
      .eq('individual.auth_user_id', userId)
      .maybeSingle()

    if (!membership || !membership.can_manage_entity) {
      return NextResponse.json(
        { success: false, error: 'Access denied - requires management permission' },
        { status: 403 }
      )
    }

    // Get member details before deletion for logging
    const { data: memberToDelete } = await supabase
      .from('entity_members')
      .select(`
        role_name,
        individual:individuals (
          full_name
        )
      `)
      .eq('id', memberId)
      .eq('entity_id', profileId)
      .maybeSingle()

    if (!memberToDelete) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      )
    }

    // Delete member
    const { error } = await supabase
      .from('entity_members')
      .delete()
      .eq('id', memberId)
      .eq('entity_id', profileId)

    if (error) {
      apiLogger.error('Error deleting member', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete member' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('profile_activity_log')
      .insert({
        profile_id: profileId,
        profile_type: 'ENTITY',
        activity_type: 'MEMBER_REMOVED',
        description: `Removed ${memberToDelete.individual.full_name} (${memberToDelete.role_name}) from entity`,
        performed_by: userId
      })

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })
  } catch (error) {
    apiLogger.error('Error in delete member API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update member permissions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; memberId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, memberId } = await params
    const body = await request.json()
    const {
      role_key,
      role_name,
      can_sign_documents,
      can_apply_for_loans,
      can_manage_entity,
      is_primary
    } = body

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has permission to manage this entity
    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', profileId)
      .eq('status', 'ACTIVE')
      .eq('individual.auth_user_id', userId)
      .maybeSingle()

    if (!membership || !membership.can_manage_entity) {
      return NextResponse.json(
        { success: false, error: 'Access denied - requires management permission' },
        { status: 403 }
      )
    }

    // If setting as primary, unset other primary members
    if (is_primary) {
      await supabase
        .from('entity_members')
        .update({ is_primary: false })
        .eq('entity_id', profileId)
        .neq('id', memberId)
    }

    // Update member
    const { data: updatedMember, error } = await supabase
      .from('entity_members')
      .update({
        role_key,
        role_name,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        is_primary,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .eq('entity_id', profileId)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating member', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update member' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('profile_activity_log')
      .insert({
        profile_id: profileId,
        profile_type: 'ENTITY',
        activity_type: 'MEMBER_UPDATED',
        description: `Updated member permissions`,
        performed_by: userId
      })

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: 'Member updated successfully'
    })
  } catch (error) {
    apiLogger.error('Error in update member API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
