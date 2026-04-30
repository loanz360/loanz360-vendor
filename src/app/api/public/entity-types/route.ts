
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/public/entity-types
 *
 * PUBLIC endpoint - No authentication required.
 *
 * Fetches all enabled entity types for a specific income profile.
 * This endpoint is used by the Customer Portal's Add New Profile wizard
 * to display available entity types for the selected profile.
 *
 * Query Parameters:
 * - profile_id: Income Profile UUID
 * - profile_key: Income Profile key (alternative to profile_id)
 *
 * Security:
 * - Only returns enabled entity types (is_enabled = true in profile_entity_types)
 * - Uses service role client with RLS bypassed for read-only access
 * - Rate limited via middleware
 *
 * Returns:
 * - id: UUID of the entity type
 * - key: Unique identifier (e.g., 'PROPRIETORSHIP', 'LLP')
 * - name: Display name
 * - description: Entity type description
 * - icon: Lucide icon name
 * - color: Hex color code
 * - liability_type: LIMITED or UNLIMITED
 * - min_members: Minimum required members
 * - max_members: Maximum allowed members (null = unlimited)
 * - requires_registration: Whether legal registration is required
 * - registration_authority: Registering body
 * - display_order: Sort order
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profile_id')
    const profileKey = searchParams.get('profile_key')

    // Validate: at least one parameter required
    if (!profileId && !profileKey) {
      return NextResponse.json({
        success: false,
        error: 'Either profile_id or profile_key is required'
      }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // First, get the profile to validate it exists and is active
    let profileQuery = supabase
      .from('income_profiles')
      .select(`
        id,
        key,
        name,
        description,
        icon,
        category_id,
        income_categories!inner (
          id,
          key,
          name,
          show_entity_profile
        )
      `)
      .eq('is_active', true)

    if (profileId) {
      profileQuery = profileQuery.eq('id', profileId)
    } else if (profileKey) {
      profileQuery = profileQuery.eq('key', profileKey)
    }

    const { data: profile, error: profileError } = await profileQuery.maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({
        success: false,
        error: 'Profile not found or inactive'
      }, { status: 404 })
    }

    // Check if this category requires entity selection
    const category = profile.income_categories as {
      id: string
      key: string
      name: string
      show_entity_profile: boolean
    }

    if (!category.show_entity_profile) {
      return NextResponse.json({
        success: true,
        data: [],
        profile: {
          id: profile.id,
          key: profile.key,
          name: profile.name
        },
        category: {
          id: category.id,
          key: category.key,
          name: category.name,
          requires_entity: false
        },
        total: 0,
        message: 'This profile does not require entity selection',
        cached_at: new Date().toISOString()
      })
    }

    // Fetch enabled entity types for this profile
    const { data: profileEntityTypes, error: petError } = await supabase
      .from('profile_entity_types')
      .select(`
        id,
        display_order,
        entity_types!inner (
          id,
          key,
          name,
          description,
          icon,
          color,
          liability_type,
          min_members,
          max_members,
          requires_registration,
          registration_authority
        )
      `)
      .eq('income_profile_id', profile.id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true })

    if (petError) {
      apiLogger.error('Error fetching profile entity types', petError)

      // Fallback: Return all active entity types if linking table has issues
      const { data: allEntityTypes, error: fallbackError } = await supabase
        .from('entity_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (fallbackError) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch entity types'
        }, { status: 500 })
      }

      const transformedFallback = (allEntityTypes || []).map((et, index) => ({
        id: et.id,
        key: et.key,
        name: et.name,
        description: et.description,
        icon: et.icon,
        color: et.color,
        liability_type: et.liability_type,
        min_members: et.min_members,
        max_members: et.max_members,
        requires_registration: et.requires_registration,
        registration_authority: et.registration_authority,
        display_order: index + 1
      }))

      const fallbackResponse = NextResponse.json({
        success: true,
        data: transformedFallback,
        profile: {
          id: profile.id,
          key: profile.key,
          name: profile.name
        },
        category: {
          id: category.id,
          key: category.key,
          name: category.name,
          requires_entity: true
        },
        total: transformedFallback.length,
        source: 'fallback',
        cached_at: new Date().toISOString()
      })

      fallbackResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return fallbackResponse
    }

    // Transform the data
    const transformedEntityTypes = (profileEntityTypes || []).map(pet => {
      const et = pet.entity_types as {
        id: string
        key: string
        name: string
        description: string | null
        icon: string | null
        color: string | null
        liability_type: string
        min_members: number
        max_members: number | null
        requires_registration: boolean
        registration_authority: string | null
      }

      return {
        id: et.id,
        key: et.key,
        name: et.name,
        description: et.description,
        icon: et.icon,
        color: et.color,
        liability_type: et.liability_type,
        min_members: et.min_members,
        max_members: et.max_members,
        requires_registration: et.requires_registration,
        registration_authority: et.registration_authority,
        display_order: pet.display_order
      }
    })

    // Build response with cache headers
    const response = NextResponse.json({
      success: true,
      data: transformedEntityTypes,
      profile: {
        id: profile.id,
        key: profile.key,
        name: profile.name
      },
      category: {
        id: category.id,
        key: category.key,
        name: category.name,
        requires_entity: true
      },
      total: transformedEntityTypes.length,
      source: 'database',
      cached_at: new Date().toISOString()
    })

    // Add cache headers for performance (cache for 5 minutes)
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response
  } catch (error) {
    apiLogger.error('Error in public entity-types API', error)
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
