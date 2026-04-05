export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/bdm/team-targets/badges
// List all available badges
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const rarity = searchParams.get('rarity')
    const isActive = searchParams.get('isActive') !== 'false' // Default to true

    // Build query
    let query = supabase
      .from('achievement_badges')
      .select('*')
      .order('display_order', { ascending: true })

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }

    if (rarity) {
      query = query.eq('rarity', rarity)
    }

    if (isActive) {
      query = query.eq('is_active', true)
    }

    const { data: badges, error } = await query

    if (error) throw error

    // Get statistics
    const stats = {
      total: badges?.length || 0,
      byCategory: {} as Record<string, number>,
      byRarity: {} as Record<string, number>,
    }

    badges?.forEach(badge => {
      stats.byCategory[badge.category] = (stats.byCategory[badge.category] || 0) + 1
      stats.byRarity[badge.rarity] = (stats.byRarity[badge.rarity] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      data: {
        badges: badges || [],
        stats,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Error fetching badges', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
