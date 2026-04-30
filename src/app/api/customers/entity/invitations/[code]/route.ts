import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/entity/invitations/[code]
 * Get invitation details by code (public - for acceptance page)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Invitation code is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get invitation with entity details
    const { data: invitation, error } = await supabase
      .from('entity_member_invitations')
      .select(`
        id,
        invite_code,
        full_name,
        email,
        mobile,
        role_key,
        role_name,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        shareholding_percentage,
        personal_message,
        status,
        expires_at,
        created_at,
        entity:entities (
          id,
          legal_name,
          trading_name,
          logo_url,
          entity_type_id,
          verification_status
        )
      `)
      .eq('invite_code', code)
      .maybeSingle()

    if (error || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    const isExpired = now > expiresAt

    if (isExpired && invitation.status === 'PENDING') {
      // Mark as expired
      await supabase
        .from('entity_member_invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        invitation: {
          ...invitation,
          status: 'EXPIRED'
        },
        isValid: false,
        message: 'This invitation has expired'
      })
    }

    const isValid = invitation.status === 'PENDING'

    return NextResponse.json({
      success: true,
      invitation,
      isValid,
      message: isValid ? undefined : `This invitation is ${invitation.status.toLowerCase()}`
    })
  } catch (error) {
    apiLogger.error('Error in GET invitation by code', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/entity/invitations/[code]
 * Accept or reject an invitation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Invitation code is required' },
        { status: 400 }
      )
    }

    // User must be authenticated to accept
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Please log in to accept this invitation' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      action: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { action } = body // 'accept' or 'reject'

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "accept" or "reject"' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get invitation
    const { data: invitation, error: fetchError } = await supabase
      .from('entity_member_invitations')
      .select('*')
      .eq('invite_code', code)
      .eq('status', 'PENDING')
      .maybeSingle()

    if (fetchError || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)
    if (now > expiresAt) {
      await supabase
        .from('entity_member_invitations')
        .update({ status: 'EXPIRED' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { success: false, error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    if (action === 'reject') {
      // Update invitation status to rejected
      await supabase
        .from('entity_member_invitations')
        .update({ status: 'REJECTED' })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        message: 'Invitation rejected'
      })
    }

    // Action is 'accept'
    // Get the user's individual profile
    const { data: individual, error: indError } = await supabase
      .from('individuals')
      .select('id, full_name')
      .eq('auth_user_id', auth.userId)
      .maybeSingle()

    if (indError || !individual) {
      return NextResponse.json(
        { success: false, error: 'Please complete your individual profile first' },
        { status: 400 }
      )
    }

    // Check if already a member of this entity
    const { data: existingMember } = await supabase
      .from('entity_members')
      .select('id')
      .eq('entity_id', invitation.entity_id)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (existingMember) {
      // Just mark invitation as accepted
      await supabase
        .from('entity_member_invitations')
        .update({
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
          accepted_by_individual_id: individual.id
        })
        .eq('id', invitation.id)

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this entity',
        alreadyMember: true
      })
    }

    // Create entity membership
    const { error: memberError } = await supabase
      .from('entity_members')
      .insert({
        entity_id: invitation.entity_id,
        individual_id: individual.id,
        role_key: invitation.role_key,
        role_name: invitation.role_name,
        is_primary: false,
        can_sign_documents: invitation.can_sign_documents,
        can_apply_for_loans: invitation.can_apply_for_loans,
        can_manage_entity: invitation.can_manage_entity,
        status: 'ACTIVE',
        joined_date: new Date().toISOString().split('T')[0]
      })

    if (memberError) {
      apiLogger.error('Error creating membership', memberError)
      return NextResponse.json(
        { success: false, error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Update invitation status
    await supabase
      .from('entity_member_invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
        accepted_by_individual_id: individual.id
      })
      .eq('id', invitation.id)

    // Log activity
    await supabase
      .from('profile_activity_log')
      .insert({
        profile_id: invitation.entity_id,
        profile_type: 'ENTITY',
        activity_type: 'MEMBER_JOINED_VIA_INVITE',
        description: `${individual.full_name} joined as ${invitation.role_name}`,
        performed_by: auth.userId
      })

    // Get entity details for response
    const { data: entity } = await supabase
      .from('entities')
      .select('id, legal_name, trading_name')
      .eq('id', invitation.entity_id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${entity?.trading_name || entity?.legal_name}!`,
      entity: {
        id: entity?.id,
        name: entity?.trading_name || entity?.legal_name
      },
      role: invitation.role_name
    })
  } catch (error) {
    apiLogger.error('Error in POST invitation acceptance', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
