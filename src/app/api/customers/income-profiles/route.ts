
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/income-profiles
 *
 * Fetches all active income profiles for customer profile creation.
 * Optionally filter by income_category_id.
 * Accessible to authenticated customers.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()

    // Get optional category_id filter from query params
    const url = new URL(request.url)
    const categoryId = url.searchParams.get('category_id')

    // Build query
    let query = supabase
      .from('income_profiles')
      .select(`
        id,
        key,
        name,
        description,
        icon,
        display_order,
        category_id,
        income_categories (
          id,
          key,
          name
        )
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter by category if provided
    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: profiles, error } = await query

    if (error) {
      apiLogger.error('Error fetching income profiles', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch income profiles'
      }, { status: 500 })
    }

    // Transform data to include income_category_id for easier lookup
    const transformedProfiles = (profiles || []).map(profile => ({
      ...profile,
      income_category_id: profile.category_id
    }))

    return NextResponse.json({
      success: true,
      data: transformedProfiles
    })
  } catch (error) {
    apiLogger.error('Error in income-profiles API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
