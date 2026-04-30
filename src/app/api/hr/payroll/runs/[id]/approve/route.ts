
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

// PUT /api/hr/payroll/runs/[id]/approve
// Approve a payroll run (HR/Superadmin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const hasAccess = await checkHRAccess(supabase)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can approve payroll' },
        { status: 403 }
      )
    }

    const payrollRunId = id

    // Get the payroll run
    const { data: payrollRun, error: fetchError } = await adminClient
      .from('payroll_runs')
      .select('*')
      .eq('id', payrollRunId)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }

    if (!payrollRun) {
      return NextResponse.json(
        { success: false, error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    // Validate status - can only approve processed payrolls
    if (payrollRun.status !== 'processed') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot approve payroll with status: ${payrollRun.status}. Only 'processed' payrolls can be approved.`
        },
        { status: 400 }
      )
    }

    // Update payroll run status to approved with optimistic locking
    const { data: updatedRun, error: updateError } = await adminClient
      .from('payroll_runs')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payrollRunId)
      .eq('status', 'processed') // Optimistic lock: only update if still in 'processed' status
      .select()
      .maybeSingle()

    if (updateError && updateError.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      )
    }

    if (updateError) {
      throw updateError
    }

    if (!updatedRun) {
      return NextResponse.json(
        { success: false, error: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      )
    }

    // Log to audit trail
    try {
      await adminClient
        .from('payroll_audit_log')
        .insert({
          payroll_run_id: payrollRunId,
          action: 'approve_payroll',
          performed_by: user.id,
          details: {
            month: payrollRun.month,
            year: payrollRun.year,
            total_employees: payrollRun.total_employees,
            total_net_salary: payrollRun.total_net_salary,
            status_changed: {
              from: 'processed',
              to: 'approved'
            }
          }
        })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for payroll approval', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: updatedRun,
      message: `Payroll for ${payrollRun.month}/${payrollRun.year} approved successfully`
    })

  } catch (error) {
    apiLogger.error('Approve payroll error', error)
    logApiError(error as Error, request, { action: 'put' })
    return NextResponse.json(
      { success: false, error: 'Failed to approve payroll' },
      { status: 500 }
    )
  }
}
