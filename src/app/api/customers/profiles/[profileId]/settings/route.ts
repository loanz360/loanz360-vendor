import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch profile settings
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
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') || 'INDIVIDUAL'

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access to this profile
    if (profileType === 'INDIVIDUAL') {
      const { data: individual } = await supabase
        .from('individuals')
        .select('is_default')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      // Return default settings structure for individuals
      return NextResponse.json({
        success: true,
        settings: {
          profile_id: profileId,
          profile_type: 'INDIVIDUAL',
          is_default: individual.is_default || false,
          notifications: {
            email_notifications: true,
            sms_notifications: false,
            verification_updates: true,
            document_expiry_alerts: true,
            activity_alerts: false
          },
          privacy: {
            profile_visibility: 'PRIVATE',
            share_with_lenders: true
          }
        }
      })
    } else {
      // Check entity membership
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

      // Return default settings structure for entities
      return NextResponse.json({
        success: true,
        settings: {
          profile_id: profileId,
          profile_type: 'ENTITY',
          is_default: false,
          notifications: {
            email_notifications: true,
            sms_notifications: false,
            verification_updates: true,
            document_expiry_alerts: true,
            activity_alerts: false
          },
          privacy: {
            profile_visibility: 'PRIVATE',
            share_with_lenders: true
          }
        }
      })
    }
  } catch (error) {
    apiLogger.error('Error in settings API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update profile settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { profile_type, notifications, privacy } = body

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access to this profile
    if (profile_type === 'INDIVIDUAL') {
      const { data: individual } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    } else {
      const { data: membership } = await supabase
        .from('entity_members')
        .select('can_manage_entity')
        .eq('entity_id', profileId)
        .eq('status', 'ACTIVE')
        .eq('individual.auth_user_id', userId)
        .maybeSingle()

      if (!membership || !membership.can_manage_entity) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // TODO: Store settings in a profile_settings table
    // For now, just return success with the updated settings
    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        profile_id: profileId,
        profile_type,
        notifications,
        privacy
      }
    })
  } catch (error) {
    apiLogger.error('Error in settings update API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Set profile as default
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId } = await params
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') || 'INDIVIDUAL'

    const supabase = await createClient()
    const userId = auth.userId

    if (profileType === 'INDIVIDUAL') {
      // Verify access
      const { data: individual } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }

      // Unset all default individuals for this user
      await supabase
        .from('individuals')
        .update({ is_default: false })
        .eq('auth_user_id', userId)

      // Set this profile as default
      const { error } = await supabase
        .from('individuals')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', profileId)

      if (error) {
        apiLogger.error('Error setting default profile', error)
        return NextResponse.json(
          { success: false, error: 'Failed to set default profile' },
          { status: 500 }
        )
      }
    } else {
      // For entities, just verify access (entities don't have is_default flag)
      const { data: membership } = await supabase
        .from('entity_members')
        .select('id')
        .eq('entity_id', profileId)
        .eq('status', 'ACTIVE')
        .eq('individual.auth_user_id', userId)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile set as default successfully'
    })
  } catch (error) {
    apiLogger.error('Error in set default profile API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
