export const dynamic = 'force-dynamic'

import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { generatePayslipFromDatabase } from '@/lib/pdf/payslip-generator'
import JSZip from 'jszip'
import { apiLogger } from '@/lib/utils/logger'

// POST /api/hr/payroll/payslips/bulk-download
// Bulk download payslips as ZIP file (HR/Superadmin only)
export async function POST(request: Request) {
  // Apply rate limiting (more lenient for bulk operations)
  try {
    const rateLimitResponse = await rateLimit(request, {
    ...RATE_LIMIT_CONFIGS.BULK_OPERATION,
    maxRequests: 5 // 5 requests per window
  })
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
        { success: false, error: 'Access denied. Only HR and Super Admin can bulk download payslips' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { payslip_ids, payroll_run_id } = body

    if (!payslip_ids && !payroll_run_id) {
      return NextResponse.json(
        { success: false, error: 'Either payslip_ids or payroll_run_id is required' },
        { status: 400 }
      )
    }

    // Get payslips
    let query = adminClient
      .from('payslips')
      .select('id, payslip_number, month, year, user_id')
      .order('payslip_number')

    if (payslip_ids && Array.isArray(payslip_ids)) {
      query = query.in('id', payslip_ids)
    } else if (payroll_run_id) {
      query = query.eq('payroll_run_id', payroll_run_id)
    }

    const { data: payslips, error: fetchError } = await query

    if (fetchError || !payslips || payslips.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No payslips found' },
        { status: 404 }
      )
    }

    // Limit bulk download to 100 payslips at a time
    if (payslips.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Cannot download more than 100 payslips at once' },
        { status: 400 }
      )
    }

    // Create ZIP file
    const zip = new JSZip()
    let successCount = 0
    let failCount = 0
    const errors: Array<{ payslipNumber: string; error: string }> = []

    // Generate PDFs and add to ZIP
    for (const payslip of payslips) {
      try {
        const result = await generatePayslipFromDatabase(payslip.id, {
          includeWatermark: false,
          showEmployerContributions: true,
          showYTD: true,
          showCtc: true,
          includeDigitalSignature: true,
          signatoryName: process.env.PAYSLIP_SIGNATORY_NAME || 'HR Manager',
          signatoryDesignation: process.env.PAYSLIP_SIGNATORY_DESIGNATION || 'Human Resources'
        })

        if (result.success && result.pdfBuffer) {
          const fileName = `payslip_${payslip.payslip_number}_${payslip.year}_${String(payslip.month).padStart(2, '0')}.pdf`
          zip.file(fileName, result.pdfBuffer)
          successCount++
        } else {
          failCount++
          errors.push({
            payslipNumber: payslip.payslip_number,
            error: result.error || 'Unknown error'
          })
        }
      } catch (error) {
        failCount++
        errors.push({
          payslipNumber: payslip.payslip_number,
          error: 'Internal server error'
        })
      }
    }

    if (successCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate any payslips', errors },
        { status: 500 }
      )
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // Generate ZIP filename
    const timestamp = new Date().toISOString().split('T')[0]
    const zipFileName = payroll_run_id
      ? `payslips_run_${payroll_run_id}_${timestamp}.zip`
      : `payslips_bulk_${timestamp}.zip`

    // Log to audit trail
    await adminClient
      .from('payroll_audit_log')
      .insert({
        payroll_run_id: payroll_run_id || null,
        action: 'bulk_download_payslips',
        performed_by: user.id,
        details: {
          total_requested: payslips.length,
          successful: successCount,
          failed: failCount,
          errors: errors.length > 0 ? errors : undefined
        }
      })

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Content-Length': zipBuffer.length.toString(),
        'X-Total-Payslips': payslips.length.toString(),
        'X-Successful-Payslips': successCount.toString(),
        'X-Failed-Payslips': failCount.toString()
      }
    })

  } catch (error) {
    apiLogger.error('Bulk download payslips error', error)
    logApiError(error as Error, request, { action: 'bulk_download' })
    return NextResponse.json(
      { success: false, error: 'Failed to bulk download payslips' },
      { status: 500 }
    )
  }
}
