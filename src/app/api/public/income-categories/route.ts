export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/public/income-categories
 *
 * PUBLIC endpoint - No authentication required.
 *
 * Fetches all active income categories for the customer portal registration flow.
 * This endpoint is used by the Add New Profile page to display available categories.
 *
 * Security:
 * - Only returns active categories (is_active = true)
 * - Uses service role client with RLS bypassed for read-only access
 * - Rate limited via middleware
 *
 * Returns:
 * - id: UUID of the category
 * - key: Unique identifier (e.g., 'SALARIED', 'PROFESSIONAL')
 * - name: Display name
 * - description: Category description
 * - icon: Lucide icon name
 * - color: Hex color code
 * - route: URL path segment
 * - display_order: Sort order
 * - show_entity_profile: Whether entity selection step is required
 * - profile_count: Number of active profiles under this category
 */
export async function GET(request: NextRequest) {
  try {
    // Use service role client for public read access
    const supabase = createServiceRoleClient()

    // Fetch all active income categories (simple query without joins for reliability)
    const { data: categories, error } = await supabase
      .from('income_categories')
      .select(`
        id,
        key,
        name,
        description,
        icon,
        color,
        route,
        display_order,
        show_entity_profile
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching public income categories', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch income categories'
      }, { status: 500 })
    }

    // Get profile counts for each category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (cat) => {
        const { count } = await supabase
          .from('income_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id)
          .eq('is_active', true)

        return {
          id: cat.id,
          key: cat.key,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          route: cat.route,
          display_order: cat.display_order,
          show_entity_profile: cat.show_entity_profile,
          profile_count: count || 0
        }
      })
    )

    // Add cache headers for performance (cache for 5 minutes)
    const response = NextResponse.json({
      success: true,
      data: categoriesWithCounts,
      source: 'database',
      cached_at: new Date().toISOString()
    })

    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response
  } catch (error) {
    apiLogger.error('Error in public income-categories API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * OPTIONS - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
