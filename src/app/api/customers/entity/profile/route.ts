import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/entity/profile
 *
 * Fetches the business entity profile for the authenticated user.
 * User must be an admin of the entity.
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get entityId from query params (optional - if not provided, get user's primary entity)
    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')

    // First, get the user's individual profile
    const { data: customerIdentity } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!customerIdentity) {
      // User might be directly an entity admin without individual profile
      // Check for entity where user is admin via auth_user_id
      const { data: adminEntity, error: adminError } = await supabase
        .from('business_entities')
        .select('*')
        .eq('admin_user_id', user.id)
        .maybeSingle()

      if (adminEntity) {
        // Fetch entity members
        const { data: members } = await supabase
          .from('entity_members')
          .select(`
            id,
            role_key,
            role_name,
            is_primary,
            can_sign_documents,
            can_apply_for_loans,
            can_manage_entity,
            status,
            individual:individuals(
              id,
              full_name,
              email,
              phone
            )
          `)
          .eq('entity_id', adminEntity.id)

        return NextResponse.json({
          success: true,
          entity: adminEntity,
          members: members || [],
          isAdmin: true
        })
      }

      return NextResponse.json({
        success: false,
        error: 'No entity found for this user'
      }, { status: 404 })
    }

    // Find entity where user is a member (preferably with manage permission)
    let entityQuery = supabase
      .from('entity_members')
      .select(`
        id,
        role_key,
        role_name,
        is_primary,
        can_sign_documents,
        can_apply_for_loans,
        can_manage_entity,
        entity_id
      `)
      .eq('individual_id', customerIdentity.id)
      .eq('status', 'ACTIVE')

    if (entityId) {
      // Get specific entity
      entityQuery = entityQuery.eq('entity_id', entityId)
    } else {
      // Get user's primary entity (where they can manage, or first one)
      entityQuery = entityQuery.order('can_manage_entity', { ascending: false })
    }

    const { data: membership } = await entityQuery.limit(1).maybeSingle()

    if (!membership) {
      return NextResponse.json({
        success: false,
        error: 'No entity membership found'
      }, { status: 404 })
    }

    // Fetch full entity details
    const { data: entity, error: entityError } = await supabase
      .from('business_entities')
      .select('*')
      .eq('id', membership.entity_id)
      .maybeSingle()

    if (entityError || !entity) {
      return NextResponse.json({
        success: false,
        error: 'Entity not found'
      }, { status: 404 })
    }

    // Fetch entity members (only if user can manage entity)
    let members = []
    if (membership.can_manage_entity) {
      const { data: membersData } = await supabase
        .from('entity_members')
        .select(`
          id,
          role_key,
          role_name,
          is_primary,
          can_sign_documents,
          can_apply_for_loans,
          can_manage_entity,
          status,
          individual:individuals(
            id,
            full_name,
            email,
            phone
          )
        `)
        .eq('entity_id', entity.id)

      members = membersData || []
    }

    return NextResponse.json({
      success: true,
      entity,
      membership,
      members,
      isAdmin: membership.can_manage_entity
    })
  } catch (error) {
    apiLogger.error('Unexpected error in GET /api/customers/entity/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/entity/profile
 *
 * Updates the business entity profile.
 * User must be an admin of the entity.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const bodySchema = z.object({


      entityId: z.string().uuid(),


      entity_name: z.string().optional(),


      trade_name: z.string().optional(),


      entity_type: z.string().optional(),


      industry_category: z.string().optional(),


      industry_sub_category: z.string().optional(),


      date_of_incorporation: z.string().optional(),


      cin_llpin: z.string().optional(),


      gstin: z.string().optional(),


      pan_number: z.string().optional(),


      email: z.string().email().optional(),


      phone: z.string().min(10).optional(),


      website: z.string().optional(),


      registered_address: z.string().optional(),


      registered_city: z.string().optional(),


      registered_state: z.string().optional(),


      registered_pincode: z.string().optional(),


      business_details: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { entityId } = body

    if (!entityId) {
      return NextResponse.json(
        { success: false, error: 'Entity ID is required' },
        { status: 400 }
      )
    }

    // Verify user can manage this entity
    const { data: individual } = await supabase
      .from('individuals')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    let canManage = false

    if (individual) {
      // Check membership management permission
      const { data: membership } = await supabase
        .from('entity_members')
        .select('can_manage_entity')
        .eq('entity_id', entityId)
        .eq('individual_id', individual.id)
        .eq('can_manage_entity', true)
        .eq('status', 'ACTIVE')
        .maybeSingle()

      if (membership) {
        canManage = true
      }
    }

    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'You do not have admin access to this entity' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Entity Details
    if (body.entity_name !== undefined) updateData.entity_name = body.entity_name
    if (body.trade_name !== undefined) updateData.trade_name = body.trade_name
    if (body.entity_type !== undefined) updateData.entity_type = body.entity_type
    if (body.industry_category !== undefined) updateData.industry_category = body.industry_category
    if (body.industry_sub_category !== undefined) updateData.industry_sub_category = body.industry_sub_category
    if (body.date_of_incorporation !== undefined) updateData.date_of_incorporation = body.date_of_incorporation
    if (body.cin_llpin !== undefined) updateData.cin_llpin = body.cin_llpin
    if (body.gstin !== undefined) updateData.gstin = body.gstin

    // Identity Documents
    if (body.pan_number !== undefined) updateData.pan_number = body.pan_number

    // Contact
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.website !== undefined) updateData.website = body.website

    // Address
    if (body.registered_address !== undefined) updateData.registered_address = body.registered_address
    if (body.registered_city !== undefined) updateData.registered_city = body.registered_city
    if (body.registered_state !== undefined) updateData.registered_state = body.registered_state
    if (body.registered_pincode !== undefined) updateData.registered_pincode = body.registered_pincode

    // Business Details
    if (body.business_details !== undefined) updateData.business_details = body.business_details

    // Update entity
    const { data, error } = await supabase
      .from('business_entities')
      .update(updateData)
      .eq('id', entityId)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating entity profile', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update entity profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      entity: data
    })
  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/entity/profile', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
