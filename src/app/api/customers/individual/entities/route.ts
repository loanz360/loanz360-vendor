import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Individual's Entities API
 * Customer endpoint for managing entities linked to the individual
 *
 * GET  - Fetch all entities the individual is linked to
 * POST - Create a new entity and link to individual
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiLogger } from '@/lib/utils/logger'

// Validation schema for creating entity
const createEntitySchema = z.object({
  entity_type_id: z.string().uuid(),
  legal_name: z.string().min(2).max(255),
  trading_name: z.string().max(255).optional().nullable(),
  registration_number: z.string().max(100).optional().nullable(),
  date_of_incorporation: z.string().optional().nullable(),
  pan_number: z.string().max(10).optional().nullable(),
  tan_number: z.string().max(15).optional().nullable(),
  gstin: z.string().max(15).optional().nullable(),
  cin: z.string().max(25).optional().nullable(),
  llpin: z.string().max(15).optional().nullable(),
  // Address
  business_address_line1: z.string().max(255).optional().nullable(),
  business_address_line2: z.string().max(255).optional().nullable(),
  business_address_city: z.string().max(100).optional().nullable(),
  business_address_state: z.string().max(100).optional().nullable(),
  business_address_pincode: z.string().max(10).optional().nullable(),
  business_address_country: z.string().max(100).optional().default('India'),
  // Contact
  business_email: z.string().email().optional().nullable(),
  business_phone: z.string().max(15).optional().nullable(),
  website: z.string().url().optional().nullable(),
  // Role for creator
  creator_role_code: z.string().min(1).max(50),
  creator_role_name: z.string().min(1).max(100),
  ownership_percentage: z.number().min(0).max(100).optional(),
})

