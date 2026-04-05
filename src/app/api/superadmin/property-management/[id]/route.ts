import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/utils/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/superadmin/property-management/[id]
 * Get a single property by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can access property management')
    }

    const propertyId = params.id
    const supabase = createSupabaseAdmin()

    const { data: property, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .maybeSingle()

    if (error || !property) {
      return apiNotFound('Property not found')
    }

    return apiSuccess(property)
  } catch (error) {
    logger.error('Error in GET /api/superadmin/property-management/[id]:', error)
    return apiError('Internal server error', 500)
  }
}

/**
 * PUT /api/superadmin/property-management/[id]
 * Update a property
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can update properties')
    }

    const propertyId = params.id
    const body = await request.json()
    const supabase = createSupabaseAdmin()

    // Check property exists
    const { data: existing, error: fetchError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .maybeSingle()

    if (fetchError || !existing) {
      return apiNotFound('Property not found')
    }

    // Build update data - only allow specific fields
    const allowedFields = [
      'title', 'description', 'property_type', 'address', 'city',
      'state', 'pincode', 'area_sqft', 'price', 'images',
      'posted_by', 'posted_by_id', 'vendor_type', 'is_active', 'metadata'
    ]

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Validate property_type if provided
    if (body.property_type && !['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(body.property_type)) {
      return apiError('Invalid property type', 400, 'VALIDATION_ERROR')
    }

    const { data: updated, error: updateError } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating property:', updateError)
      return apiError('Failed to update property', 500)
    }

    logger.info(`Property updated: ${propertyId} by ${auth.userId}`)

    return apiSuccess(updated, 'Property updated successfully')
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/property-management/[id]:', error)
    return apiError('Internal server error', 500)
  }
}

/**
 * DELETE /api/superadmin/property-management/[id]
 * Delete a property (hard delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can delete properties')
    }

    const propertyId = params.id
    const supabase = createSupabaseAdmin()

    // Check property exists
    const { data: existing, error: fetchError } = await supabase
      .from('properties')
      .select('id, title')
      .eq('id', propertyId)
      .maybeSingle()

    if (fetchError || !existing) {
      return apiNotFound('Property not found')
    }

    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', propertyId)

    if (deleteError) {
      logger.error('Error deleting property:', deleteError)
      return apiError('Failed to delete property', 500)
    }

    logger.info(`Property deleted: ${propertyId} (${existing.title}) by ${auth.userId}`)

    return apiSuccess(null, `Property "${existing.title}" deleted successfully`)
  } catch (error) {
    logger.error('Error in DELETE /api/superadmin/property-management/[id]:', error)
    return apiError('Internal server error', 500)
  }
}
