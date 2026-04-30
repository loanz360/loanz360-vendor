/**
 * BDM Team Targets - Available Badges API
 * Returns list of all badges that can be earned
 * BDM access only
 *
 * Rate Limit: 60 requests per minute
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { readRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  return readRateLimiter(request, async (req) => {
    return await getAvailableBadgesHandler(req)
  })
}

async function getAvailableBadgesHandler(request: NextRequest) {
  try {
    // =====================================================
    // 1. VERIFY AUTHENTICATION
    // =====================================================

    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Verify BDM role
    if (auth.user?.sub_role !== 'BUSINESS_DEVELOPMENT_MANAGER' && !auth.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: BDM access required',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()

    // =====================================================
    // 2. GET QUERY PARAMETERS
    // =====================================================

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') // Optional filter
    const rarity = searchParams.get('rarity') // Optional filter

    // =====================================================
    // 3. FETCH BADGES
    // =====================================================

    let query = supabase
      .from('achievement_badges')
      .select('*')
      .eq('is_active', true)
      .order('rarity', { ascending: false })
      .order('category', { ascending: true })
      .order('badge_name', { ascending: true })

    // Apply filters if provided
    if (category) {
      query = query.eq('category', category)
    }
    if (rarity) {
      query = query.eq('rarity', rarity)
    }

    const { data: badges, error: badgesError } = await query

    if (badgesError) {
      apiLogger.error('Error fetching badges', badgesError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch badges',
        },
        { status: 500 }
      )
    }

    // =====================================================
    // 4. FORMAT BADGES
    // =====================================================

    const formattedBadges = badges?.map((badge) => ({
      id: badge.id,
      code: badge.badge_code,
      name: badge.badge_name,
      description: badge.badge_description,
      icon: badge.icon,
      color: badge.color,
      category: badge.category,
      rarity: badge.rarity,
      points: badge.points,
      isAutoAwarded: badge.is_auto_awarded,
      criteria: badge.criteria,
      displayOrder: badge.display_order,
    }))

    // =====================================================
    // 5. GROUP BY CATEGORY AND RARITY
    // =====================================================

    const byCategory = formattedBadges?.reduce(
      (acc, badge) => {
        const cat = badge.category || 'other'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(badge)
        return acc
      },
      {} as Record<string, typeof formattedBadges>
    )

    const byRarity = formattedBadges?.reduce(
      (acc, badge) => {
        const rar = badge.rarity || 'common'
        if (!acc[rar]) acc[rar] = []
        acc[rar].push(badge)
        return acc
      },
      {} as Record<string, typeof formattedBadges>
    )

    // =====================================================
    // 6. BUILD RESPONSE
    // =====================================================

    return NextResponse.json({
      success: true,
      data: {
        badges: formattedBadges || [],
        count: formattedBadges?.length || 0,
        byCategory,
        byRarity,
        summary: {
          total: formattedBadges?.length || 0,
          legendary: byRarity?.legendary?.length || 0,
          epic: byRarity?.epic?.length || 0,
          rare: byRarity?.rare?.length || 0,
          common: byRarity?.common?.length || 0,
          performance: byCategory?.performance?.length || 0,
          consistency: byCategory?.consistency?.length || 0,
          quality: byCategory?.quality?.length || 0,
          milestone: byCategory?.milestone?.length || 0,
          team: byCategory?.team?.length || 0,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    apiLogger.error('Error in getAvailableBadgesHandler', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
