export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search') || ''
    const profileType = searchParams.get('profile_type') || '' // Changed from applies_to
    const incomeCategoryId = searchParams.get('income_category_id') || ''
    const entityTypeId = searchParams.get('entity_type_id') || ''

    // Build query for profile fields using actual schema
    let query = supabase
      .from('profile_field_definitions')
      .select('*')
      .order('field_section', { ascending: true })
      .order('display_order', { ascending: true })

    // Apply search filter
    if (search) {
      query = query.or(`field_key.ilike.%${search}%,field_label.ilike.%${search}%`)
    }

    // Apply profile_type filter (INDIVIDUAL or ENTITY)
    if (profileType) {
      query = query.eq('profile_type', profileType)
    }

    // Apply income_category_id filter (for INDIVIDUAL profiles)
    // Fields with applies_to_all_categories=true OR specific category ID in array
    if (incomeCategoryId && profileType === 'INDIVIDUAL') {
      query = query.or(`applies_to_all_categories.eq.true,income_category_ids.cs.{${incomeCategoryId}}`)
    }

    // Apply entity_type_id filter (for ENTITY profiles)
    // Fields with applies_to_all_entity_types=true OR specific type ID in array
    if (entityTypeId && profileType === 'ENTITY') {
      query = query.or(`applies_to_all_entity_types.eq.true,entity_type_ids.cs.{${entityTypeId}}`)
    }

    const { data: fields, error } = await query

    if (error) {
      apiLogger.error('Error fetching profile fields', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch profile fields' }, { status: 500 })
    }

    // Calculate statistics using actual schema
    const allFields = fields || []
    const statistics = {
      totalFields: allFields.length,
      individualFields: allFields.filter(f => f.profile_type === 'INDIVIDUAL').length,
      entityFields: allFields.filter(f => f.profile_type === 'ENTITY').length,
      requiredFields: allFields.filter(f => f.is_required).length
    }

    return NextResponse.json({
      success: true,
      data: fields || [],
      statistics
    })
  } catch (error) {
    apiLogger.error('Error in profile-fields API', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyUnifiedAuth(request, ['SUPER_ADMIN'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const body = await request.json()

    const {
      field_key,
      field_label,
      field_type,
      profile_type,
      field_section,
      field_group,
      is_core_field,
      applies_to_all_categories,
      income_category_ids,
      income_profile_ids,
      applies_to_all_entity_types,
      entity_type_ids,
      is_required,
      is_required_for_loan,
      verification_source,
      auto_lock_on_verify,
      validation_rules,
      options,
      placeholder,
      help_text,
      display_order,
      is_visible,
      is_active,
      depends_on
    } = body

    // Validate required fields based on actual schema
    if (!field_key || !field_label || !field_type || !profile_type || !field_section) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Validate profile_type is INDIVIDUAL or ENTITY
    if (profile_type !== 'INDIVIDUAL' && profile_type !== 'ENTITY') {
      return NextResponse.json({ success: false, error: 'profile_type must be INDIVIDUAL or ENTITY' }, { status: 400 })
    }

    // Build insert payload using actual schema
    const insertData: Record<string, unknown> = {
      field_key,
      field_label,
      field_type,
      profile_type,
      field_section,
      field_group: field_group || null,
      is_core_field: is_core_field !== false,
      is_required: is_required || false,
      is_required_for_loan: is_required_for_loan || false,
      verification_source: verification_source || null,
      auto_lock_on_verify: auto_lock_on_verify !== false,
      validation_rules: validation_rules || {},
      options: options || [],
      placeholder: placeholder || null,
      help_text: help_text || null,
      display_order: display_order || 0,
      is_visible: is_visible !== false,
      is_active: is_active !== false,
      depends_on: depends_on || null
    }

    // Handle INDIVIDUAL-specific fields
    if (profile_type === 'INDIVIDUAL') {
      insertData.applies_to_all_categories = applies_to_all_categories !== false
      insertData.income_category_ids = income_category_ids || []
      insertData.income_profile_ids = income_profile_ids || []
    }

    // Handle ENTITY-specific fields
    if (profile_type === 'ENTITY') {
      insertData.applies_to_all_entity_types = applies_to_all_entity_types !== false
      insertData.entity_type_ids = entity_type_ids || []
    }

    // Insert new field (unique constraint will handle duplicates)
    const { data: newField, error } = await supabase
      .from('profile_field_definitions')
      .insert(insertData)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating profile field', error)

      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({
          success: false,
          error: 'Field already exists for this profile type'
        }, { status: 409 })
      }

      return NextResponse.json({ success: false, error: 'Failed to create profile field' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newField })
  } catch (error) {
    apiLogger.error('Error in profile-fields POST', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
