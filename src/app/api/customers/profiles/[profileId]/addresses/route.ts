import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

// GET - Fetch all addresses for a profile
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
    }

    // Fetch addresses
    const { data: addresses, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      apiLogger.error('Error fetching addresses', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch addresses' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      addresses: addresses || []
    })
  } catch (error) {
    apiLogger.error('Error in addresses API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new address
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

      profile_type: z.string().optional(),

      address_type: z.string().optional(),

      address_line_1: z.string().optional(),

      address_line_2: z.string().optional(),

      landmark: z.string().optional(),

      city: z.string().optional(),

      state: z.string().optional(),

      pin_code: z.string().optional(),

      country: z.string().optional(),

      is_primary: z.boolean().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
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
      // Check entity membership with permission
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
    }

    // Insert new address
    const { data: address, error } = await supabase
      .from('addresses')
      .insert({
        profile_id: profileId,
        profile_type,
        address_type,
        address_line_1,
        address_line_2,
        landmark,
        city,
        state,
        pin_code,
        country: country || 'India',
        is_primary: is_primary || false
      })
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating address', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create address' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      address
    })
  } catch (error) {
    apiLogger.error('Error in addresses API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
