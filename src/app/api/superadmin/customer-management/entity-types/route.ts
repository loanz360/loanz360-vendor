import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Entity Types Management API
 * SuperAdmin endpoint for managing the 20 entity types
 *
 * GET  - Fetch all entity types with statistics
 * POST - Create new entity type
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

// Validation schema - matches actual entity_types table columns
const createEntityTypeSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Key must be uppercase with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  liability_type: z.enum(['LIMITED', 'UNLIMITED']).optional().default('LIMITED'),
  min_members: z.number().optional().default(1),
  max_members: z.number().optional(),
  requires_registration: z.boolean().optional().default(false),
  registration_authority: z.string().optional(),
  display_order: z.number().optional().default(0),
  is_active: z.boolean().optional().default(true),
})

/**
 * GET /api/superadmin/customer-management/entity-types
 * Fetch all entity types with entity counts
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('is_active')

    // Build query
    let query = supabaseAdmin
      .from('entity_types')
      .select('*')
      .order('display_order', { ascending: true })

    if (search) {
      query = query.or(`name.ilike.%${search}%,key.ilike.%${search}%`)
    }

    // Category filter not applicable - entity_types doesn't have category column
    // Keeping the parameter for future use if needed

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: entityTypes, error } = await query

    if (error) {
      apiLogger.error('Error fetching entity types', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch entity types' },
        { status: 500 }
      )
    }

    // Get entity counts per type
    const { data: entityCounts } = await supabaseAdmin
      .from('entities')
      .select('entity_type_id')

    const typesWithCounts = entityTypes?.map(type => ({
      ...type,
      entity_count: entityCounts?.filter(e => e.entity_type_id === type.id).length || 0
    })) || []

    // Get statistics by liability type instead of category (entity_types doesn't have category)
    const liabilityStats = typesWithCounts.reduce((acc, t) => {
      const liabilityType = t.liability_type || 'UNKNOWN'
      acc[liabilityType] = (acc[liabilityType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalTypes = typesWithCounts.length
    const activeTypes = typesWithCounts.filter(t => t.is_active).length
    const totalEntities = typesWithCounts.reduce((sum, t) => sum + t.entity_count, 0)

    return NextResponse.json({
      success: true,
      data: typesWithCounts,
      statistics: {
        totalTypes,
        activeTypes,
        totalEntities,
        byLiabilityType: liabilityStats
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    apiLogger.error('Entity Types GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/customer-management/entity-types
 * Create a new entity type
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = createEntityTypeSchema.parse(body)

    // Check for duplicate key
    const { data: existing } = await supabaseAdmin
      .from('entity_types')
      .select('id')
      .eq('key', validatedData.key)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Entity type key already exists' },
        { status: 409 }
      )
    }

    // Insert new entity type - only columns that exist in the table
    const { data: newEntityType, error: insertError } = await supabaseAdmin
      .from('entity_types')
      .insert({
        key: validatedData.key,
        name: validatedData.name,
        description: validatedData.description || null,
        icon: validatedData.icon || null,
        color: validatedData.color || null,
        liability_type: validatedData.liability_type,
        min_members: validatedData.min_members,
        max_members: validatedData.max_members || null,
        requires_registration: validatedData.requires_registration,
        registration_authority: validatedData.registration_authority || null,
        display_order: validatedData.display_order,
        is_active: validatedData.is_active,
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating entity type', insertError)
      return NextResponse.json(
        { success: false, error: 'Failed to create entity type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newEntityType,
      message: 'Entity type created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Entity Types POST error', error)

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
