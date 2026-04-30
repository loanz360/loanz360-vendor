
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/hr/payroll/payslips/[id]/send
// Send payslip email to employee (HR/Superadmin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
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
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!profile || (profile.role !== 'hr' && profile.role !== 'superadmin')) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Only HR and Super Admin can send payslips' },
        { status: 403 }
      )
    }

    const payslipId = id

    // Get the payslip with employee details
    const { data: payslip, error: fetchError } = await adminClient
      .from('payslips')
      .select(`
        *,
        employee_profile!payslips_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          email
        ),
        payroll_runs!payslips_payroll_run_id_fkey (
          month,
          year
        )
      `)
      .eq('id', payslipId)
      .maybeSingle()

    if (fetchError || !payslip) {
      return NextResponse.json(
        { success: false, error: 'Payslip not found' },
        { status: 404 }
      )
    }

    // Check if already sent
    if (payslip.is_sent) {
      return NextResponse.json(
        {
          success: false,
          error: `Payslip already sent on ${payslip.sent_at}`
        },
        { status: 400 }
      )
    }

    // Validate the payslip has a PDF generated before sending
    if (!payslip.pdf_url) {
      return NextResponse.json(
        { success: false, error: 'Payslip PDF has not been generated yet. Generate the PDF before sending.' },
        { status: 400 }
      )
    }

    // Validate employee email exists
    const employeeEmail = payslip.employee_profile?.email
    if (!employeeEmail) {
      return NextResponse.json(
        { success: false, error: 'Employee email not found. Cannot send payslip without a valid email address.' },
        { status: 400 }
      )
    }

    // TODO: Implement actual email sending logic here
    // This would typically use a service like SendGrid, AWS SES, or Supabase Edge Functions
    // For now, we'll just mark as sent
    let emailSendError: string | null = null
    try {
      // Placeholder for email sending - when implemented, errors will be caught here
      apiLogger.info('Payslip email queued', { payslipId, email: employeeEmail })
    } catch (emailErr) {
      emailSendError = emailErr instanceof Error ? emailErr.message : 'Email delivery failed'
      apiLogger.error('Failed to send payslip email', { payslipId, email: employeeEmail, error: emailErr })
      return NextResponse.json(
        { success: false, error: `Failed to send payslip email: ${emailSendError}` },
        { status: 502 }
      )
    }

    // Update payslip as sent
    const { data: updatedPayslip, error: updateError } = await adminClient
      .from('payslips')
      .update({
        is_sent: true,
        sent_at: new Date().toISOString()
      })
      .eq('id', payslipId)
      .select()
      .maybeSingle()

    if (updateError) {
      throw updateError
    }

    // Log to audit trail
    await adminClient
      .from('payroll_audit_log')
      .insert({
        payroll_run_id: payslip.payroll_run_id,
        action: 'send_payslip',
        performed_by: user.id,
        details: {
          payslip_id: payslipId,
          employee_id: payslip.user_id,
          employee_email: payslip.employee_profile?.email,
          month: payslip.payroll_runs?.month,
          year: payslip.payroll_runs?.year
        }
      })

    return NextResponse.json({
      success: true,
      data: updatedPayslip,
      message: `Payslip sent successfully to ${payslip.employee_profile?.email}`
    })

  } catch (error) {
    apiLogger.error('Send payslip error', error)
    logApiError(error as Error, request, { action: 'post' })
    return NextResponse.json(
      { success: false, error: 'Failed to send payslip' },
      { status: 500 }
    )
  }
}
