
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

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
    const { searchParams } = new URL(request.url)

    const profileType = searchParams.get('type') || 'INDIVIDUAL'
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify user has access to this profile (IDOR protection)
    if (profileType === 'INDIVIDUAL') {
      const { data: profile } = await supabase
        .from('individuals')
        .select('id')
        .eq('id', profileId)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    } else if (profileType === 'ENTITY') {
      const { data: individualProfile } = await supabase
        .from('individuals')
        .select('id')
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!individualProfile) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }

      const { data: membership } = await supabase
        .from('entity_members')
        .select('id')
        .eq('entity_id', profileId)
        .eq('individual_id', individualProfile.id)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Build query
    let query = supabase
      .from('profile_activity_recent')
      .select('*')
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by category if provided
    if (category) {
      query = query.eq('activity_category', category)
    }

    const { data: activities, error } = await query

    if (error) {
      apiLogger.error('Error fetching activity', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('profile_activity_log')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('profile_type', profileType)

    if (countError) {
      apiLogger.error('Error counting activity', countError)
    }

    return NextResponse.json({
      success: true,
      activities: activities || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })
  } catch (error) {
    apiLogger.error('Error in activity API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
