
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import {
  uuidParamSchema,
  updateStatusSchema,
  formatValidationErrors,
} from '@/lib/validation/admin-validation'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/admin-management/[id]/status
 * Enable or disable an admin
 *
 * Security: UUID validation, status enum validation
 */
export async function POST(
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
    const body = await request.json()

    // Validate and sanitize input
    const validationResult = updateStatusSchema.safeParse(body)

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

    const { status, updated_by_user_id } = validationResult.data

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

    // Check if status is already the same
    if (existingAdmin.status === status) {
      return NextResponse.json(
        {
          success: false,
          error: `Admin is already ${status}`
        },
        { status: 400 }
      )
    }

    // Update admin status
    const { data: updatedAdmin, error: updateError } = await supabase
      .from('admins')
      .update({
        status,
        updated_by: updated_by_user_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) throw updateError

    // Create audit log
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: id,
      p_action_type: status === 'enabled' ? 'enabled' : 'disabled',
      p_action_description: `Admin ${existingAdmin.admin_unique_id} (${existingAdmin.full_name}) was ${status}`,
      p_changes: JSON.stringify({
        before: { status: existingAdmin.status },
        after: { status }
      }),
      p_performed_by: updated_by_user_id,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      data: updatedAdmin,
      message: `Admin ${status} successfully`
    })
  } catch (error: unknown) {
    apiLogger.error('[Admin Management API] Error updating admin status', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}
