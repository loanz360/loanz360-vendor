import { parseBody } from '@/lib/utils/parse-body'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// PUT /api/hr/payroll/tax-declarations/[id]/approve
// Approve or reject tax declaration (HR/Superadmin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is HR or superadmin
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can approve tax declarations' },
        { status: 403 }
      )
    }

    const { id: declarationId } = await params
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { action, remarks } = body // action: 'approve' or 'reject'

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Get the declaration
    const { data: declaration, error: fetchError } = await adminClient
      .from('tax_declarations')
      .select('*')
      .eq('id', declarationId)
      .maybeSingle()

    if (fetchError || !declaration) {
      return NextResponse.json(
        { success: false, error: 'Tax declaration not found' },
        { status: 404 }
      )
    }

    // Cannot modify already approved/rejected declarations
    if (declaration.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot modify declaration with status: ${declaration.status}`
        },
        { status: 400 }
      )
    }

    // Update declaration status
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const updateData: Record<string, unknown> = {
      status: newStatus,
      approval_remarks: remarks || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }
    // Only set approved_by/approved_at for approvals
    if (action === 'approve') {
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
    } else {
      updateData.approved_by = null
      updateData.approved_at = null
    }

    const { data: updated, error: updateError } = await adminClient
      .from('tax_declarations')
      .update(updateData)
      .eq('id', declarationId)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Tax declaration ${action}d successfully`
    })

  } catch (error) {
    apiLogger.error('Approve/reject tax declaration error', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      { success: false, error: 'Failed to process tax declaration' },
      { status: 500 }
    )
  }
}
