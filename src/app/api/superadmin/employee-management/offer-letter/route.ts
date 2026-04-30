import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth, checkPermission } from '@/lib/auth/employee-mgmt-auth'
import { logger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { generateOfferLetterPDF, buildOfferLetterData } from '@/lib/pdf/offer-letter-generator'

export const runtime = 'nodejs'

/**
 * POST /api/superadmin/employee-management/offer-letter
 * Generate offer letter PDF for an employee
 * Body: { employee_id: UUID, include_compensation?: boolean }
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const auth = await verifyAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status || 401 }
      )
    }

    const hasPermission = await checkPermission(auth.userId!, auth.role!, 'VIEW_EMPLOYEES')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { employee_id, include_compensation = true } = body

    if (!employee_id) {
      return NextResponse.json(
        { success: false, error: 'employee_id is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Fetch employee with department
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select(`
        id, employee_id, full_name, sub_role, date_of_joining,
        present_address, city, state, probation_end_date,
        reporting_manager_id,
        departments:department_id (id, name)
      `)
      .eq('id', employee_id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { success: false, error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Fetch reporting manager name if exists
    let reportingManagerName: string | undefined
    if (employee.reporting_manager_id) {
      const { data: manager } = await supabase
        .from('employees')
        .select('full_name')
        .eq('id', employee.reporting_manager_id)
        .maybeSingle()
      reportingManagerName = manager?.full_name
    }

    // Generate reference number: OL/YYYY/EmpID
    const year = new Date().getFullYear()
    const refNumber = `OL/${year}/${employee.employee_id}`

    // Build offer letter data
    const offerData = buildOfferLetterData({
      full_name: employee.full_name,
      present_address: employee.present_address,
      sub_role: employee.sub_role,
      department_name: (employee as any).departments?.name,
      date_of_joining: employee.date_of_joining,
      city: employee.city,
      state: employee.state,
      probation_end_date: employee.probation_end_date,
      reporting_manager_name: reportingManagerName,
      // Salary data would come from a salary table if available
    }, refNumber)

    // Generate PDF
    const pdfBuffer = await generateOfferLetterPDF(offerData, {
      includeCompensation: include_compensation,
    })

    logger.info(`Offer letter generated for ${employee.employee_id} by ${auth.userId}`)

    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Offer_Letter_${employee.employee_id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    logger.error('Error in POST /api/superadmin/employee-management/offer-letter:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate offer letter' },
      { status: 500 }
    )
  }
}
