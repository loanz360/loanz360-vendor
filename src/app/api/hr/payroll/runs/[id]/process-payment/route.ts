
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'

// POST /api/hr/payroll/runs/[id]/process-payment
// Process payment for approved payroll run (HR/Superadmin only)
export async function POST(
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
        { success: false, error: 'Access denied. Only HR and Super Admin can process payments' },
        { status: 403 }
      )
    }

    const payrollRunId = id
    const body = await request.json()
    const { payment_date, payment_mode = 'bank_transfer', payment_reference } = body

    // Validate payment date
    if (!payment_date) {
      return NextResponse.json(
        { success: false, error: 'Payment date is required' },
        { status: 400 }
      )
    }

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

    // Validate status - can only process payment for approved payrolls
    if (payrollRun.status !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot process payment for payroll with status: ${payrollRun.status}. Only 'approved' payrolls can be paid.`
        },
        { status: 400 }
      )
    }

    // Update payroll run status to paid with optimistic locking
    const { data: updatedRun, error: updateError } = await adminClient
      .from('payroll_runs')
      .update({
        status: 'paid',
        payment_date,
        payment_mode,
        payment_reference,
        paid_by: user.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', payrollRunId)
      .eq('status', 'approved') // Optimistic lock: only update if still in 'approved' status
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

    // Update all payroll details to mark as paid
    const { error: detailsUpdateError } = await adminClient
      .from('payroll_details')
      .update({
        payment_status: 'paid',
        payment_date,
        payment_mode,
        payment_reference
      })
      .eq('payroll_run_id', payrollRunId)

    if (detailsUpdateError) {
      throw detailsUpdateError
    }

    // Get count of employees paid
    const { count: employeesPaid } = await adminClient
      .from('payroll_details')
      .select('*', { count: 'exact', head: true })
      .eq('payroll_run_id', payrollRunId)
      .eq('payment_status', 'paid')

    // Log to audit trail
    try {
      await adminClient
        .from('payroll_audit_log')
        .insert({
          payroll_run_id: payrollRunId,
          action: 'process_payment',
          performed_by: user.id,
          details: {
            month: payrollRun.month,
            year: payrollRun.year,
            total_employees: payrollRun.total_employees,
            employees_paid: employeesPaid || 0,
            total_amount_paid: payrollRun.total_net_salary,
            payment_date,
            payment_mode,
            payment_reference,
            status_changed: {
              from: 'approved',
              to: 'paid'
            }
          }
        })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for payment processing', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: {
        payroll_run: updatedRun,
        employees_paid: employeesPaid || 0,
        total_amount_paid: payrollRun.total_net_salary,
        payment_date,
        payment_mode
      },
      message: `Payment processed successfully for ${payrollRun.month}/${payrollRun.year}. ${employeesPaid} employees paid.`
    })

  } catch (error) {
    apiLogger.error('Process payment error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}
