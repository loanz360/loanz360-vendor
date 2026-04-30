import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  uuidParamSchema,
  updateAdminSchema,
  formatValidationErrors,
} from '@/lib/validation/admin-validation'
import {
  handleApiError,
  parseSupabaseError,
} from '@/lib/errors/api-errors'
import {
  checkConcurrentUpdate,
  withRetry,
} from '@/lib/database/transaction-helper'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/admin-management/[id]
 * Get single admin details with permissions
 *
 * Security: UUID validation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data

    // Fetch admin details
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (adminError || !admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Fetch admin permissions
    const { data: permissions } = await supabase
      .from('admin_module_permissions')
      .select('*')
      .eq('admin_id', id)

    // Attach permissions to admin
    const adminWithPermissions = {
      ...admin,
      permissions: permissions || [],
      enabled_modules_count: permissions?.filter(p => p.is_enabled).length || 0
    }

    return NextResponse.json({
      success: true,
      data: adminWithPermissions
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error fetching admin', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin-management/[id]
 * Update admin profile information
 *
 * Security: UUID validation, input sanitization, duplicate email check
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Validate and sanitize input
    const validationResult = updateAdminSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatValidationErrors(validationResult.error),
        },
        { status: 400 }
      )
    }

    const {
      full_name,
      email,
      mobile_number,
      present_address,
      permanent_address,
      location,
      profile_picture_url,
      notes,
      updated_by_user_id,
      last_known_update, // Optional: timestamp for concurrent update detection
    } = validationResult.data

    // Check if admin exists
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found',
        },
        { status: 404 }
      )
    }

    // Check for concurrent updates if last_known_update is provided
    if (last_known_update) {
      const { hasConflict, currentData } = await checkConcurrentUpdate(
        supabase,
        'admins',
        id,
        last_known_update
      )

      if (hasConflict) {
        return NextResponse.json(
          {
            success: false,
            error: 'This admin has been modified by another user. Please refresh and try again.',
            details: {
              conflict: true,
              currentData,
            },
          },
          { status: 409 }
        )
      }
    }

    // If email is being changed, check for duplicates (case-insensitive)
    if (email && email.toLowerCase() !== existingAdmin.email.toLowerCase()) {
      const { data: duplicateEmail } = await supabase
        .from('admins')
        .select('id')
        .ilike('email', email)
        .eq('is_deleted', false)
        .neq('id', id)
        .maybeSingle()

      if (duplicateEmail) {
        return NextResponse.json(
          {
            success: false,
            error: 'Another admin with this email already exists',
          },
          { status: 409 }
        )
      }
    }

    // Build update object with sanitized data
    const updateData: any = {
      updated_by: updated_by_user_id,
      updated_at: new Date().toISOString(),
    }

    if (full_name) updateData.full_name = full_name
    if (email) updateData.email = email
    if (mobile_number) updateData.mobile_number = mobile_number
    if (present_address) updateData.present_address = present_address
    if (permanent_address) updateData.permanent_address = permanent_address
    if (location) updateData.location = location
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url
    if (notes !== undefined) updateData.notes = notes

    // Update admin with retry logic for transient errors
    const updatedAdmin = await withRetry(
      async () => {
        const { data, error: updateError } = await supabase
          .from('admins')
          .update(updateData)
          .eq('id', id)
          .select()
          .maybeSingle()

        if (updateError) {
          throw parseSupabaseError(updateError)
        }

        return data
      },
      { maxRetries: 3, retryDelay: 1000 }
    )

    // Create audit log (non-critical - don't fail if it errors)
    const { error: auditError } = await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'updated',
      p_action_description: `Admin ${existingAdmin.admin_unique_id} profile was updated`,
      p_changes: JSON.stringify({
        before: existingAdmin,
        after: updatedAdmin,
      }),
      p_performed_by: updated_by_user_id,
      p_ip_address:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown',
    })

    if (auditError) {
      apiLogger.error('[Admin Management API] Error creating audit log', auditError)
      // Continue anyway - audit log is non-critical
    }

    return NextResponse.json({
      success: true,
      data: updatedAdmin,
      message: 'Admin updated successfully',
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error updating admin', error)
    const { response, statusCode } = handleApiError(error, request.url)
    return NextResponse.json(
      {
        success: false,
        ...response,
      },
      { status: statusCode }
    )
  }
}

/**
 * DELETE /api/admin-management/[id]
 * Soft delete admin (set is_deleted = true)
 *
 * Security: UUID validation, soft delete pattern preserves audit trail
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }


    const supabase = createSupabaseAdmin()

    // Validate UUID parameter
    const resolvedParams = await params
    const paramValidation = uuidParamSchema.safeParse(resolvedParams)

    if (!paramValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin ID format',
          details: formatValidationErrors(paramValidation.error),
        },
        { status: 400 }
      )
    }

    const { id } = paramValidation.data
    const { searchParams } = new URL(request.url)
    const deleted_by_user_id = searchParams.get('deleted_by')

    // Check if admin exists
    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin not found'
        },
        { status: 404 }
      )
    }

    // Soft delete admin
    const { error: deleteError } = await supabase
      .from('admins')
      .update({
        is_deleted: true,
        updated_by: deleted_by_user_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (deleteError) throw deleteError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: 'deleted',
      p_action_description: `Admin ${existingAdmin.admin_unique_id} (${existingAdmin.full_name}) was deleted`,
      p_changes: JSON.stringify({ admin: existingAdmin }),
      p_performed_by: deleted_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: `Admin ${existingAdmin.admin_unique_id} deleted successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error deleting admin', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
