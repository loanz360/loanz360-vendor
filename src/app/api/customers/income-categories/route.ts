export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/income-categories
 *
 * Fetches all active income categories for customer profile creation.
 * This endpoint is accessible to authenticated customers.
 *
 * For public access (registration flow), use /api/public/income-categories
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
 * - profile_count: Number of profiles under this category
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()

    // Fetch all active income categories with profile counts
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
        is_active,
        show_entity_profile,
        created_at,
        updated_at,
        income_profiles(count)
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching income categories', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch income categories'
      }, { status: 500 })
    }

    // Transform the data to include profile_count
    const transformedCategories = (categories || []).map(cat => ({
      ...cat,
      profile_count: cat.income_profiles?.[0]?.count || 0,
      income_profiles: undefined // Remove the nested array
    }))

    return NextResponse.json({
      success: true,
      data: transformedCategories,
      source: 'database'
    })
  } catch (error) {
    apiLogger.error('Error in income-categories API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
