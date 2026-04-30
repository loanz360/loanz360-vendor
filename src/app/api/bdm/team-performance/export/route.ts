/**
 * ============================================================================
 * BDM TEAM PERFORMANCE - EXPORT API ENDPOINT
 * ============================================================================
 *
 * Purpose: Export team performance data in multiple formats
 * Formats: Excel (.xlsx), PDF (.pdf), CSV (.csv)
 *
 * Features:
 * - Multi-format export support
 * - Comprehensive data aggregation
 * - Professional formatting
 * - Download-ready file generation
 *
 * Route: GET /api/bdm/team-performance/export
 * Query Parameters:
 *   - format: 'excel' | 'pdf' | 'csv'
 *   - month: number (1-12)
 *   - year: number
 *   - tab: 'overview' | 'bde-details' | 'leaderboard' | 'historical' | 'projections'
 *
 * Created: December 7, 2025
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { apiLogger } from '@/lib/utils/logger'


export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'excel'
    const month = parseInt(searchParams.get('month') || new Date().getMonth().toString())
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const tab = searchParams.get('tab') || 'overview'

    // Validate format
    if (!['excel', 'pdf', 'csv'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be excel, pdf, or csv' },
        { status: 400 }
      )
    }

    // Fetch comprehensive data
    const supabase = await createClient()
    const data = await fetchExportData(supabase, month, year, tab)

    // Generate file based on format
    let fileBuffer: Buffer
    let contentType: string
    let filename: string

    switch (format) {
      case 'excel':
        fileBuffer = await generateExcelFile(data, month, year, tab)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        filename = `BDM_Team_Performance_${getMonthName(month)}_${year}.xlsx`
        break
      case 'pdf':
        fileBuffer = await generatePDFFile(data, month, year, tab)
        contentType = 'application/pdf'
        filename = `BDM_Team_Performance_${getMonthName(month)}_${year}.pdf`
        break
      case 'csv':
        fileBuffer = await generateCSVFile(data, month, year, tab)
        contentType = 'text/csv'
        filename = `BDM_Team_Performance_${getMonthName(month)}_${year}.csv`
        break
      default:
        throw new Error('Unsupported format')
    }

    // Return file as download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    apiLogger.error('Export API Error', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchExportData(supabase: unknown, month: number, year: number, tab: string) {
  const startDate = new Date(year, month, 1)
  const endDate = new Date(year, month + 1, 0)

  // Fetch team targets
  const { data: teamTargets } = await supabase
    .from('bdm_team_targets')
    .select('*')
    .eq('month', month + 1)
    .eq('year', year)
    .maybeSingle()

  // Fetch BDE daily performance
  const { data: bdeDaily } = await supabase
    .from('bde_daily_performance')
    .select(`
      *,
      bde:user_id (
        id,
        full_name,
        email
      )
    `)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true })

  // Fetch individual BDE targets
  const { data: bdeTargets } = await supabase
    .from('bde_individual_targets')
    .select(`
      *,
      bde:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('month', month + 1)
    .eq('year', year)

  return {
    teamTargets,
    bdeDaily: bdeDaily || [],
    bdeTargets: bdeTargets || [],
    month,
    year,
    tab,
  }
}

// ============================================================================
// EXCEL GENERATION
// ============================================================================

async function generateExcelFile(data: unknown, month: number, year: number, tab: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // Set workbook properties
  workbook.creator = 'Loanz360 BDM System'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.lastPrinted = new Date()

  // Add worksheets based on tab
  if (tab === 'overview' || tab === 'all') {
    await addOverviewSheet(workbook, data)
  }
  if (tab === 'bde-details' || tab === 'all') {
    await addBDEDetailsSheet(workbook, data)
  }
  if (tab === 'leaderboard' || tab === 'all') {
    await addLeaderboardSheet(workbook, data)
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

async function addOverviewSheet(workbook: ExcelJS.Workbook, data: unknown) {
  const sheet = workbook.addWorksheet('Team Overview', {
    properties: { tabColor: { argb: 'FF4F46E5' } },
  })

  // Title
  sheet.mergeCells('A1:H1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `BDM Team Performance - ${getMonthName(data.month)} ${data.year}`
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF4F46E5' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  // Team Summary Section
  sheet.addRow([])
  sheet.addRow(['TEAM SUMMARY']).font = { bold: true, size: 12 }
  sheet.addRow(['Metric', 'Current', 'Target', 'Gap', 'Achievement %'])

  // Calculate team totals
  const teamData = calculateTeamTotals(data.bdeDaily, data.teamTargets)

  const summaryRows = [
    ['Conversions', teamData.conversions, data.teamTargets?.conversion_target || 0,
     teamData.conversions - (data.teamTargets?.conversion_target || 0),
     ((teamData.conversions / (data.teamTargets?.conversion_target || 1)) * 100).toFixed(1) + '%'],
    ['Revenue', formatCurrency(teamData.revenue), formatCurrency(data.teamTargets?.revenue_target || 0),
     formatCurrency(teamData.revenue - (data.teamTargets?.revenue_target || 0)),
     ((teamData.revenue / (data.teamTargets?.revenue_target || 1)) * 100).toFixed(1) + '%'],
    ['Leads', teamData.leads, data.teamTargets?.lead_target || 0,
     teamData.leads - (data.teamTargets?.lead_target || 0),
     ((teamData.leads / (data.teamTargets?.lead_target || 1)) * 100).toFixed(1) + '%'],
  ]

  summaryRows.forEach(row => {
    const excelRow = sheet.addRow(row)
    excelRow.getCell(2).numFmt = '#,##0'
    excelRow.getCell(3).numFmt = '#,##0'
    excelRow.getCell(4).numFmt = '#,##0'
  })

  // BDE Performance Section
  sheet.addRow([])
  sheet.addRow(['BDE PERFORMANCE']).font = { bold: true, size: 12 }
  sheet.addRow(['BDE Name', 'Conversions', 'Revenue', 'Leads', 'Conversion Rate', 'Avg Deal Size'])

  // Group by BDE
  const bdePerformance = groupByBDE(data.bdeDaily)

  Object.values(bdePerformance).forEach((bde: unknown) => {
    const conversionRate = bde.leads > 0 ? (bde.conversions / bde.leads) * 100 : 0
    const avgDealSize = bde.conversions > 0 ? bde.revenue / bde.conversions : 0

    const row = sheet.addRow([
      bde.name,
      bde.conversions,
      formatCurrency(bde.revenue),
      bde.leads,
      conversionRate.toFixed(2) + '%',
      formatCurrency(avgDealSize),
    ])

    row.getCell(2).numFmt = '#,##0'
    row.getCell(4).numFmt = '#,##0'
  })

  // Style header row
  const headerRow = sheet.getRow(4)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // Auto-fit columns
  sheet.columns.forEach(column => {
    let maxLength = 0
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value ? cell.value.toString() : ''
      maxLength = Math.max(maxLength, cellValue.length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 12), 50)
  })

  // Freeze header
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
}

async function addBDEDetailsSheet(workbook: ExcelJS.Workbook, data: unknown) {
  const sheet = workbook.addWorksheet('BDE Details', {
    properties: { tabColor: { argb: 'FF10B981' } },
  })

  // Title
  sheet.mergeCells('A1:J1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `BDE Daily Performance - ${getMonthName(data.month)} ${data.year}`
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF10B981' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  // Headers
  sheet.addRow([])
  const headerRow = sheet.addRow([
    'Date', 'BDE Name', 'Leads', 'Calls', 'Meetings', 'Conversions',
    'Revenue', 'Conversion Rate', 'Avg Deal Size', 'Activity Score'
  ])

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF10B981' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // Data rows
  data.bdeDaily.forEach((record: Record<string, unknown>) => {
    const conversionRate = record.leads > 0 ? (record.conversions / record.leads) * 100 : 0
    const avgDealSize = record.conversions > 0 ? record.revenue / record.conversions : 0

    const row = sheet.addRow([
      new Date(record.date).toLocaleDateString('en-IN'),
      record.bde?.full_name || 'Unknown',
      record.leads,
      record.calls_made,
      record.meetings_scheduled,
      record.conversions,
      formatCurrency(record.revenue),
      conversionRate.toFixed(2) + '%',
      formatCurrency(avgDealSize),
      record.activity_score || 0,
    ])

    // Number formatting
    row.getCell(3).numFmt = '#,##0'
    row.getCell(4).numFmt = '#,##0'
    row.getCell(5).numFmt = '#,##0'
    row.getCell(6).numFmt = '#,##0'
    row.getCell(10).numFmt = '#,##0'
  })

  // Auto-fit columns
  sheet.columns.forEach(column => {
    let maxLength = 0
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value ? cell.value.toString() : ''
      maxLength = Math.max(maxLength, cellValue.length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 12), 50)
  })

  // Freeze header
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
}

async function addLeaderboardSheet(workbook: ExcelJS.Workbook, data: unknown) {
  const sheet = workbook.addWorksheet('Leaderboard', {
    properties: { tabColor: { argb: 'FFF59E0B' } },
  })

  // Title
  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `BDE Leaderboard - ${getMonthName(data.month)} ${data.year}`
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFF59E0B' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 30

  // Headers
  sheet.addRow([])
  const headerRow = sheet.addRow(['Rank', 'BDE Name', 'Conversions', 'Revenue', 'Performance Score', 'Status'])

  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF59E0B' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // Calculate rankings
  const bdePerformance = groupByBDE(data.bdeDaily)
  const rankings = Object.values(bdePerformance)
    .map((bde: unknown) => ({
      ...bde,
      score: (bde.conversions * 10) + (bde.revenue / 100000),
    }))
    .sort((a: unknown, b: unknown) => b.score - a.score)

  rankings.forEach((bde: unknown, index: number) => {
    const targetData = data.bdeTargets?.find((t: unknown) => t.user_id === bde.id)
    const conversionTarget = targetData?.conversion_target || 0
    const status = bde.conversions >= conversionTarget ? 'On Track' :
                   bde.conversions >= conversionTarget * 0.8 ? 'At Risk' : 'Behind'

    const row = sheet.addRow([
      index + 1,
      bde.name,
      bde.conversions,
      formatCurrency(bde.revenue),
      bde.score.toFixed(2),
      status,
    ])

    // Conditional formatting for rank
    if (index === 0) {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD700' }, // Gold
      }
    } else if (index === 1) {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC0C0C0' }, // Silver
      }
    } else if (index === 2) {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCD7F32' }, // Bronze
      }
    }

    // Conditional formatting for status
    if (status === 'On Track') {
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' },
      }
      row.getCell(6).font = { color: { argb: 'FFFFFFFF' } }
    } else if (status === 'At Risk') {
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' },
      }
      row.getCell(6).font = { color: { argb: 'FFFFFFFF' } }
    } else {
      row.getCell(6).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' },
      }
      row.getCell(6).font = { color: { argb: 'FFFFFFFF' } }
    }

    row.getCell(3).numFmt = '#,##0'
  })

  // Auto-fit columns
  sheet.columns.forEach(column => {
    let maxLength = 0
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value ? cell.value.toString() : ''
      maxLength = Math.max(maxLength, cellValue.length)
    })
    column.width = Math.min(Math.max(maxLength + 2, 12), 50)
  })

  // Freeze header
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
}

// ============================================================================
// PDF GENERATION
// ============================================================================

async function generatePDFFile(data: unknown, month: number, year: number, tab: string): Promise<Buffer> {
  // Simple PDF generation - in production, use a proper PDF library like jsPDF or pdfkit
  // For now, return a simple text-based PDF
  const content = `BDM Team Performance Report
${getMonthName(month)} ${year}

TEAM SUMMARY
============
${JSON.stringify(calculateTeamTotals(data.bdeDaily, data.teamTargets), null, 2)}

BDE PERFORMANCE
===============
${JSON.stringify(groupByBDE(data.bdeDaily), null, 2)}

Generated on: ${new Date().toLocaleString('en-IN')}
`

  return Buffer.from(content, 'utf-8')
}

// ============================================================================
// CSV GENERATION
// ============================================================================

async function generateCSVFile(data: unknown, month: number, year: number, tab: string): Promise<Buffer> {
  const rows: string[] = []

  // Header
  rows.push(`BDM Team Performance - ${getMonthName(month)} ${year}`)
  rows.push('')

  // Team Summary
  rows.push('TEAM SUMMARY')
  rows.push('Metric,Current,Target,Gap,Achievement %')

  const teamData = calculateTeamTotals(data.bdeDaily, data.teamTargets)
  rows.push(`Conversions,${teamData.conversions},${data.teamTargets?.conversion_target || 0},${teamData.conversions - (data.teamTargets?.conversion_target || 0)},${((teamData.conversions / (data.teamTargets?.conversion_target || 1)) * 100).toFixed(1)}%`)
  rows.push(`Revenue,${teamData.revenue},${data.teamTargets?.revenue_target || 0},${teamData.revenue - (data.teamTargets?.revenue_target || 0)},${((teamData.revenue / (data.teamTargets?.revenue_target || 1)) * 100).toFixed(1)}%`)
  rows.push(`Leads,${teamData.leads},${data.teamTargets?.lead_target || 0},${teamData.leads - (data.teamTargets?.lead_target || 0)},${((teamData.leads / (data.teamTargets?.lead_target || 1)) * 100).toFixed(1)}%`)
  rows.push('')

  // BDE Performance
  rows.push('BDE PERFORMANCE')
  rows.push('BDE Name,Conversions,Revenue,Leads,Conversion Rate,Avg Deal Size')

  const bdePerformance = groupByBDE(data.bdeDaily)
  Object.values(bdePerformance).forEach((bde: unknown) => {
    const conversionRate = bde.leads > 0 ? (bde.conversions / bde.leads) * 100 : 0
    const avgDealSize = bde.conversions > 0 ? bde.revenue / bde.conversions : 0
    rows.push(`${bde.name},${bde.conversions},${bde.revenue},${bde.leads},${conversionRate.toFixed(2)}%,${avgDealSize.toFixed(2)}`)
  })

  rows.push('')
  rows.push(`Generated on: ${new Date().toLocaleString('en-IN')}`)

  return Buffer.from(rows.join('\n'), 'utf-8')
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateTeamTotals(bdeDaily: unknown[], teamTargets: unknown) {
  const totals = {
    conversions: 0,
    revenue: 0,
    leads: 0,
  }

  bdeDaily.forEach(record => {
    totals.conversions += record.conversions || 0
    totals.revenue += record.revenue || 0
    totals.leads += record.leads || 0
  })

  return totals
}

function groupByBDE(bdeDaily: unknown[]) {
  const grouped: Record<string, unknown> = {}

  bdeDaily.forEach(record => {
    const bdeId = record.user_id
    const bdeName = record.bde?.full_name || 'Unknown'

    if (!grouped[bdeId]) {
      grouped[bdeId] = {
        id: bdeId,
        name: bdeName,
        conversions: 0,
        revenue: 0,
        leads: 0,
        calls: 0,
        meetings: 0,
      }
    }

    grouped[bdeId].conversions += record.conversions || 0
    grouped[bdeId].revenue += record.revenue || 0
    grouped[bdeId].leads += record.leads || 0
    grouped[bdeId].calls += record.calls_made || 0
    grouped[bdeId].meetings += record.meetings_scheduled || 0
  })

  return grouped
}

function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return monthNames[month] || 'Unknown'
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}
