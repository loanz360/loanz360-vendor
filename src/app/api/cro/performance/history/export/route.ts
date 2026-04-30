
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCROAuth } from '@/lib/middleware/cro-auth'
import { apiLogger } from '@/lib/utils/logger'
import ExcelJS from 'exceljs'

/** Format number as INR currency string */
function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Get month name from month number (1-12) */
function getMonthLabel(month: number, year: number): string {
  const date = new Date(year, month - 1)
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

/** Get performance grade from score */
function getGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.READ)
    if (rateLimitResponse) return rateLimitResponse
// Authenticate using centralized CRO auth middleware
    const authResult = await requireCROAuth(request, { logAccess: true })
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    // Validate format parameter
    const format = request.nextUrl.searchParams.get('format')?.toLowerCase()
    if (!format || !['excel', 'pdf'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use ?format=excel or ?format=pdf' },
        { status: 400 }
      )
    }

    // Fetch monthly performance data
    const supabase = await createClient()
    const { data: monthlyPerformance, error: summaryError } = await supabase
      .from('cro_monthly_summary')
      .select('*')
      .eq('cro_id', user.id)
      .order('year', { ascending: true })
      .order('month', { ascending: true })

    if (summaryError) {
      apiLogger.error('Export: Error fetching monthly performance', summaryError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    const performanceData = monthlyPerformance || []

    // Calculate summary statistics
    let bestMonth = { label: 'N/A', score: 0 }
    let totalScore = 0

    for (const perf of performanceData) {
      const score = perf.performance_score || 0
      totalScore += score
      if (score > bestMonth.score) {
        bestMonth = {
          label: getMonthLabel(perf.month, perf.year),
          score,
        }
      }
    }

    const averageScore = performanceData.length > 0
      ? Math.round((totalScore / performanceData.length) * 100) / 100
      : 0

    // Calculate trend
    let trend = 'Stable'
    if (performanceData.length >= 3) {
      const last3 = performanceData.slice(-3)
      const firstScore = last3[0].performance_score || 0
      const lastScore = last3[2].performance_score || 0
      if (lastScore > firstScore * 1.05) trend = 'Improving'
      else if (lastScore < firstScore * 0.95) trend = 'Declining'
    }

    // --- PDF format: return JSON data for client-side PDF generation ---
    if (format === 'pdf') {
      return NextResponse.json({
        success: true,
        data: {
          monthly_performance: performanceData.map((perf) => ({
            month: getMonthLabel(perf.month, perf.year),
            calls: perf.total_calls || 0,
            leads_generated: perf.leads_generated || 0,
            converted: perf.leads_converted || 0,
            conversion_rate: perf.conversion_rate || 0,
            revenue: perf.total_revenue || 0,
            disbursed: perf.total_disbursed || 0,
            score: perf.performance_score || 0,
            grade: getGrade(perf.performance_score || 0),
            rank: perf.rank || '-',
          })),
          summary: {
            best_month: bestMonth.label,
            best_month_score: bestMonth.score,
            average_score: averageScore,
            total_months: performanceData.length,
            trend,
          },
        },
        message: 'PDF generation to be implemented client-side. Use this data to render.',
      })
    }

    // --- Excel format: generate .xlsx workbook ---
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'LOANZ 360'
    workbook.created = new Date()

    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6700' },
    }
    const headerFont: Partial<ExcelJS.Font> = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11,
    }
    const headerAlignment: Partial<ExcelJS.Alignment> = {
      horizontal: 'center',
      vertical: 'middle',
    }

    // ---- Sheet 1: Monthly Performance ----
    const perfSheet = workbook.addWorksheet('Monthly Performance')

    perfSheet.columns = [
      { header: 'Month', key: 'month', width: 20 },
      { header: 'Calls', key: 'calls', width: 12 },
      { header: 'Leads Generated', key: 'leads_generated', width: 18 },
      { header: 'Converted', key: 'converted', width: 14 },
      { header: 'Conversion Rate', key: 'conversion_rate', width: 18 },
      { header: 'Revenue', key: 'revenue', width: 20 },
      { header: 'Disbursed', key: 'disbursed', width: 20 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Rank', key: 'rank', width: 10 },
    ]

    // Style header row
    const headerRow = perfSheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = headerAlignment
    })
    headerRow.height = 24

    // Add data rows
    for (const perf of performanceData) {
      const conversionRate = perf.conversion_rate || 0
      perfSheet.addRow({
        month: getMonthLabel(perf.month, perf.year),
        calls: perf.total_calls || 0,
        leads_generated: perf.leads_generated || 0,
        converted: perf.leads_converted || 0,
        conversion_rate: `${conversionRate.toFixed(1)}%`,
        revenue: formatINR(perf.total_revenue || 0),
        disbursed: formatINR(perf.total_disbursed || 0),
        score: perf.performance_score || 0,
        grade: getGrade(perf.performance_score || 0),
        rank: perf.rank || '-',
      })
    }

    // Auto-fit column widths based on content
    perfSheet.columns.forEach((column) => {
      if (!column || !column.eachCell) return
      let maxLength = (column.header as string)?.length || 10
      column.eachCell({ includeEmpty: false }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 0
        if (cellLength > maxLength) maxLength = cellLength
      })
      column.width = Math.min(maxLength + 4, 40)
    })

    // ---- Sheet 2: Summary ----
    const summarySheet = workbook.addWorksheet('Summary')

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 25 },
      { header: 'Value', key: 'value', width: 30 },
    ]

    // Style header row
    const summaryHeaderRow = summarySheet.getRow(1)
    summaryHeaderRow.eachCell((cell) => {
      cell.fill = headerFill
      cell.font = headerFont
      cell.alignment = headerAlignment
    })
    summaryHeaderRow.height = 24

    summarySheet.addRow({ metric: 'Best Month', value: bestMonth.label })
    summarySheet.addRow({ metric: 'Best Month Score', value: bestMonth.score })
    summarySheet.addRow({ metric: 'Average Score', value: averageScore })
    summarySheet.addRow({ metric: 'Total Months', value: performanceData.length })
    summarySheet.addRow({ metric: 'Performance Trend', value: trend })

    // Bold the metric labels
    summarySheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) {
        const metricCell = row.getCell(1)
        metricCell.font = { bold: true }
      }
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    const fileName = `CRO_Performance_History_${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    apiLogger.error('Error exporting performance history', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export performance history' },
      { status: 500 }
    )
  }
}
