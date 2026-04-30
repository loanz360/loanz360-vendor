import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch all entity members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access to this entity
    const { data: membership } = await supabase
      .from('entity_members')
      .select('id')
      .eq('entity_id', profileId)
      .eq('status', 'ACTIVE')
      .eq('individual.auth_user_id', userId)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Fetch all members with individual details
    const { data: members, error } = await supabase
      .from('entity_members')
      .select(`
        id,
        role_key,
        role_name,
        is_primary,
        joined_date,
        left_date,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        status,
        created_at,
        individual:individuals (
          id,
          full_name,
          email,
          phone,
          kyc_status,
          profile_photo_url
        )
      `)
      .eq('entity_id', profileId)
      .order('is_primary', { ascending: false })
      .order('joined_date', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching members', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch members' },
        { status: 500 }
      )
    }

    // Transform the data
    const transformedMembers = members.map(member => ({
      id: member.id,
      individual_id: member.individual.id,
      full_name: member.individual.full_name,
      email: member.individual.email,
      phone: member.individual.phone,
      role: member.role_key,
      designation: member.role_name,
      joining_date: member.joined_date,
      status: member.status,
      can_sign_documents: member.can_sign_documents,
      can_manage_entity: member.can_manage_entity,
      is_primary_contact: member.is_primary,
      kyc_status: member.individual.kyc_status || 'NOT_VERIFIED',
      profile_photo_url: member.individual.profile_photo_url,
      created_at: member.created_at
    }))

    return NextResponse.json({
      success: true,
      members: transformedMembers
    })
  } catch (error) {
    apiLogger.error('Error in members API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const bodySchema = z.object({

      individual_id: z.string().uuid().optional(),

      role_key: z.string().optional(),

      role_name: z.string().optional(),

      can_sign_documents: z.string().optional(),

      can_apply_for_loans: z.string().optional(),

      can_manage_entity: z.string().optional(),

      is_primary: z.boolean().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const {
      individual_id,
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

    // Verify the individual exists and belongs to the same user
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('id', individual_id)
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (!individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found or access denied' },
        { status: 404 }
      )
    }

    // Check if membership already exists
    const { data: existing } = await supabase
      .from('entity_members')
      .select('id')
      .eq('entity_id', profileId)
      .eq('individual_id', individual_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'This individual is already a member' },
        { status: 400 }
      )
    }

    // If setting as primary, unset other primary members
    if (is_primary) {
      await supabase
        .from('entity_members')
        .update({ is_primary: false })
        .eq('entity_id', profileId)
    }

    // Insert new member
    const { data: newMember, error } = await supabase
      .from('entity_members')
      .insert({
        entity_id: profileId,
        individual_id,
        role_key: role_key || 'MEMBER',
        role_name: role_name || 'Member',
        is_primary: is_primary || false,
        can_sign_documents: can_sign_documents || false,
        can_apply_for_loans: can_apply_for_loans || false,
        can_manage_entity: can_manage_entity || false,
        status: 'ACTIVE',
        joined_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error adding member', error)
      return NextResponse.json(
        { success: false, error: 'Failed to add member' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase
      .from('profile_activity_log')
      .insert({
        profile_id: profileId,
        profile_type: 'ENTITY',
        activity_type: 'MEMBER_ADDED',
        description: `Added ${role_name || 'Member'} to entity`,
        performed_by: userId
      })

    return NextResponse.json({
      success: true,
      member: newMember,
      message: 'Member added successfully'
    })
  } catch (error) {
    apiLogger.error('Error in add member API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
