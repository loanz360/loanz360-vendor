
/**
 * Profile Entity Types by Profile API
 * SuperAdmin endpoint for fetching entity types for a specific profile
 *
 * GET - Fetch all entity types for a profile with enabled/disabled status
 */

import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/superadmin/customer-management/profile-entity-types/by-profile
 * Fetch all entity types with their status for a specific profile
 *
 * Query Parameters:
 * - profile_id: Income Profile UUID (required)
 *
 * Returns all entity types with an 'is_enabled' flag and mapping ID if exists
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profile_id')

    if (!profileId) {
      return NextResponse.json(
        { success: false, error: 'profile_id is required' },
        { status: 400 }
      )
    }

    // Get the profile with category info
    const { data: profile, error: profileError } = await supabaseAdmin
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
      .eq('id', profileId)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get all active entity types
    const { data: allEntityTypes, error: entityError } = await supabaseAdmin
      .from('entity_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (entityError) {
      apiLogger.error('Error fetching entity types', entityError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch entity types' },
        { status: 500 }
      )
    }

    // Get existing mappings for this profile
    const { data: existingMappings, error: mappingError } = await supabaseAdmin
      .from('profile_entity_types')
      .select('id, entity_type_id, is_enabled, display_order')
      .eq('income_profile_id', profileId)

    if (mappingError) {
      apiLogger.error('Error fetching profile entity mappings', mappingError)
    }

    // Create a map of entity_type_id to mapping info
    const mappingMap = new Map(
      (existingMappings || []).map(m => [m.entity_type_id, m])
    )

    // Combine entity types with mapping status
    const entityTypesWithStatus = (allEntityTypes || []).map((et, index) => {
      const mapping = mappingMap.get(et.id)
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
        display_order: mapping?.display_order ?? et.display_order ?? index + 1,
        // Mapping info
        mapping_id: mapping?.id || null,
        is_enabled: mapping?.is_enabled ?? false,
        has_mapping: !!mapping
      }
    })

    // Sort by enabled first, then by display order
    entityTypesWithStatus.sort((a, b) => {
      if (a.is_enabled !== b.is_enabled) {
        return a.is_enabled ? -1 : 1
      }
      return a.display_order - b.display_order
    })

    // Calculate statistics
    const enabledCount = entityTypesWithStatus.filter(et => et.is_enabled).length
    const disabledCount = entityTypesWithStatus.length - enabledCount

    const category = profile.income_categories as {
      id: string
      key: string
      name: string
      show_entity_profile: boolean
    }

    return NextResponse.json({
      success: true,
      data: entityTypesWithStatus,
      profile: {
        id: profile.id,
        key: profile.key,
        name: profile.name,
        description: profile.description,
        icon: profile.icon
      },
      category: {
        id: category.id,
        key: category.key,
        name: category.name,
        show_entity_profile: category.show_entity_profile
      },
      statistics: {
        total: entityTypesWithStatus.length,
        enabled: enabledCount,
        disabled: disabledCount
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Profile Entity Types by-profile GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
