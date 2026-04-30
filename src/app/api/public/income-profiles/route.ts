
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/public/income-profiles
 *
 * PUBLIC endpoint - No authentication required.
 *
 * Fetches all active income profiles for a specific category.
 * This endpoint is used by the Customer Portal's Add New Profile wizard
 * to display available profiles for the selected category.
 *
 * Query Parameters:
 * - category_key: Category key (e.g., 'SALARIED', 'PROFESSIONAL')
 * - category_id: Category UUID (alternative to category_key)
 *
 * Security:
 * - Only returns active profiles (is_active = true)
 * - Uses service role client with RLS bypassed for read-only access
 * - Rate limited via middleware
 *
 * Returns:
 * - id: UUID of the profile
 * - code: Unique code within category
 * - key: Same as code (for API compatibility)
 * - name: Display name
 * - description: Profile description
 * - icon: Lucide icon name (optional)
 * - display_order: Sort order
 * - is_other: Whether this is the "Others" option for custom entries
 * - income_category_id: Parent category UUID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryKey = searchParams.get('category_key')
    const categoryId = searchParams.get('category_id')

    // Validate: at least one parameter required
    if (!categoryKey && !categoryId) {
      return NextResponse.json({
        success: false,
        error: 'Either category_key or category_id is required'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // First, get the category to validate it exists and is active
    let categoryQuery = supabase
      .from('income_categories')
      .select('id, key, name, description, icon, color, show_entity_profile')
      .eq('is_active', true)

    if (categoryId) {
      categoryQuery = categoryQuery.eq('id', categoryId)
    } else if (categoryKey) {
      categoryQuery = categoryQuery.eq('key', categoryKey)
    }

    const { data: category, error: categoryError } = await categoryQuery.maybeSingle()

    if (categoryError || !category) {
      return NextResponse.json({
        success: false,
        error: 'Category not found or inactive'
      }, { status: 404 })
    }

    // Fetch all active profiles for this category using wildcard to avoid column name issues
    const { data: profiles, error: profilesError } = await supabase
      .from('income_profiles')
      .select('*')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (profilesError) {
      apiLogger.error('Error fetching profiles', profilesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch profiles',
      }, { status: 500 })
    }

    // Transform profiles - map column names to API format
    // Database may use 'key' or 'code', and 'category_id' or 'income_category_id'
    const transformedProfiles = (profiles || []).map(profile => ({
      id: profile.id,
      code: profile.code || profile.key, // Handle both column naming conventions
      key: profile.key || profile.code,
      name: profile.name,
      description: profile.description,
      icon: profile.icon,
      display_order: profile.display_order,
      income_category_id: profile.category_id || profile.income_category_id,
      is_other: false
    }))

    // Add "Others" option at the end for custom profile entries
    const othersProfile = {
      id: `others-${category.id}`,
      code: 'OTHERS',
      key: 'OTHERS',
      name: 'Others',
      description: `Specify your ${category.name.toLowerCase()} profile if not listed above`,
      icon: 'PlusCircle',
      display_order: 9999,
      income_category_id: category.id,
      is_other: true
    }

    const allProfiles = [...transformedProfiles, othersProfile]

    // Build response with cache headers
    const response = NextResponse.json({
      success: true,
      data: allProfiles,
      category: {
        id: category.id,
        key: category.key,
        name: category.name,
        description: category.description,
        icon: category.icon,
        color: category.color,
        show_entity_profile: category.show_entity_profile
      },
      total: allProfiles.length,
      cached_at: new Date().toISOString()
    })

    // Add cache headers for performance (cache for 5 minutes)
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response
  } catch (error) {
    apiLogger.error('Error in public income-profiles API', error)
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
