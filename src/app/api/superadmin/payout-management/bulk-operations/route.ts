import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/superadmin/payout-management/bulk-operations
 * Perform bulk operations on general payout percentages
 *
 * Enhancement #13: Bulk Update/Delete operations for Super Admin
 * Rate Limit: 30 requests per minute
 */
export async function POST(request: NextRequest) {
  return writeRateLimiter(request, async (req) => {
    return await bulkOperationsHandler(req)
  })
}

async function bulkOperationsHandler(request: NextRequest) {
  try {
    // Verify Super Admin authentication
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Super Admin access required' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      operation: z.string().optional(),

      ids: z.array(z.unknown()).optional(),

      updates: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const { operation, ids, updates } = body

    // Validate operation type
    if (!operation || !['update', 'delete'].includes(operation)) {
      return NextResponse.json(
        { success: false, error: 'Invalid operation. Must be "update" or "delete"' },
        { status: 400 }
      )
    }

    // Validate IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IDs array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Limit bulk operations to prevent abuse
    if (ids.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Bulk operations limited to 500 items at a time' },
        { status: 400 }
      )
    }

    // Validate IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const id of ids) {
      if (!uuidRegex.test(id)) {
        return NextResponse.json(
          { success: false, error: `Invalid UUID format: ${id}` },
          { status: 400 }
        )
      }
    }

    if (operation === 'update') {
      return await handleBulkUpdate(supabase, ids, updates, auth.userId!)
    } else {
      return await handleBulkDelete(supabase, ids, auth.userId!)
    }
  } catch (error) {
    apiLogger.error('Error in bulk operations', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle bulk update operation
 */
async function handleBulkUpdate(supabase: unknown, ids: string[], updates: unknown, userId: string) {
  try {
    // Validate updates object
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Updates object is required for bulk update' },
        { status: 400 }
      )
    }

    // Only allow updating specific fields
    const allowedFields = ['commission_percentage', 'specific_conditions']
    const updateFields: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedFields.includes(key)) {
        return NextResponse.json(
          { success: false, error: `Field "${key}" cannot be bulk updated` },
          { status: 400 }
        )
      }

      if (key === 'commission_percentage') {
        const percentage = parseFloat(value as string)
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          return NextResponse.json(
            { success: false, error: 'Commission percentage must be between 0 and 100' },
            { status: 400 }
          )
        }
        updateFields.commission_percentage = percentage
      } else {
        updateFields[key] = value
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Perform bulk update using database function
    const { data, error } = await supabase.rpc('bulk_update_general_percentages', {
      entries: ids.map(id => ({
        id,
        ...updateFields
      })),
      updated_by_id: userId
    })

    if (error) {
      apiLogger.error('Bulk update error', error)
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    }

    // Extract result from database function response
    const result = Array.isArray(data) && data.length > 0 ? data[0] : { success: true, updated_count: 0 }

    return NextResponse.json({
      success: result.success !== false,
      message: `Successfully updated ${result.updated_count || ids.length} entries`,
      updated_count: result.updated_count || ids.length,
      error_message: result.error_message || null
    })
  } catch (error) {
    apiLogger.error('Error in bulk update handler', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute bulk update' },
      { status: 500 }
    )
  }
}

/**
 * Handle bulk delete operation
 */
async function handleBulkDelete(supabase: unknown, ids: string[], userId: string) {
  try {
    // Perform bulk delete using database function
    const { data, error } = await supabase.rpc('bulk_delete_general_percentages', {
      ids: ids
    })

    if (error) {
      apiLogger.error('Bulk delete error', error)
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    }

    // Extract result from database function response
    const result = Array.isArray(data) && data.length > 0 ? data[0] : { success: true, deleted_count: 0 }

    return NextResponse.json({
      success: result.success !== false,
      message: `Successfully deleted ${result.deleted_count || ids.length} entries and related BA/BP/CP percentages`,
      deleted_count: result.deleted_count || ids.length,
      error_message: result.error_message || null
    })
  } catch (error) {
    apiLogger.error('Error in bulk delete handler', error)
    return NextResponse.json(
      { success: false, error: 'Failed to execute bulk delete' },
      { status: 500 }
    )
  }
}
