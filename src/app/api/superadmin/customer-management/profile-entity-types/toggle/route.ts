import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Profile Entity Types Toggle API
 * SuperAdmin endpoint for toggling entity types on/off for a profile
 *
 * POST - Toggle an entity type for a profile (creates mapping if doesn't exist)
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

// Validation schema
const toggleSchema = z.object({
  income_profile_id: z.string().uuid(),
  entity_type_id: z.string().uuid(),
  is_enabled: z.boolean()
})

/**
 * POST /api/superadmin/customer-management/profile-entity-types/toggle
 * Toggle an entity type for a specific profile
 *
 * - If mapping exists, updates is_enabled
 * - If mapping doesn't exist, creates it with the specified status
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
    if (rateLimitResponse) return rateLimitResponse
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
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = toggleSchema.parse(body)

    const { income_profile_id, entity_type_id, is_enabled } = validatedData

    // Verify profile exists and check its category
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('income_profiles')
      .select(`
        id,
        key,
        name,
        category_id,
        income_categories!inner (
          id,
          key,
          name,
          show_entity_profile
        )
      `)
      .eq('id', income_profile_id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if category requires entity profile
    const category = profile.income_categories as {
      id: string
      key: string
      name: string
      show_entity_profile: boolean
    }

    if (!category.show_entity_profile) {
      return NextResponse.json(
        { success: false, error: `Category "${category.name}" does not support entity profiles` },
        { status: 400 }
      )
    }

    // Verify entity type exists
    const { data: entityType, error: entityError } = await supabaseAdmin
      .from('entity_types')
      .select('id, key, name')
      .eq('id', entity_type_id)
      .maybeSingle()

    if (entityError || !entityType) {
      return NextResponse.json(
        { success: false, error: 'Entity type not found' },
        { status: 404 }
      )
    }

    // Check if mapping already exists
    const { data: existingMapping } = await supabaseAdmin
      .from('profile_entity_types')
      .select('id, is_enabled')
      .eq('income_profile_id', income_profile_id)
      .eq('entity_type_id', entity_type_id)
      .maybeSingle()

    let result
    let action: 'created' | 'updated'

    if (existingMapping) {
      // Update existing mapping
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('profile_entity_types')
        .update({
          is_enabled,
          updated_at: new Date().toISOString(),
          updated_by: auth.userId || null
        })
        .eq('id', existingMapping.id)
        .select('id, is_enabled, display_order')
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Error updating mapping', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update mapping' },
          { status: 500 }
        )
      }

      result = updated
      action = 'updated'
    } else {
      // Get the next display order
      const { data: maxOrder } = await supabaseAdmin
        .from('profile_entity_types')
        .select('display_order')
        .eq('income_profile_id', income_profile_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextOrder = (maxOrder?.display_order || 0) + 1

      // Create new mapping
      const { data: created, error: createError } = await supabaseAdmin
        .from('profile_entity_types')
        .insert({
          income_profile_id,
          entity_type_id,
          is_enabled,
          display_order: nextOrder,
          created_by: auth.userId || null
        })
        .select('id, is_enabled, display_order')
        .maybeSingle()

      if (createError) {
        apiLogger.error('Error creating mapping', createError)
        return NextResponse.json(
          { success: false, error: 'Failed to create mapping' },
          { status: 500 }
        )
      }

      result = created
      action = 'created'
    }

    return NextResponse.json({
      success: true,
      data: {
        mapping_id: result.id,
        is_enabled: result.is_enabled,
        display_order: result.display_order,
        profile: {
          id: profile.id,
          key: profile.key,
          name: profile.name
        },
        entity_type: {
          id: entityType.id,
          key: entityType.key,
          name: entityType.name
        }
      },
      action,
      message: `${entityType.name} ${is_enabled ? 'enabled' : 'disabled'} for ${profile.name}`
    })

  } catch (error) {
    apiLogger.error('Profile Entity Types toggle error', error)

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
