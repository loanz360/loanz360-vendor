
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

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
    const { profile_id, profile_type } = body

    if (!profile_id || !profile_type) {
      return NextResponse.json({ success: false, error: 'Missing profile_id or profile_type' }, { status: 400 })
    }

    const userId = auth.userId
    const adminSupabase = createSupabaseAdmin()

    // Verify the user has access to this profile
    if (profile_type === 'INDIVIDUAL') {
      const { data: individual, error } = await adminSupabase
        .from('individuals')
        .select('id')
        .eq('id', profile_id)
        .eq('auth_user_id', userId)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (error || !individual) {
        return NextResponse.json({ success: false, error: 'Individual profile not found or access denied' }, { status: 403 })
      }
    } else if (profile_type === 'ENTITY') {
      // First get the individual profile
      const { data: individual } = await adminSupabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!individual) {
        return NextResponse.json({ success: false, error: 'Individual profile not found' }, { status: 403 })
      }

      // Check if user has access to this entity
      const { data: link, error: linkError } = await adminSupabase
        .from('individual_entity_links')
        .select('id')
        .eq('individual_id', individual.id)
        .eq('entity_id', profile_id)
        .eq('invitation_status', 'ACTIVE')
        .maybeSingle()

      if (linkError || !link) {
        return NextResponse.json({ success: false, error: 'Entity profile not found or access denied' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ success: false, error: 'Invalid profile type' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Profile switched successfully',
      profile: {
        id: profile_id,
        type: profile_type
      }
    })
  } catch (error) {
    apiLogger.error('Error in profiles/switch API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
