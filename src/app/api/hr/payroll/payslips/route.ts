import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { apiLogger } from '@/lib/utils/logger'
import { payslipsQuerySchema } from '@/lib/validations/hr-schemas'
import { generatePayslipFromDatabase } from '@/lib/pdf/payslip-generator'

// GET /api/hr/payroll/payslips
// Fetch payslips (HR sees all, employees see their own)
export async function GET(request: Request) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
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

    // Check user role
    const { data: profile } = await adminClient
      .from('employee_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isHROrAdmin = profile && (profile.role === 'hr' || profile.role === 'superadmin')

    const { searchParams } = new URL(request.url)
    const queryParams = payslipsQuerySchema.safeParse({
      employee_id: searchParams.get('employee_id') || undefined,
      payroll_run_id: searchParams.get('payroll_run_id') || undefined,
      year: searchParams.get('year') || undefined,
      month: searchParams.get('month') || undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      )
    }

    const { employee_id: employeeId, payroll_run_id: payrollRunId, year, month } = queryParams.data

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('payslips')
      .select(`
        *,
        payroll_runs!payslips_payroll_run_id_fkey (
          month,
          year,
          period_start_date,
          period_end_date,
          status
        ),
        employee_profile!payslips_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    // If not HR/Admin, only show own payslips
    if (!isHROrAdmin) {
      query = query.eq('user_id', user.id)
    } else if (employeeId) {
      // HR/Admin can filter by employee
      query = query.eq('user_id', employeeId)
    }

    // Filter by payroll run
    if (payrollRunId) {
      query = query.eq('payroll_run_id', payrollRunId)
    }

    // Filter by year and month
    if (year && month) {
      query = query
        .eq('year', year)
        .eq('month', month)
    }

    const { data: payslips, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: payslips || [],
      meta: { page, page_size: pageSize, total: count ?? 0 }
    })

  } catch (error) {
    apiLogger.error('Fetch payslips error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payslips' },
      { status: 500 }
    )
  }
}

// POST /api/hr/payroll/payslips
// Generate payslips for a payroll run (HR/Superadmin only)
export async function POST(request: Request) {
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
        { success: false, error: 'Access denied. Only HR and Super Admin can generate payslips' },
        { status: 403 }
      )
    }

    const bodySchema = z.object({


      payroll_run_id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { payroll_run_id } = body

    if (!payroll_run_id) {
      return NextResponse.json(
        { success: false, error: 'Payroll run ID is required' },
        { status: 400 }
      )
    }

    // Get the payroll run
    const { data: payrollRun, error: runError } = await adminClient
      .from('payroll_runs')
      .select('*')
      .eq('id', payroll_run_id)
      .maybeSingle()

    if (runError || !payrollRun) {
      return NextResponse.json(
        { success: false, error: 'Payroll run not found' },
        { status: 404 }
      )
    }

    // Validate status - can only generate payslips for approved or paid payrolls
    if (payrollRun.status !== 'approved' && payrollRun.status !== 'paid') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot generate payslips for payroll with status: ${payrollRun.status}. Only 'approved' or 'paid' payrolls.`
        },
        { status: 400 }
      )
    }

    // Get all payroll details for this run
    const { data: payrollDetails, error: detailsError } = await adminClient
      .from('payroll_details')
      .select(`
        *,
        employee_profile!payroll_details_user_id_fkey (
          first_name,
          last_name,
          employee_id,
          email,
          department,
          designation
        )
      `)
      .eq('payroll_run_id', payroll_run_id)

    if (detailsError || !payrollDetails || payrollDetails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No payroll details found for this run' },
        { status: 400 }
      )
    }

    // Check if payslips already exist
    const { data: existingPayslips } = await adminClient
      .from('payslips')
      .select('id')
      .eq('payroll_run_id', payroll_run_id)

    if (existingPayslips && existingPayslips.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Payslips already generated for this payroll run' },
        { status: 400 }
      )
    }

    // Create payslips for each employee
    const payslips = payrollDetails.map(detail => ({
      payroll_run_id,
      payroll_detail_id: detail.id,
      user_id: detail.user_id,
      month: payrollRun.month,
      year: payrollRun.year,
      gross_salary: detail.gross_salary,
      total_deductions: detail.total_deductions,
      net_salary: detail.net_salary,
      payment_date: detail.payment_date,
      pdf_url: null,
      is_sent: false,
      sent_at: null
    }))

    // Insert all payslips
    const { data: createdPayslips, error: insertError } = await adminClient
      .from('payslips')
      .insert(payslips)
      .select()

    if (insertError) {
      throw insertError
    }

    // Generate PDFs in parallel batches (concurrency: 5) for performance
    let pdfSuccessCount = 0
    let pdfFailCount = 0
    const pdfErrors: Array<{ payslip_id: string; error: string }> = []

    if (createdPayslips && createdPayslips.length > 0) {
      const BATCH_SIZE = 5
      for (let i = 0; i < createdPayslips.length; i += BATCH_SIZE) {
        const batch = createdPayslips.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (payslip) => {
            const pdfResult = await generatePayslipFromDatabase(payslip.id, {
              includeWatermark: false,
              showEmployerContributions: true,
              showYTD: true,
              includeDigitalSignature: true,
              signatoryName: process.env.PAYSLIP_SIGNATORY_NAME || 'HR Manager',
              signatoryDesignation: process.env.PAYSLIP_SIGNATORY_DESIGNATION || 'Human Resources'
            })
            if (pdfResult.success && pdfResult.pdfUrl) {
              await adminClient.from('payslips').update({ pdf_url: pdfResult.pdfUrl, pdf_generated_at: new Date().toISOString() }).eq('id', payslip.id)
              return { success: true, id: payslip.id }
            }
            return { success: false, id: payslip.id, error: pdfResult.error || 'PDF generation failed' }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            pdfSuccessCount++
          } else {
            pdfFailCount++
            const errMsg = result.status === 'rejected'
              ? (result.reason instanceof Error ? result.reason.message : 'PDF generation failed')
              : (result.value as { error?: string }).error || 'Unknown error'
            const payslipId = result.status === 'fulfilled' ? (result.value as { id: string }).id : 'unknown'
            pdfErrors.push({ payslip_id: payslipId, error: errMsg })
          }
        }
      }
    }

    // Log to audit trail
    await adminClient
      .from('payroll_audit_log')
      .insert({
        payroll_run_id,
        action: 'generate_payslips',
        performed_by: user.id,
        details: {
          month: payrollRun.month,
          year: payrollRun.year,
          total_payslips_generated: createdPayslips?.length || 0,
          pdfs_generated: pdfSuccessCount,
          pdfs_failed: pdfFailCount,
          pdf_errors: pdfErrors.length > 0 ? pdfErrors : undefined
        }
      })

    // Fetch the updated payslips (with pdf_url populated)
    const { data: finalPayslips } = await adminClient
      .from('payslips')
      .select('*')
      .eq('payroll_run_id', payroll_run_id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        payslips_generated: createdPayslips?.length || 0,
        pdfs_generated: pdfSuccessCount,
        pdfs_failed: pdfFailCount,
        pdf_errors: pdfErrors.length > 0 ? pdfErrors : undefined,
        payslips: finalPayslips || createdPayslips
      },
      message: `${createdPayslips?.length || 0} payslips generated successfully for ${payrollRun.month}/${payrollRun.year}. PDFs: ${pdfSuccessCount} succeeded, ${pdfFailCount} failed.`
    })

  } catch (error) {
    apiLogger.error('Generate payslips error', error)
    logApiError(error as Error, request, { action: 'generate' })
    return NextResponse.json(
      { success: false, error: 'Failed to generate payslips' },
      { status: 500 }
    )
  }
}
