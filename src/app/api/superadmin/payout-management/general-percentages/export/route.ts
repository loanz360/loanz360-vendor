
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'

// GET - Export payout percentages to Excel
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
const superAdminSession = request.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSupabaseAdmin()

    // Fetch all payout percentages
    const { data, error } = await supabase
      .from('payout_general_percentages')
      .select('bank_name, location, loan_type, commission_percentage, created_at, updated_at')
      .order('bank_name', { ascending: true })
      .order('location', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching payout percentages for export', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'No data to export' }, { status: 404 })
    }

    // Format data for Excel
    const exportData = data.map(row => ({
      'Bank Name': row.bank_name,
      'Location': row.location,
      'Loan Type': row.loan_type,
      'Commission Percentage': row.commission_percentage,
      'Created At': new Date(row.created_at).toLocaleString(),
      'Updated At': new Date(row.updated_at).toLocaleString()
    }))

    // Create workbook with ExcelJS
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Payout General Percentages')

    // Add headers
    const headers = Object.keys(exportData[0])
    worksheet.addRow(headers)

    // Add data rows
    exportData.forEach(row => {
      worksheet.addRow(Object.values(row))
    })

    // Set column widths
    worksheet.columns = [
      { width: 25 }, // Bank Name
      { width: 20 }, // Location
      { width: 20 }, // Loan Type
      { width: 20 }, // Commission Percentage
      { width: 20 }, // Created At
      { width: 20 }  // Updated At
    ]

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `Payout_General_Percentages_${timestamp}.xlsx`

    // Return file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    apiLogger.error('Error in export', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
