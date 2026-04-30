import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

/**
 * POST /api/customers/register/entity
 *
 * Creates a business_entity record and links the admin user after successful signup.
 * Called after Supabase auth signup to complete entity registration.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.AUTH)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please sign in first' },
        { status: 401 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { entityName, entityType, industry, adminRole } = body

    // Validate required fields
    if (!entityName || !entityType || !industry || !adminRole) {
      return NextResponse.json(
        { success: false, error: 'Entity name, type, industry, and admin role are required' },
        { status: 400 }
      )
    }

    // Check if user is already admin of an entity
    const { data: existingMembership } = await supabase
      .from('entity_members')
      .select('id, entity_id')
      .eq('individual_id', user.id)
      .eq('is_admin', true)
      .maybeSingle()

    if (existingMembership) {
      // Get the existing entity details
      const { data: existingEntity } = await supabase
        .from('business_entities')
        .select('unique_id, entity_name')
        .eq('id', existingMembership.entity_id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        message: 'Entity already exists for this user',
        entityId: existingEntity?.unique_id,
        entityName: existingEntity?.entity_name
      })
    }

    // Get next unique ID for entity (E1, E2, E3...)
    const { data: entityUniqueId, error: entityIdError } = await supabase
      .rpc('get_next_unique_id', { seq_type: 'ENTITY' })

    if (entityIdError) {
      apiLogger.error('Error generating entity unique ID', entityIdError)
      return NextResponse.json(
        { success: false, error: 'Failed to generate entity ID' },
        { status: 500 }
      )
    }

    // Get user metadata from auth
    const userMetadata = user.user_metadata || {}

    // Create business entity record
    const { data: entity, error: entityError } = await supabase
      .from('business_entities')
      .insert({
        unique_id: entityUniqueId,
        entity_name: entityName,
        entity_type: entityType,
        industry_category: industry,
        admin_user_id: user.id,
        status: 'ACTIVE',
        kyc_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (entityError) {
      apiLogger.error('Error creating business entity', entityError)
      return NextResponse.json(
        { success: false, error: 'Failed to create business entity' },
        { status: 500 }
      )
    }

    // Now create/get customer identity for the admin user
    // Check if admin already has a customer identity
    let adminIdentity
    const { data: existingIdentity } = await supabase
      .from('customer_identities')
      .select('id, unique_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (existingIdentity) {
      adminIdentity = existingIdentity
    } else {
      // Create customer identity for admin
      const { data: customerUniqueId, error: customerIdError } = await supabase
        .rpc('get_next_unique_id', { seq_type: 'CUSTOMER' })

      if (customerIdError) {
        apiLogger.error('Error generating customer unique ID', customerIdError)
        // Continue without customer identity - entity is created
      } else {
        const { data: newIdentity, error: identityError } = await supabase
          .from('customer_identities')
          .insert({
            auth_user_id: user.id,
            unique_id: customerUniqueId,
            full_name: userMetadata.full_name || '',
            email: user.email,
            mobile_number: userMetadata.phone || '',
            status: 'ACTIVE',
            kyc_status: 'PENDING'
          })
          .select()
          .maybeSingle()

        if (!identityError) {
          adminIdentity = newIdentity
        }
      }
    }

    // Create entity member link for admin
    if (adminIdentity) {
      const { error: memberError } = await supabase
        .from('entity_members')
        .insert({
          entity_id: entity.id,
          individual_id: adminIdentity.id,
          role_key: adminRole,
          role_name: adminRole,
          is_primary: true,
          can_sign_documents: true,
          can_apply_for_loans: true,
          can_manage_entity: true,
          status: 'ACTIVE'
        })

      if (memberError) {
        apiLogger.error('Error creating entity member link', memberError)
        // Don't fail - entity is created, membership can be added later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Entity registration completed successfully',
      entityId: entityUniqueId,
      entity,
      adminCustomerId: adminIdentity?.unique_id
    })

  } catch (error) {
    apiLogger.error('Unexpected error in POST /api/customers/register/entity', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
