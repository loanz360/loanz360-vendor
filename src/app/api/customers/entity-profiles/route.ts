export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/customers/entity-profiles
 *
 * Creates a new entity profile and associates the customer with it.
 *
 * Request Body:
 * {
 *   "entity_type_id": "uuid",
 *   "profile_data": {
 *     "legal_name": "ABC Private Limited",
 *     "pan_number_ent": "ABCDE1234F",
 *     "date_of_incorporation": "2020-01-01",
 *     ...
 *   },
 *   "role_key": "DIRECTOR" // Optional, defaults to first available role
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const customerId = auth.user.id
    const supabase = await createClient()
    const body = await request.json()

    const { entity_type_id, profile_data, role_key } = body

    // Validate required fields
    if (!entity_type_id) {
      return NextResponse.json({
        success: false,
        error: 'entity_type_id is required'
      }, { status: 400 })
    }

    if (!profile_data || typeof profile_data !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'profile_data is required and must be an object'
      }, { status: 400 })
    }

    // Fetch the entity type
    const { data: entityType, error: entityTypeError } = await supabase
      .from('entity_types')
      .select('*')
      .eq('id', entity_type_id)
      .maybeSingle()

    if (entityTypeError || !entityType) {
      return NextResponse.json({
        success: false,
        error: 'Invalid entity_type_id'
      }, { status: 400 })
    }

    // Fetch customer's individual profile (needed for entity membership)
    const { data: individualProfiles, error: individualError } = await supabase
      .from('individuals')
      .select('id, unique_id, full_name')
      .eq('auth_user_id', customerId)
      .limit(1)

    if (individualError || !individualProfiles || individualProfiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'You must create an individual profile before creating an entity profile'
      }, { status: 400 })
    }

    const individualProfile = individualProfiles[0]

    // Check if this individual already has an entity with the same legal_name + entity_type_id
    // This prevents duplicate entity creation from double-clicks or retries
    if (profile_data?.legal_name) {
      const { data: existingLinks } = await supabase
        .from('individual_entity_links')
        .select('id, entity_id, entities!inner(id, legal_name, entity_type_id, status)')
        .eq('individual_id', individualProfile.id)
        .eq('invitation_status', 'ACTIVE')

      if (existingLinks) {
        const duplicate = existingLinks.find((link: Record<string, unknown>) => {
          const entity = link.entities as Record<string, unknown> | null
          return entity &&
            (entity.legal_name as string)?.toLowerCase() === profile_data.legal_name.toLowerCase() &&
            entity.entity_type_id === entity_type_id &&
            entity.status === 'ACTIVE'
        })

        if (duplicate) {
          return NextResponse.json({
            success: false,
            error: `An entity with the name "${profile_data.legal_name}" already exists in your profile`
          }, { status: 409 })
        }
      }
    }

    // Determine role
    const availableRoles = entityType.available_roles || []
    let selectedRole = availableRoles.find((r: { key: string; is_default: boolean }) => r.key === role_key)
    if (!selectedRole) {
      selectedRole = availableRoles.find((r: { is_default: boolean }) => r.is_default) || availableRoles[0]
    }

    if (!selectedRole) {
      return NextResponse.json({
        success: false,
        error: 'No valid role found for this entity type'
      }, { status: 400 })
    }

    // Extract common fields from profile_data
    const {
      legal_name,
      trade_name,
      date_of_incorporation,
      pan_number,
      gstin,
      cin,
      email_official,
      phone_office,
      reg_address_line_1,
      reg_address_line_2,
      reg_city,
      reg_state,
      reg_pincode,
      business_nature,
      industry_category,
      annual_turnover,
      ...additionalData
    } = profile_data

    // Create the entity profile
    const { data: newEntity, error: insertError } = await supabase
      .from('entities')
      .insert({
        entity_type_id,

        // Basic Info (matching actual schema)
        legal_name,
        trade_name,
        date_of_incorporation,

        // Registration (matching actual column names)
        pan_number,
        gstin,
        cin,

        // Contact
        email_primary: email_official,
        phone_primary: phone_office,

        // Registered Address (matching actual column names)
        reg_address_line_1,
        reg_address_line_2,
        reg_city,
        reg_state,
        reg_pincode,

        // Business Classification
        business_nature,
        industry_category,

        // Financial
        annual_turnover,

        // Entity-specific data stored in JSONB column
        entity_specific_data: additionalData,

        // Status
        verification_status: 'PENDING',
        status: 'ACTIVE'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating entity profile', insertError)

      // Check for duplicate PAN
      if (insertError.code === '23505' && insertError.message?.includes('pan_number')) {
        return NextResponse.json({
          success: false,
          error: 'An entity with this PAN number already exists'
        }, { status: 409 })
      }

      return NextResponse.json({
        success: false,
        error: 'Failed to create entity profile'
      }, { status: 500 })
    }

    // Add the customer's individual profile as a member of the entity
    const { error: memberError } = await supabase
      .from('entity_members')
      .insert({
        entity_id: newEntity.id,
        individual_id: individualProfile.id,
        role_key: selectedRole.key,
        role_name: selectedRole.name,
        is_primary: true,
        can_sign_documents: selectedRole.can_sign || false,
        can_apply_for_loans: selectedRole.can_apply_loan || false,
        can_manage_entity: true,
        status: 'ACTIVE'
      })

    if (memberError) {
      apiLogger.error('Error creating entity member', memberError)
      // Rollback entity creation
      await supabase.from('entities').delete().eq('id', newEntity.id)

      return NextResponse.json({
        success: false,
        error: 'Failed to associate member with entity'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        entity: newEntity,
        role: selectedRole,
        message: 'Entity profile created successfully'
      }
    })
  } catch (error) {
    apiLogger.error('Error in entity-profiles API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/customers/entity-profiles
 *
 * Fetches all entities the authenticated customer is a member of.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const customerId = auth.user.id
    const supabase = await createClient()

    // First, get the customer's individual profiles
    const { data: individualProfiles, error: individualError } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', customerId)

    if (individualError || !individualProfiles) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch individual profiles'
      }, { status: 500 })
    }

    const individualIds = individualProfiles.map(p => p.id)

    if (individualIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Fetch entities through entity_members
    const { data: memberships, error: memberError } = await supabase
      .from('entity_members')
      .select(`
        *,
        entity:entities (*)
      `)
      .in('individual_id', individualIds)
      .eq('status', 'ACTIVE')

    if (memberError) {
      apiLogger.error('Error fetching entity memberships', memberError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch entity profiles'
      }, { status: 500 })
    }

    // Extract entities from memberships
    const entities = memberships?.map(m => ({
      ...m.entity,
      membership: {
        role_key: m.role_key,
        role_name: m.role_name,
        is_primary: m.is_primary,
        ownership_percentage: m.ownership_percentage
      }
    })) || []

    return NextResponse.json({
      success: true,
      data: entities
    })
  } catch (error) {
    apiLogger.error('Error in entity-profiles GET API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
