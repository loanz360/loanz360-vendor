
/**
 * Entity Types API for Customers
 * Fetch available entity types for creating new entities
 *
 * GET - Fetch all active entity types with roles
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/customers/entity-types
 * Fetch all active entity types available for entity creation
 */
export async function GET(request: NextRequest) {
  try {
    // Verify customer authentication
    const auth = await verifyUnifiedAuth(request, ['CUSTOMER'])
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
    }

    const supabase = await createClient()

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // Fetch active entity types
    let query = supabase
      .from('entity_types')
      .select(`
        id,
        key,
        name,
        description,
        icon,
        color,
        display_order,
        min_members,
        max_members,
        min_directors,
        max_directors,
        requires_registration,
        registration_authority,
        requires_pan,
        requires_gst,
        requires_cin,
        liability_type,
        available_roles,
        required_documents
      `)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    const { data: entityTypes, error } = await query

    if (error) {
      apiLogger.error('Error fetching entity types', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch entity types' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: entityTypes || []
    })

  } catch (error) {
    apiLogger.error('Entity Types GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
