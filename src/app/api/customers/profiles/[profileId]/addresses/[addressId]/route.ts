import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// PUT - Update an address
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; addressId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, addressId } = await params
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      profile_type,
      address_type,
      address_line_1,
      address_line_2,
      landmark,
      city,
      state,
      pin_code,
      country,
      is_primary
    } = body

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

    // If setting as primary, unset other primary addresses
    if (is_primary) {
      await supabase
        .from('addresses')
        .update({ is_primary: false })
        .eq('profile_id', profileId)
        .eq('profile_type', profile_type)
        .neq('id', addressId)
    }

    // Update address
    const { data: address, error } = await supabase
      .from('addresses')
      .update({
        address_type,
        address_line_1,
        address_line_2,
        landmark,
        city,
        state,
        pin_code,
        country,
        is_primary,
        updated_at: new Date().toISOString()
      })
      .eq('id', addressId)
      .eq('profile_id', profileId)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating address', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update address' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      address
    })
  } catch (error) {
    apiLogger.error('Error in address update API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; addressId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, addressId } = await params
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') || 'INDIVIDUAL'

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access to this profile
    if (profileType === 'INDIVIDUAL') {
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

    // Delete address
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('profile_id', profileId)

    if (error) {
      apiLogger.error('Error deleting address', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete address' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully'
    })
  } catch (error) {
    apiLogger.error('Error in address delete API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Set address as primary
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string; addressId: string }> }
) {
  try {
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
    }

    const { profileId, addressId } = await params
    const { searchParams } = new URL(request.url)
    const profileType = searchParams.get('profile_type') || 'INDIVIDUAL'

    const supabase = await createClient()
    const userId = auth.userId

    // Verify user has access
    if (profileType === 'INDIVIDUAL') {
      const { data: individual } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individual) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
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
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      }
    }

    // Unset all primary addresses
    await supabase
      .from('addresses')
      .update({ is_primary: false })
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)

    // Set this address as primary
    const { data: address, error } = await supabase
      .from('addresses')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', addressId)
      .eq('profile_id', profileId)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error setting primary address', error)
      return NextResponse.json(
        { success: false, error: 'Failed to set primary address' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      address
    })
  } catch (error) {
    apiLogger.error('Error in set primary address API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
