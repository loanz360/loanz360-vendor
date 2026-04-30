
/**
 * Profile Entity Types Management API
 * SuperAdmin endpoint for managing profile-entity relationships
 *
 * GET  - Fetch all profile-entity mappings with filters
 * POST - Bulk operations (enable/disable multiple mappings)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema for bulk operations
const bulkOperationSchema = z.object({
  action: z.enum(['enable', 'disable', 'update_order']),
  profile_entity_ids: z.array(z.string().uuid()).optional(),
  income_profile_id: z.string().uuid().optional(),
  entity_type_ids: z.array(z.string().uuid()).optional(),
  display_orders: z.record(z.string(), z.number()).optional(), // For update_order action
})

/**
 * GET /api/superadmin/customer-management/profile-entity-types
 * Fetch all profile-entity mappings with optional filters
 *
 * Query Parameters:
 * - income_profile_id: Filter by specific profile
 * - entity_type_id: Filter by specific entity type
 * - category_id: Filter by income category
 * - is_enabled: Filter by enabled status (true/false)
 * - search: Search by profile or entity name
 */
export async function GET(request: NextRequest) {
  try {
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
    const incomeProfileId = searchParams.get('income_profile_id')
    const entityTypeId = searchParams.get('entity_type_id')
    const categoryId = searchParams.get('category_id')
    const isEnabled = searchParams.get('is_enabled')
    const search = searchParams.get('search') || ''

    // Use the view for easier querying
    let query = supabaseAdmin
      .from('profile_entity_types_view')
      .select('*')
      .order('category_key', { ascending: true })
      .order('profile_key', { ascending: true })
      .order('display_order', { ascending: true })

    // Apply filters
    if (incomeProfileId) {
      query = query.eq('income_profile_id', incomeProfileId)
    }

    if (entityTypeId) {
      query = query.eq('entity_type_id', entityTypeId)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    if (isEnabled !== null && isEnabled !== undefined && isEnabled !== '') {
      query = query.eq('is_enabled', isEnabled === 'true')
    }

    if (search) {
      query = query.or(`profile_name.ilike.%${search}%,entity_type_name.ilike.%${search}%`)
    }

    const { data: profileEntityTypes, error } = await query

    if (error) {
      apiLogger.error('Error fetching profile entity types', error)

      // Fallback to direct table query if view doesn't exist
      let fallbackQuery = supabaseAdmin
        .from('profile_entity_types')
        .select(`
          id,
          income_profile_id,
          entity_type_id,
          is_enabled,
          display_order,
          created_at,
          updated_at,
          income_profiles!inner (
            id,
            key,
            name,
            category_id,
            income_categories!inner (
              id,
              key,
              name
            )
          ),
          entity_types!inner (
            id,
            key,
            name,
            category,
            icon,
            color
          )
        `)
        .order('display_order', { ascending: true })

      if (incomeProfileId) {
        fallbackQuery = fallbackQuery.eq('income_profile_id', incomeProfileId)
      }

      if (entityTypeId) {
        fallbackQuery = fallbackQuery.eq('entity_type_id', entityTypeId)
      }

      if (isEnabled !== null && isEnabled !== undefined && isEnabled !== '') {
        fallbackQuery = fallbackQuery.eq('is_enabled', isEnabled === 'true')
      }

      const { data: fallbackData, error: fallbackError } = await fallbackQuery

      if (fallbackError) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch profile entity types' },
          { status: 500 }
        )
      }

      // Transform fallback data
      const transformedData = (fallbackData || []).map(pet => {
        const profile = pet.income_profiles as {
          id: string
          key: string
          name: string
          category_id: string
          income_categories: { id: string; key: string; name: string }
        }
        const entityType = pet.entity_types as {
          id: string
          key: string
          name: string
          category: string
          icon: string | null
          color: string | null
        }

        return {
          id: pet.id,
          income_profile_id: pet.income_profile_id,
          entity_type_id: pet.entity_type_id,
          is_enabled: pet.is_enabled,
          display_order: pet.display_order,
          profile_key: profile.key,
          profile_name: profile.name,
          category_id: profile.income_categories.id,
          category_key: profile.income_categories.key,
          category_name: profile.income_categories.name,
          entity_type_key: entityType.key,
          entity_type_name: entityType.name,
          entity_category: entityType.category,
          entity_icon: entityType.icon,
          entity_color: entityType.color,
          created_at: pet.created_at,
          updated_at: pet.updated_at
        }
      })

      return NextResponse.json({
        success: true,
        data: transformedData,
        source: 'fallback',
        total: transformedData.length,
        timestamp: new Date().toISOString()
      })
    }

    // Calculate statistics
    const totalMappings = profileEntityTypes?.length || 0
    const enabledMappings = profileEntityTypes?.filter(pet => pet.is_enabled).length || 0
    const disabledMappings = totalMappings - enabledMappings

    // Get unique profiles and entity types
    const uniqueProfiles = new Set(profileEntityTypes?.map(pet => pet.income_profile_id))
    const uniqueEntityTypes = new Set(profileEntityTypes?.map(pet => pet.entity_type_id))

    return NextResponse.json({
      success: true,
      data: profileEntityTypes || [],
      statistics: {
        totalMappings,
        enabledMappings,
        disabledMappings,
        uniqueProfiles: uniqueProfiles.size,
        uniqueEntityTypes: uniqueEntityTypes.size
      },
      source: 'view',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Profile Entity Types GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/profile-entity-types
 * Bulk operations on profile-entity mappings
 *
 * Actions:
 * - enable: Enable specified mappings
 * - disable: Disable specified mappings
 * - update_order: Update display orders for mappings
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = bulkOperationSchema.parse(body)

    const { action, profile_entity_ids, income_profile_id, entity_type_ids, display_orders } = validatedData

    let affectedCount = 0

    if (action === 'enable' || action === 'disable') {
      const isEnabled = action === 'enable'

      // Build query based on provided identifiers
      if (profile_entity_ids && profile_entity_ids.length > 0) {
        // Update specific mappings by ID
        const { error } = await supabaseAdmin
          .from('profile_entity_types')
          .update({
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
            updated_by: auth.userId || null
          })
          .in('id', profile_entity_ids)

        if (error) {
          apiLogger.error('Error updating profile entity types', error)
          return NextResponse.json(
            { success: false, error: 'Failed to update mappings' },
            { status: 500 }
          )
        }

        affectedCount = profile_entity_ids.length
      } else if (income_profile_id && entity_type_ids && entity_type_ids.length > 0) {
        // Update by profile + entity type combinations
        const { error } = await supabaseAdmin
          .from('profile_entity_types')
          .update({
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
            updated_by: auth.userId || null
          })
          .eq('income_profile_id', income_profile_id)
          .in('entity_type_id', entity_type_ids)

        if (error) {
          apiLogger.error('Error updating profile entity types', error)
          return NextResponse.json(
            { success: false, error: 'Failed to update mappings' },
            { status: 500 }
          )
        }

        affectedCount = entity_type_ids.length
      } else if (income_profile_id) {
        // Update all for a specific profile
        const { data, error } = await supabaseAdmin
          .from('profile_entity_types')
          .update({
            is_enabled: isEnabled,
            updated_at: new Date().toISOString(),
            updated_by: auth.userId || null
          })
          .eq('income_profile_id', income_profile_id)
          .select('id')

        if (error) {
          apiLogger.error('Error updating profile entity types', error)
          return NextResponse.json(
            { success: false, error: 'Failed to update mappings' },
            { status: 500 }
          )
        }

        affectedCount = data?.length || 0
      } else {
        return NextResponse.json(
          { success: false, error: 'Either profile_entity_ids, or income_profile_id with optional entity_type_ids is required' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Successfully ${action}d ${affectedCount} mapping(s)`,
        affectedCount,
        action
      })
    }

    if (action === 'update_order' && display_orders) {
      // Update display orders
      const updates = Object.entries(display_orders).map(async ([id, order]) => {
        return supabaseAdmin
          .from('profile_entity_types')
          .update({
            display_order: order,
            updated_at: new Date().toISOString(),
            updated_by: auth.userId || null
          })
          .eq('id', id)
      })

      const results = await Promise.all(updates)
      const errors = results.filter(r => r.error)

      if (errors.length > 0) {
        apiLogger.error('Some display order updates failed', errors)
        return NextResponse.json(
          { success: false, error: 'Some display order updates failed' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Successfully updated ${Object.keys(display_orders).length} display order(s)`,
        affectedCount: Object.keys(display_orders).length,
        action
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action or missing required parameters' },
      { status: 400 }
    )

  } catch (error) {
    apiLogger.error('Profile Entity Types POST error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
