export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { generatePayslipFromDatabase, getPayslipDownloadUrl } from '@/lib/pdf/payslip-generator'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/employees/payroll/payslips/[id]/download
// Download payslip PDF (employees can only download their own, HR can download any)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DOWNLOAD)
    if (rateLimitResponse) return rateLimitResponse
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get payslip from database
    const { data: payslip, error: fetchError } = await supabase
      .from('payslips')
      .select('*, payroll_details!inner(user_id)')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !payslip) {
      return NextResponse.json(
        { success: false, error: 'Payslip not found' },
        { status: 404 }
      )
    }

    // Check authorization — use users table (consistent with rest of codebase)
    const { data: userData } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const isHROrAdmin = userData && (
      userData.role === 'SUPER_ADMIN' ||
      userData.sub_role === 'hr_manager' ||
      userData.sub_role === 'hr_executive'
    )
    // Handle user_id from payslips table or from joined payroll_details
    const payslipUserId = payslip.user_id || payslip.payroll_details?.user_id
    const isOwner = payslipUserId === user.id

    if (!isOwner && !isHROrAdmin) {
      return NextResponse.json(
        { success: false, error: 'Access denied. You can only download your own payslips' },
        { status: 403 }
      )
    }

    // Check if PDF already exists
    if (payslip.pdf_url) {
      // PDF already generated - get signed URL for download
      const signedUrl = await getPayslipDownloadUrl(payslip.pdf_url, 3600)

      if (signedUrl) {
        // Update download tracking
        await supabase
          .from('payslips')
          .update({
            download_count: (payslip.download_count || 0) + 1,
            last_downloaded_at: new Date().toISOString()
          })
          .eq('id', params.id)

        // Return signed URL for download
        return NextResponse.json({
          success: true,
          data: {
            downloadUrl: signedUrl,
            payslipNumber: payslip.payslip_number,
            month: payslip.month,
            year: payslip.year
          }
        })
      }
    }

    // Generate PDF on-the-fly
    const { searchParams } = new URL(request.url)
    const includeWatermark = searchParams.get('watermark') === 'true'
    const showEmployerContributions = searchParams.get('show_employer') === 'true'
    const showYTD = searchParams.get('show_ytd') === 'true'
    const showCtc = searchParams.get('show_ctc') === 'true'

    const result = await generatePayslipFromDatabase(params.id, {
      includeWatermark: includeWatermark || (payslip.status === 'draft'),
      showEmployerContributions,
      showYTD,
      showCtc,
      includeDigitalSignature: true,
      signatoryName: process.env.PAYSLIP_SIGNATORY_NAME || 'HR Manager',
      signatoryDesignation: process.env.PAYSLIP_SIGNATORY_DESIGNATION || 'Human Resources',
      primaryColor: '#2563eb',
      accentColor: '#16a34a'
    })

    if (!result.success || !result.pdfBuffer) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to generate PDF' },
        { status: 500 }
      )
    }

    // Update download tracking
    await supabase
      .from('payslips')
      .update({
        download_count: (payslip.download_count || 0) + 1,
        last_downloaded_at: new Date().toISOString()
      })
      .eq('id', params.id)

    // Return PDF file
    const fileName = `payslip_${payslip.payslip_number}_${payslip.year}_${String(payslip.month).padStart(2, '0')}.pdf`

    return new NextResponse(result.pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': result.pdfBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600'
      }
    })

  } catch (error) {
    apiLogger.error('Download payslip error', error)
    logApiError(error as Error, request, { action: 'download', payslipId: params.id })
    return NextResponse.json(
      { success: false, error: 'Failed to download payslip' },
      { status: 500 }
    )
  }
}
