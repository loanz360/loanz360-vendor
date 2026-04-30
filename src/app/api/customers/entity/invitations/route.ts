
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import crypto from 'crypto'
import { apiLogger } from '@/lib/utils/logger'

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * GET /api/customers/entity/invitations
 * List all invitations for an entity
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')
    const status = searchParams.get('status') // Optional filter

    if (!entityId) {
      return NextResponse.json(
        { success: false, error: 'Entity ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user has management access to this entity
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', auth.userId)
      .maybeSingle()

    if (!individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found' },
        { status: 404 }
      )
    }

    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', entityId)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!membership?.can_manage_entity) {
      return NextResponse.json(
        { success: false, error: 'Access denied - requires management permission' },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from('entity_member_invitations')
      .select(`
        id,
        invite_code,
        email,
        mobile,
        full_name,
        role_key,
        role_name,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        shareholding_percentage,
        status,
        created_at,
        expires_at,
        accepted_at,
        personal_message,
        email_sent_at,
        sms_sent_at
      `)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: invitations, error } = await query

    if (error) {
      apiLogger.error('Error fetching invitations', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invitations: invitations || []
    })
  } catch (error) {
    apiLogger.error('Error in GET invitations', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/entity/invitations
 * Create a new invitation
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      entityId,
      email,
      mobile,
      fullName,
      roleKey,
      roleName,
      canSignDocuments = false,
      canApplyForLoans = false,
      canManageEntity = false,
      shareholdingPercentage,
      personalMessage,
      expiresInDays = 7
    } = body

    // Validation
    if (!entityId || !fullName || !roleKey || !roleName) {
      return NextResponse.json(
        { success: false, error: 'Entity ID, full name, role key, and role name are required' },
        { status: 400 }
      )
    }

    if (!email && !mobile) {
      return NextResponse.json(
        { success: false, error: 'Either email or mobile number is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user has management access to this entity
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', auth.userId)
      .maybeSingle()

    if (!individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found' },
        { status: 404 }
      )
    }

    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', entityId)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!membership?.can_manage_entity) {
      return NextResponse.json(
        { success: false, error: 'Access denied - requires management permission' },
        { status: 403 }
      )
    }

    // Check for duplicate pending invitations
    const { data: existingInvite } = await supabase
      .from('entity_member_invitations')
      .select('id')
      .eq('entity_id', entityId)
      .eq('status', 'PENDING')
      .or(`email.eq.${email},mobile.eq.${mobile}`)
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: 'A pending invitation already exists for this email/mobile' },
        { status: 409 }
      )
    }

    // Generate invite code and calculate expiry
    const inviteCode = generateInviteCode()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('entity_member_invitations')
      .insert({
        entity_id: entityId,
        invite_code: inviteCode,
        email: email || null,
        mobile: mobile || null,
        full_name: fullName,
        role_key: roleKey,
        role_name: roleName,
        can_sign_documents: canSignDocuments,
        can_apply_for_loans: canApplyForLoans,
        can_manage_entity: canManageEntity,
        shareholding_percentage: shareholdingPercentage || null,
        personal_message: personalMessage || null,
        expires_at: expiresAt.toISOString(),
        invited_by: auth.userId,
        status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating invitation', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Get entity details for notification
    const { data: entity } = await supabase
      .from('entities')
      .select('legal_name, trading_name')
      .eq('id', entityId)
      .maybeSingle()

    // TODO: Send email notification
    if (email) {
      try {
        await sendInvitationEmail({
          to: email,
          inviteeName: fullName,
          entityName: entity?.trading_name || entity?.legal_name || 'Unknown Entity',
          roleName,
          inviteCode,
          personalMessage,
          expiresAt
        })

        // Update email_sent_at
        await supabase
          .from('entity_member_invitations')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', invitation.id)
      } catch (emailError) {
        apiLogger.error('Failed to send invitation email', emailError)
        // Don't fail the request, just log
      }
    }

    // TODO: Send SMS notification
    if (mobile) {
      try {
        await sendInvitationSMS({
          to: mobile,
          inviteeName: fullName,
          entityName: entity?.trading_name || entity?.legal_name || 'Unknown Entity',
          inviteCode
        })

        // Update sms_sent_at
        await supabase
          .from('entity_member_invitations')
          .update({ sms_sent_at: new Date().toISOString() })
          .eq('id', invitation.id)
      } catch (smsError) {
        apiLogger.error('Failed to send invitation SMS', smsError)
        // Don't fail the request, just log
      }
    }

    // Generate the invitation link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loanz360.com'
    const invitationLink = `${baseUrl}/customers/invitation/${inviteCode}`

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        invitationLink
      },
      message: 'Invitation sent successfully'
    })
  } catch (error) {
    apiLogger.error('Error in POST invitations', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customers/entity/invitations
 * Cancel an invitation
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.userId) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')
    const entityId = searchParams.get('entityId')

    if (!invitationId || !entityId) {
      return NextResponse.json(
        { success: false, error: 'Invitation ID and Entity ID are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify user has management access to this entity
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', auth.userId)
      .maybeSingle()

    if (!individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found' },
        { status: 404 }
      )
    }

    const { data: membership } = await supabase
      .from('entity_members')
      .select('can_manage_entity')
      .eq('entity_id', entityId)
      .eq('individual_id', individual.id)
      .eq('status', 'ACTIVE')
      .maybeSingle()

    if (!membership?.can_manage_entity) {
      return NextResponse.json(
        { success: false, error: 'Access denied - requires management permission' },
        { status: 403 }
      )
    }

    // Cancel the invitation
    const { error } = await supabase
      .from('entity_member_invitations')
      .update({ status: 'CANCELLED' })
      .eq('id', invitationId)
      .eq('entity_id', entityId)
      .eq('status', 'PENDING')

    if (error) {
      apiLogger.error('Error cancelling invitation', error)
      return NextResponse.json(
        { success: false, error: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled successfully'
    })
  } catch (error) {
    apiLogger.error('Error in DELETE invitations', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Placeholder function for sending invitation email
 * Will be implemented with actual email service
 */
async function sendInvitationEmail(params: {
  to: string
  inviteeName: string
  entityName: string
  roleName: string
  inviteCode: string
  personalMessage?: string
  expiresAt: Date
}): Promise<void> {
  // TODO: Implement with actual email service (e.g., SendGrid, Resend, etc.)
}

/**
 * Placeholder function for sending invitation SMS
 * Will be implemented with actual SMS service
 */
async function sendInvitationSMS(params: {
  to: string
  inviteeName: string
  entityName: string
  inviteCode: string
}): Promise<void> {
  // TODO: Implement with actual SMS service (e.g., Twilio, MSG91, etc.)
}
