import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { writeRateLimiter } from '@/lib/rate-limit/rate-limiter'
import { apiLogger } from '@/lib/utils/logger'


/**
 * POST /api/superadmin/customer-management/customers/bulk
 * Perform bulk operations on customers
 *
 * Rate Limit: 10 requests per minute (lower for bulk operations)
 */
export async function POST(request: NextRequest) {
  // Lower rate limit for bulk operations
  return writeRateLimiter(request, async (req) => {
    return await bulkOperationHandler(req)
  }, 10) // 10 requests per minute
}

async function bulkOperationHandler(request: NextRequest) {
  try {
    // Use unified auth
    const auth = await verifyUnifiedAuth(request)

    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!auth.isSuperAdmin && !auth.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { operation, customer_ids, data } = body

    // Validation
    if (!operation || typeof operation !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Operation type is required'
      }, { status: 400 })
    }

    if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Customer IDs array is required and must not be empty'
      }, { status: 400 })
    }

    // Limit bulk operations to 100 customers at a time
    if (customer_ids.length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Cannot perform bulk operation on more than 100 customers at once'
      }, { status: 400 })
    }

    // Validate all IDs are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const invalidIds = customer_ids.filter(id => !uuidRegex.test(id))
    if (invalidIds.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Invalid customer IDs: ${invalidIds.join(', ')}`
      }, { status: 400 })
    }

    const supabase = createSupabaseAdmin()

    // Route to appropriate bulk operation
    switch (operation) {
      case 'update_status':
        return await bulkUpdateStatus(supabase, customer_ids, data, auth.userId!)

      case 'update_kyc_status':
        return await bulkUpdateKYCStatus(supabase, customer_ids, data, auth.userId!)

      case 'add_tag':
        return await bulkAddTag(supabase, customer_ids, data, auth.userId!)

      case 'remove_tag':
        return await bulkRemoveTag(supabase, customer_ids, data)

      case 'assign_to':
        return await bulkAssign(supabase, customer_ids, data, auth.userId!)

      case 'add_note':
        return await bulkAddNote(supabase, customer_ids, data, auth.userId!)

      case 'export':
        return await bulkExport(supabase, customer_ids, data)

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 })
    }

  } catch (error) {
    apiLogger.error('Error in bulk operations API', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Bulk update user status
async function bulkUpdateStatus(
  supabase: any,
  customerIds: string[],
  data: any,
  userId: string
) {
  const { status } = data

  const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    }, { status: 400 })
  }

  // Get user IDs for these customers
  const { data: customers, error: fetchError } = await supabase
    .from('customers')
    .select('user_id')
    .in('id', customerIds)

  if (fetchError) {
    apiLogger.error('Error fetching customers', fetchError)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customers'
    }, { status: 500 })
  }

  const userIds = customers.map((c: any) => c.user_id)

  // Update user statuses
  const { error: updateError } = await supabase
    .from('users')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .in('id', userIds)

  if (updateError) {
    apiLogger.error('Error updating statuses', updateError)
    return NextResponse.json({
      success: false,
      error: 'Failed to update customer statuses'
    }, { status: 500 })
  }

  // Log activity for each customer
  const activities = customerIds.map(customerId => ({
    customer_id: customerId,
    activity_type: 'STATUS_CHANGE',
    activity_title: `Status changed to ${status}`,
    activity_description: `Bulk status update by admin`,
    activity_category: 'SYSTEM',
    performed_by: userId,
    metadata: { old_status: null, new_status: status, bulk_operation: true }
  }))

  await supabase.from('customer_activities').insert(activities)

  return NextResponse.json({
    success: true,
    message: `Successfully updated status for ${customerIds.length} customers`,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk update KYC status
async function bulkUpdateKYCStatus(
  supabase: any,
  customerIds: string[],
  data: any,
  userId: string
) {
  const { kyc_status } = data

  const validKYCStatuses = ['PENDING', 'IN_PROGRESS', 'VERIFIED', 'REJECTED', 'EXPIRED']
  if (!kyc_status || !validKYCStatuses.includes(kyc_status)) {
    return NextResponse.json({
      success: false,
      error: `Invalid KYC status. Must be one of: ${validKYCStatuses.join(', ')}`
    }, { status: 400 })
  }

  // Update KYC statuses
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      kyc_status,
      updated_at: new Date().toISOString()
    })
    .in('id', customerIds)

  if (updateError) {
    apiLogger.error('Error updating KYC statuses', updateError)
    return NextResponse.json({
      success: false,
      error: 'Failed to update KYC statuses'
    }, { status: 500 })
  }

  // Log activity
  const activities = customerIds.map(customerId => ({
    customer_id: customerId,
    activity_type: 'KYC_UPDATE',
    activity_title: `KYC status changed to ${kyc_status}`,
    activity_description: `Bulk KYC update by admin`,
    activity_category: 'VERIFICATION',
    performed_by: userId,
    metadata: { kyc_status, bulk_operation: true }
  }))

  await supabase.from('customer_activities').insert(activities)

  return NextResponse.json({
    success: true,
    message: `Successfully updated KYC status for ${customerIds.length} customers`,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk add tag
async function bulkAddTag(
  supabase: any,
  customerIds: string[],
  data: any,
  userId: string
) {
  const { tag_name, tag_category } = data

  if (!tag_name || typeof tag_name !== 'string') {
    return NextResponse.json({
      success: false,
      error: 'Tag name is required'
    }, { status: 400 })
  }

  const sanitizedTagName = tag_name.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_')

  const validCategories = ['BEHAVIORAL', 'FINANCIAL', 'RISK', 'LIFECYCLE', 'CUSTOM']
  const category = tag_category && validCategories.includes(tag_category) ? tag_category : 'CUSTOM'

  // Create tags for all customers
  const tags = customerIds.map(customerId => ({
    customer_id: customerId,
    tag_name: sanitizedTagName,
    tag_category: category,
    tag_source: 'MANUAL',
    confidence_score: 100,
    created_by: userId
  }))

  // Use ON CONFLICT to ignore duplicates
  const { error: insertError } = await supabase
    .from('customer_tags')
    .upsert(tags, { onConflict: 'customer_id,tag_name', ignoreDuplicates: true })

  if (insertError) {
    apiLogger.error('Error adding tags', insertError)
    return NextResponse.json({
      success: false,
      error: 'Failed to add tags'
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Successfully added tag "${sanitizedTagName}" to ${customerIds.length} customers`,
    tag_name: sanitizedTagName,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk remove tag
async function bulkRemoveTag(
  supabase: any,
  customerIds: string[],
  data: any
) {
  const { tag_name } = data

  if (!tag_name || typeof tag_name !== 'string') {
    return NextResponse.json({
      success: false,
      error: 'Tag name is required'
    }, { status: 400 })
  }

  // Delete tags
  const { error: deleteError } = await supabase
    .from('customer_tags')
    .delete()
    .in('customer_id', customerIds)
    .eq('tag_name', tag_name)

  if (deleteError) {
    apiLogger.error('Error removing tags', deleteError)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove tags'
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Successfully removed tag "${tag_name}" from ${customerIds.length} customers`,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk assign to user
async function bulkAssign(
  supabase: any,
  customerIds: string[],
  data: any,
  userId: string
) {
  const { assigned_to } = data

  if (!assigned_to || typeof assigned_to !== 'string') {
    return NextResponse.json({
      success: false,
      error: 'Assigned user ID is required'
    }, { status: 400 })
  }

  // Verify assigned user exists and is an employee/admin
  const { data: assignedUser, error: userError } = await supabase
    .from('users')
    .select('id, role, full_name')
    .eq('id', assigned_to)
    .maybeSingle()

  if (userError || !assignedUser) {
    return NextResponse.json({
      success: false,
      error: 'Assigned user not found'
    }, { status: 404 })
  }

  if (!['EMPLOYEE', 'ADMIN', 'SUPER_ADMIN'].includes(assignedUser.role)) {
    return NextResponse.json({
      success: false,
      error: 'Can only assign to employees or admins'
    }, { status: 400 })
  }

  // Update customers
  const { error: updateError } = await supabase
    .from('customers')
    .update({
      assigned_to,
      updated_at: new Date().toISOString()
    })
    .in('id', customerIds)

  if (updateError) {
    apiLogger.error('Error assigning customers', updateError)
    return NextResponse.json({
      success: false,
      error: 'Failed to assign customers'
    }, { status: 500 })
  }

  // Log activity
  const activities = customerIds.map(customerId => ({
    customer_id: customerId,
    activity_type: 'ASSIGNMENT',
    activity_title: `Assigned to ${assignedUser.full_name}`,
    activity_description: `Bulk assignment by admin`,
    activity_category: 'SYSTEM',
    performed_by: userId,
    metadata: { assigned_to, bulk_operation: true }
  }))

  await supabase.from('customer_activities').insert(activities)

  return NextResponse.json({
    success: true,
    message: `Successfully assigned ${customerIds.length} customers to ${assignedUser.full_name}`,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk add note
async function bulkAddNote(
  supabase: any,
  customerIds: string[],
  data: any,
  userId: string
) {
  const { note_content, note_type, category } = data

  if (!note_content || typeof note_content !== 'string' || note_content.trim().length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Note content is required'
    }, { status: 400 })
  }

  const validNoteTypes = ['GENERAL', 'FOLLOW_UP', 'COMPLAINT', 'FEEDBACK', 'INTERNAL', 'MEETING', 'CALL_LOG']
  const noteType = note_type && validNoteTypes.includes(note_type) ? note_type : 'GENERAL'

  const validCategories = ['SALES', 'SUPPORT', 'COLLECTIONS', 'RISK', 'GENERAL']
  const noteCategory = category && validCategories.includes(category) ? category : 'GENERAL'

  // Create notes for all customers
  const notes = customerIds.map(customerId => ({
    customer_id: customerId,
    note_content: note_content.trim(),
    note_type: noteType,
    category: noteCategory,
    created_by: userId,
    visibility: 'TEAM'
  }))

  const { error: insertError } = await supabase
    .from('customer_notes')
    .insert(notes)

  if (insertError) {
    apiLogger.error('Error adding notes', insertError)
    return NextResponse.json({
      success: false,
      error: 'Failed to add notes'
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Successfully added note to ${customerIds.length} customers`,
    updated_count: customerIds.length
  }, { status: 200 })
}

// Bulk export
async function bulkExport(
  supabase: any,
  customerIds: string[],
  data: any
) {
  const { format } = data
  const exportFormat = format || 'json'

  // Fetch customers with all related data
  const { data: customers, error: fetchError } = await supabase
    .from('customers')
    .select(`
      *,
      users!inner(
        id,
        email,
        full_name,
        sub_role,
        status,
        created_at,
        last_login,
        email_verified,
        mobile_verified
      ),
      profiles(
        mobile,
        date_of_birth,
        gender,
        pan_number,
        aadhaar_number
      )
    `)
    .in('id', customerIds)

  if (fetchError) {
    apiLogger.error('Error fetching customers', fetchError)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customers for export'
    }, { status: 500 })
  }

  // Format data based on export format
  if (exportFormat === 'csv') {
    // CSV export will be handled by frontend
    return NextResponse.json({
      success: true,
      message: `Successfully fetched ${customers.length} customers for CSV export`,
      customers,
      format: 'csv'
    }, { status: 200 })
  }

  // JSON export (default)
  return NextResponse.json({
    success: true,
    message: `Successfully exported ${customers.length} customers`,
    customers,
    format: 'json',
    exported_at: new Date().toISOString()
  }, { status: 200 })
}
