
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { checkHRAccess } from '@/lib/auth/hr-access'

// Allowed status transitions for payroll runs
const ALLOWED_TRANSITIONS: Record<string, string> = {
  draft: 'processing',
  processing: 'processed',
  processed: 'approved',
  approved: 'paid',
}

// GET /api/hr/payroll/runs/[id]
// Fetch a single payroll run by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR or superadmin
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. HR role required.' },
        { status: 403 }
      )
    }

    const { data: payrollRun, error } = await adminClient
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!payrollRun) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: payrollRun })
  } catch (error) {
    apiLogger.error('Fetch payroll run error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json({ success: false, error: 'Failed to fetch payroll run' }, { status: 500 })
  }
}

// PATCH /api/hr/payroll/runs/[id]
// Update payroll run status with workflow enforcement
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { id } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is HR or superadmin
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can update payroll status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { status: newStatus } = body

    if (!newStatus) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      )
    }

    // Fetch current payroll run
    const { data: payrollRun, error: fetchError } = await adminClient
      .from('payroll_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }

    if (!payrollRun) {
      return NextResponse.json({ success: false, error: 'Payroll run not found' }, { status: 404 })
    }

    // Enforce status transition workflow
    const currentStatus = payrollRun.status
    const allowedNext = ALLOWED_TRANSITIONS[currentStatus]

    if (allowedNext !== newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status transition: '${currentStatus}' -> '${newStatus}'. Allowed: '${currentStatus}' -> '${allowedNext || 'none (terminal state)'}'`
        },
        { status: 400 }
      )
    }

    // Build update payload
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    if (newStatus === 'approved') {
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
    }

    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    // Update with optimistic locking: ensure status hasn't changed since we read it
    const { data: updated, error: updateError } = await adminClient
      .from('payroll_runs')
      .update(updateData)
      .eq('id', id)
      .eq('status', currentStatus) // Optimistic lock: only update if status hasn't changed
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      )
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'UPDATE',
        entity_type: 'payroll_run',
        entity_id: id,
        description: `Updated payroll run status from '${currentStatus}' to '${newStatus}'`,
        details: { old_status: currentStatus, new_status: newStatus, month: payrollRun.month, year: payrollRun.year }
      })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for payroll run status update', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Payroll run status updated from '${currentStatus}' to '${newStatus}'`
    })
  } catch (error) {
    apiLogger.error('Update payroll run status error', error)
    logApiError(error as Error, request, { action: 'update' })
    return NextResponse.json({ success: false, error: 'Failed to update payroll run status' }, { status: 500 })
  }
}
