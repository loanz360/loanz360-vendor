
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCPERole } from '@/lib/auth/cpe-auth'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/cpe/analytics/export
 *
 * Export analytics data to Excel format
 * Query params:
 *   - format: 'excel' (default, PDF not implemented yet)
 *   - month: YYYY-MM format (default: current month)
 *   - months: Number of months for trends (default: 6)
 *
 * Returns:
 *   - Excel file with multiple sheets:
 *     1. Summary Dashboard
 *     2. Partner Growth Trends
 *     3. Business Performance
 *     4. Partner List
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is a Channel Partner Executive
    const isCPE = await verifyCPERole(supabase, user)

    if (!isCPE) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Channel Partner Executive role required.' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'excel'
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7)
    const monthsBack = parseInt(searchParams.get('months') || '6')

    // Only support Excel for now
    if (format !== 'excel') {
      return NextResponse.json(
        { success: false, error: 'Only Excel format is currently supported' },
        { status: 400 }
      )
    }

    // Fetch all required data
    const [summaryResult, growthResult, businessResult, partnersResult] = await Promise.all([
      // 1. Summary data
      supabase.rpc('get_cpe_analytics_summary', {
        p_cpe_user_id: user.id,
        p_target_month: `${month}-01`,
      }),

      // 2. Growth trends
      supabase.rpc('get_partner_growth_trends', {
        p_cpe_user_id: user.id,
        p_months_back: monthsBack,
      }),

      // 3. Business performance from cpe_daily_metrics
      supabase
        .from('cpe_daily_metrics')
        .select('metric_date, total_loan_amount, sanctioned_loan_amount, disbursed_loan_amount, total_loan_applications')
        .eq('user_id', user.id)
        .gte('metric_date', new Date(new Date().setMonth(new Date().getMonth() - monthsBack)).toISOString().split('T')[0])
        .order('metric_date', { ascending: true }),

      // 4. Partner list
      supabase
        .from('partners')
        .select(`
          id,
          full_name,
          mobile_number,
          partner_type,
          status,
          created_at,
          total_business_sourced,
          total_applications_sourced
        `)
        .eq('recruited_by_cpe', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (summaryResult.error || growthResult.error || businessResult.error || partnersResult.error) {
      apiLogger.error('Error fetching data for export', {
        summary: summaryResult.error,
        growth: growthResult.error,
        business: businessResult.error,
        partners: partnersResult.error,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch export data' },
        { status: 500 }
      )
    }

    // Process business performance data (group by month)
    const monthlyBusinessData: { [key: string]: any } = {}
    businessResult.data?.forEach((record) => {
      const monthKey = record.metric_date.substring(0, 7)
      if (!monthlyBusinessData[monthKey]) {
        monthlyBusinessData[monthKey] = {
          month: monthKey,
          totalLoanAmount: 0,
          sanctionedAmount: 0,
          disbursedAmount: 0,
          totalApplications: 0,
        }
      }
      monthlyBusinessData[monthKey].totalLoanAmount += parseFloat(record.total_loan_amount || 0)
      monthlyBusinessData[monthKey].sanctionedAmount += parseFloat(record.sanctioned_loan_amount || 0)
      monthlyBusinessData[monthKey].disbursedAmount += parseFloat(record.disbursed_loan_amount || 0)
      monthlyBusinessData[monthKey].totalApplications += parseInt(record.total_loan_applications || 0)
    })
    const businessMonthly = Object.values(monthlyBusinessData).sort((a: any, b: any) =>
      a.month.localeCompare(b.month)
    )

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Loanz360'
    workbook.created = new Date()
    workbook.modified = new Date()

    // Sheet 1: Summary Dashboard
    const summarySheet = workbook.addWorksheet('Summary Dashboard')
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Current Value', key: 'current', width: 20 },
      { header: 'Growth %', key: 'growth', width: 15 },
      { header: 'Direction', key: 'direction', width: 15 },
    ]

    const summary = summaryResult.data
    summarySheet.addRows([
      { metric: 'Total Partners', current: summary.totalPartners?.count || 0, growth: summary.totalPartners?.growth?.percentage || 0, direction: summary.totalPartners?.growth?.direction || 'neutral' },
      { metric: 'Business Associates', current: summary.businessAssociates?.count || 0, growth: summary.businessAssociates?.growth?.percentage || 0, direction: summary.businessAssociates?.growth?.direction || 'neutral' },
      { metric: 'Business Partners', current: summary.businessPartners?.count || 0, growth: summary.businessPartners?.growth?.percentage || 0, direction: summary.businessPartners?.growth?.direction || 'neutral' },
      { metric: 'Channel Partners', current: summary.channelPartners?.count || 0, growth: summary.channelPartners?.growth?.percentage || 0, direction: summary.channelPartners?.growth?.direction || 'neutral' },
    ])

    // Style header row
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' },
    }

    // Sheet 2: Partner Growth Trends
    const growthSheet = workbook.addWorksheet('Partner Growth Trends')
    growthSheet.columns = [
      { header: 'Month', key: 'month', width: 15 },
      { header: 'Business Associates', key: 'ba', width: 20 },
      { header: 'Business Partners', key: 'bp', width: 20 },
      { header: 'Channel Partners', key: 'cp', width: 20 },
      { header: 'Total', key: 'total', width: 15 },
    ]

    const growthMonths = growthResult.data?.months || []
    growthMonths.forEach((m: any) => {
      growthSheet.addRow({
        month: m.month,
        ba: m.businessAssociates || 0,
        bp: m.businessPartners || 0,
        cp: m.channelPartners || 0,
        total: m.total || 0,
      })
    })

    growthSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    growthSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' },
    }

    // Sheet 3: Business Performance
    const businessSheet = workbook.addWorksheet('Business Performance')
    businessSheet.columns = [
      { header: 'Month', key: 'month', width: 15 },
      { header: 'Total Loan Amount (₹)', key: 'totalLoan', width: 25 },
      { header: 'Sanctioned Amount (₹)', key: 'sanctioned', width: 25 },
      { header: 'Disbursed Amount (₹)', key: 'disbursed', width: 25 },
      { header: 'Total Applications', key: 'applications', width: 20 },
    ]

    businessMonthly.forEach((m: any) => {
      businessSheet.addRow({
        month: m.month,
        totalLoan: m.totalLoanAmount || 0,
        sanctioned: m.sanctionedAmount || 0,
        disbursed: m.disbursedAmount || 0,
        applications: m.totalApplications || 0,
      })
    })

    businessSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    businessSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' },
    }

    // Format currency columns
    businessSheet.getColumn('totalLoan').numFmt = '₹#,##0.00'
    businessSheet.getColumn('sanctioned').numFmt = '₹#,##0.00'
    businessSheet.getColumn('disbursed').numFmt = '₹#,##0.00'

    // Sheet 4: Partner List
    const partnersSheet = workbook.addWorksheet('Partner List')
    partnersSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Joined Date', key: 'joined', width: 15 },
      { header: 'Total Business (₹)', key: 'business', width: 20 },
      { header: 'Applications', key: 'applications', width: 15 },
    ]

    partnersResult.data?.forEach((partner: any) => {
      partnersSheet.addRow({
        name: partner.full_name || 'N/A',
        mobile: partner.mobile_number || 'N/A',
        type: partner.partner_type?.replace(/_/g, ' ') || 'N/A',
        status: partner.status || 'N/A',
        joined: partner.created_at ? new Date(partner.created_at).toLocaleDateString('en-IN') : 'N/A',
        business: partner.total_business_sourced || 0,
        applications: partner.total_applications_sourced || 0,
      })
    })

    partnersSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    partnersSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0066CC' },
    }

    partnersSheet.getColumn('business').numFmt = '₹#,##0.00'

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Generate filename
    const filename = `CPE_Analytics_${employeeProfile.full_name?.replace(/\s+/g, '_')}_${month}_${new Date().toISOString().split('T')[0]}.xlsx`

    // Return file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    apiLogger.error('Error in analytics export API', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
