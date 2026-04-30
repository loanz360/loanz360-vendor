import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/utils/api-response'

export const runtime = 'nodejs'

/**
 * PUT /api/superadmin/property-management/[id]/status
 * Update property status (approve, reject, close)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return apiUnauthorized(auth.error || 'Unauthorized')
    }

    if (auth.role !== 'SUPER_ADMIN') {
      return apiForbidden('Only Super Admin can update property status')
    }

    const propertyId = params.id
    const body = await request.json()
    const { status, rejected_reason } = body

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'closed']
    if (!status || !validStatuses.includes(status)) {
      return apiError(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      )
    }

    // Reject requires a reason
    if (status === 'rejected' && (!rejected_reason || rejected_reason.trim().length === 0)) {
      return apiError('Rejection reason is required', 400, 'VALIDATION_ERROR')
    }

    const supabase = createSupabaseAdmin()

    // Check property exists
    const { data: existing, error: fetchError } = await supabase
      .from('properties')
      .select('id, title, status')
      .eq('id', propertyId)
      .maybeSingle()

    if (fetchError || !existing) {
      return apiNotFound('Property not found')
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'approved') {
      updateData.approved_by = auth.userId
      updateData.approved_at = new Date().toISOString()
      updateData.rejected_reason = null
    } else if (status === 'rejected') {
      updateData.rejected_reason = rejected_reason.trim()
      updateData.approved_by = null
      updateData.approved_at = null
    } else if (status === 'closed') {
      updateData.is_active = false
    }

    const { data: updated, error: updateError } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', propertyId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error('Error updating property status:', updateError)
      return apiError('Failed to update property status', 500)
    }

    logger.info(
      `Property ${propertyId} status changed: ${existing.status} -> ${status} by ${auth.userId}`
    )

    return apiSuccess(updated, `Property ${status} successfully`)
  } catch (error) {
    logger.error('Error in PUT /api/superadmin/property-management/[id]/status:', error)
    return apiError('Internal server error', 500)
  }
}
