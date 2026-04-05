export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/profile-fields
 *
 * Fetches profile field definitions for profile creation forms.
 *
 * Query Parameters:
 * - profile_type: INDIVIDUAL or ENTITY (required)
 * - income_category_id: UUID of income category (for INDIVIDUAL profiles)
 * - entity_type_id: UUID of entity type (for ENTITY profiles)
 *
 * Returns fields grouped by section, ordered by display_order
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const profileType = searchParams.get('profile_type')
    const incomeCategoryId = searchParams.get('income_category_id')
    const entityTypeId = searchParams.get('entity_type_id')

    // Validate required parameters
    if (!profileType || (profileType !== 'INDIVIDUAL' && profileType !== 'ENTITY')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing profile_type. Must be INDIVIDUAL or ENTITY'
      }, { status: 400 })
    }

    // Build query for profile fields
    let query = supabase
      .from('profile_field_definitions')
      .select('*')
      .eq('profile_type', profileType)
      .eq('is_active', true)
      .eq('is_visible', true)
      .order('field_section', { ascending: true })
      .order('display_order', { ascending: true })

    // Apply category/type filters
    if (profileType === 'INDIVIDUAL' && incomeCategoryId) {
      // Get fields that apply to all categories OR include this specific category
      query = query.or(`applies_to_all_categories.eq.true,income_category_ids.cs.{${incomeCategoryId}}`)
    } else if (profileType === 'INDIVIDUAL') {
      // If no category specified, get only fields that apply to all categories
      query = query.eq('applies_to_all_categories', true)
    }

    if (profileType === 'ENTITY' && entityTypeId) {
      // Get fields that apply to all entity types OR include this specific type
      query = query.or(`applies_to_all_entity_types.eq.true,entity_type_ids.cs.{${entityTypeId}}`)
    } else if (profileType === 'ENTITY') {
      // If no type specified, get only fields that apply to all entity types
      query = query.eq('applies_to_all_entity_types', true)
    }

    const { data: fields, error } = await query

    if (error) {
      apiLogger.error('Error fetching profile fields', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch profile fields'
      }, { status: 500 })
    }

    // Group fields by section
    const fieldsBySection: Record<string, typeof fields> = {}
    fields?.forEach(field => {
      if (!fieldsBySection[field.field_section]) {
        fieldsBySection[field.field_section] = []
      }
      fieldsBySection[field.field_section].push(field)
    })

    // Get section order based on profile type
    const sectionOrder = profileType === 'INDIVIDUAL'
      ? ['personal', 'contact', 'address', 'education', 'income', 'employment', 'financial', 'bank', 'documents', 'ekyc']
      : ['basic', 'registration', 'address', 'operations', 'financial', 'members', 'documents']

    // Sort sections by predefined order
    const sortedSections = Object.keys(fieldsBySection).sort((a, b) => {
      const indexA = sectionOrder.indexOf(a)
      const indexB = sectionOrder.indexOf(b)
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })

    // Build response with grouped fields
    const groupedFields = sortedSections.reduce((acc, section) => {
      acc[section] = fieldsBySection[section]
      return acc
    }, {} as Record<string, typeof fields>)

    return NextResponse.json({
      success: true,
      data: {
        fields: fields || [],
        fieldsBySection: groupedFields,
        sections: sortedSections
      },
      metadata: {
        profileType,
        incomeCategoryId: incomeCategoryId || null,
        entityTypeId: entityTypeId || null,
        totalFields: fields?.length || 0,
        totalSections: sortedSections.length
      }
    })
  } catch (error) {
    apiLogger.error('Error in profile-fields API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