/**
 * GET /api/customers/individual/entities
 * Fetch all entities linked to the current individual
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get individual ID (column is auth_user_id in individuals table)
    const { data: individual, error: indError } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (indError || !individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found' },
        { status: 404 }
      )
    }

    // Fetch all entity links with full entity details
    // Column names match the individual_entity_links and entities table schema
    const { data: entityLinks, error: linksError } = await supabase
      .from('individual_entity_links')
      .select(`
        id,
        role_key,
        designation,
        share_percentage,
        is_primary_contact,
        is_admin,
        is_authorized_signatory,
        can_apply_loans,
        can_view_financials,
        can_edit_profile,
        can_add_members,
        joined_date,
        invitation_status,
        entities(
          id,
          unique_id,
          entity_type_id,
          legal_name,
          trade_name,
          registration_number,
          date_of_incorporation,
          pan_number,
          tan_number,
          gstin,
          cin,
          llpin,
          reg_address_line_1,
          reg_address_line_2,
          reg_city,
          reg_state,
          reg_pincode,
          email_primary,
          phone_primary,
          website,
          profile_completion_percentage,
          verification_status,
          status,
          created_at,
          updated_at,
          entity_types(id, key, name, short_name, category, icon, color, available_roles, required_documents)
        )
      `)
      .eq('individual_id', individual.id)
      .order('joined_date', { ascending: false })

    if (linksError) {
      apiLogger.error('Error fetching entity links', linksError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch entities' },
        { status: 500 }
      )
    }

    // Transform data for easier consumption
    const entities = entityLinks?.map(link => ({
      linkId: link.id,
      role: {
        code: link.role_key,
        name: link.designation
      },
      ownership_percentage: link.share_percentage,
      permissions: {
        is_primary_contact: link.is_primary_contact,
        is_admin: link.is_admin,
        is_authorized_signatory: link.is_authorized_signatory,
        can_apply_loan: link.can_apply_loans,
        can_view_financials: link.can_view_financials,
        can_edit_profile: link.can_edit_profile,
        can_add_members: link.can_add_members
      },
      status: link.invitation_status,
      joined_at: link.joined_date,
      entity: link.entities
    })) || []

    // Get counts by status
    const activeCount = entities.filter(e => e.status === 'ACTIVE').length
    const pendingCount = entities.filter(e => e.status === 'PENDING_REGISTRATION' || e.status === 'PENDING_ACCEPTANCE').length

    return NextResponse.json({
      success: true,
      entities,
      statistics: {
        total: entities.length,
        active: activeCount,
        pendingConsent: pendingCount
      }
    })

  } catch (error) {
    apiLogger.error('Individual Entities GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/individual/entities
 * Create a new entity and link to individual as creator
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get individual ID (column is auth_user_id in individuals table)
    const { data: individual, error: indError } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (indError || !individual) {
      return NextResponse.json(
        { success: false, error: 'Individual profile not found. Please complete your profile first.' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = createEntitySchema.parse(body)

    // Verify entity type exists (column is 'key' not 'code' in entity_types table)
    const { data: entityType, error: typeError } = await supabase
      .from('entity_types')
      .select('id, key, name, available_roles')
      .eq('id', validatedData.entity_type_id)
      .eq('is_active', true)
      .maybeSingle()

    if (typeError || !entityType) {
      return NextResponse.json(
        { success: false, error: 'Invalid entity type' },
        { status: 400 }
      )
    }

    // Verify the role exists in available_roles (roles use 'key' field)
    const availableRoles = entityType.available_roles as Array<{ key: string; name: string }> || []
    const roleValid = availableRoles.some(r => r.key === validatedData.creator_role_code)

    if (!roleValid && availableRoles.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid role for this entity type' },
        { status: 400 }
      )
    }

    // Check if this individual already has an entity with the same legal_name + entity_type_id
    // This prevents duplicate entity creation from double-clicks or retries
    const { data: existingLinks } = await supabase
      .from('individual_entity_links')
      .select('id, entity_id, entities!inner(id, legal_name, entity_type_id, status)')
      .eq('individual_id', individual.id)
      .eq('invitation_status', 'ACTIVE')

    if (existingLinks) {
      const duplicate = existingLinks.find((link: Record<string, unknown>) => {
        const entity = link.entities as Record<string, unknown> | null
        return entity &&
          (entity.legal_name as string)?.toLowerCase() === validatedData.legal_name.toLowerCase() &&
          entity.entity_type_id === validatedData.entity_type_id &&
          entity.status === 'ACTIVE'
      })

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `An entity with the name "${validatedData.legal_name}" already exists in your profile` },
          { status: 409 }
        )
      }
    }

    // Create entity (map API field names to actual DB column names)
    const entityData = {
      entity_type_id: validatedData.entity_type_id,
      legal_name: validatedData.legal_name,
      trade_name: validatedData.trading_name,
      registration_number: validatedData.registration_number,
      date_of_incorporation: validatedData.date_of_incorporation,
      pan_number: validatedData.pan_number,
      tan_number: validatedData.tan_number,
      gstin: validatedData.gstin,
      cin: validatedData.cin,
      llpin: validatedData.llpin,
      reg_address_line_1: validatedData.business_address_line1,
      reg_address_line_2: validatedData.business_address_line2,
      reg_city: validatedData.business_address_city,
      reg_state: validatedData.business_address_state,
      reg_pincode: validatedData.business_address_pincode,
      reg_country: validatedData.business_address_country,
      email_primary: validatedData.business_email,
      phone_primary: validatedData.business_phone,
      website: validatedData.website,
      created_by_individual_id: individual.id
    }

    const { data: newEntity, error: createError } = await supabase
      .from('entities')
      .insert(entityData)
      .select()
      .maybeSingle()

    if (createError) {
      apiLogger.error('Error creating entity', createError)
      return NextResponse.json(
        { success: false, error: 'Failed to create entity' },
        { status: 500 }
      )
    }

    // Link individual to entity as creator with specified role
    // Column names match individual_entity_links table schema
    const linkData = {
      individual_id: individual.id,
      entity_id: newEntity.id,
      role_key: validatedData.creator_role_code,
      designation: validatedData.creator_role_name,
      share_percentage: validatedData.ownership_percentage || null,
      is_primary_contact: true,
      is_admin: true,
      is_authorized_signatory: true,
      can_apply_loans: true,
      can_view_financials: true,
      can_edit_profile: true,
      can_add_members: true,
      joined_date: new Date().toISOString().split('T')[0],
      invitation_status: 'ACTIVE'
    }

    const { error: linkError } = await supabase
      .from('individual_entity_links')
      .insert(linkData)

    if (linkError) {
      apiLogger.error('Error linking entity', linkError)
      // Try to clean up the created entity
      await supabase.from('entities').delete().eq('id', newEntity.id)
      return NextResponse.json(
        { success: false, error: 'Failed to link entity to your profile' },
        { status: 500 }
      )
    }

    // Fetch complete entity with type info
    const { data: completeEntity } = await supabase
      .from('entities')
      .select(`
        *,
        entity_types(id, key, name, short_name, category, icon, color)
      `)
      .eq('id', newEntity.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      entity: completeEntity,
      message: 'Entity created successfully'
    }, { status: 201 })

  } catch (error) {
    apiLogger.error('Individual Entities POST error', error)

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
