import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

interface AnalyticsData {
  overview: unknown; partner_distribution: unknown; current_month_metrics: unknown; top_partners: unknown[]
  recent_recruitments: unknown[]
  target_achievement: unknown; last_updated: string
}

interface HistoryData {
  history: unknown[]
  partnerBreakdown: unknown[]
  totalPartnersRecruited: number
  activePartnersCount: number
}

/**
 * Export Analytics Report to Excel
 */
export function exportAnalyticsToExcel(data: AnalyticsData, userName: string) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  // Sheet 1: Overview
  const overviewData = [
    ['MY PERFORMANCE REPORT - ANALYTICS'],
    ['Channel Partner Executive:', userName],
    ['Generated:', new Date().toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })],
    [],
    ['PERFORMANCE OVERVIEW'],
    ['Metric', 'Value'],
    ['Total Active Partners', data.overview.total_active_partners || 0],
    ['Partners Recruited This Month', data.overview.partners_recruited_this_month || 0],
    ['Total Leads Generated', data.overview.total_leads_generated || 0],
    ['Total Business Volume', `₹${(data.overview.total_business_volume || 0).toLocaleString('en-IN')}`],
    ['Estimated Commission', `₹${(data.overview.estimated_commission || 0).toLocaleString('en-IN')}`],
    ['Avg Partner Productivity', (data.overview.avg_partner_productivity || 0).toFixed(2)],
    [],
    ['PARTNER TYPE DISTRIBUTION'],
    ['Type', 'Count', 'Percentage'],
    [
      'Business Associate (BA)',
      data.partner_distribution.ba_count || 0,
      `${((data.partner_distribution.ba_count / data.overview.total_active_partners) * 100 || 0).toFixed(1)}%`
    ],
    [
      'Business Partner (BP)',
      data.partner_distribution.bp_count || 0,
      `${((data.partner_distribution.bp_count / data.overview.total_active_partners) * 100 || 0).toFixed(1)}%`
    ],
    [
      'Channel Partner (CP)',
      data.partner_distribution.cp_count || 0,
      `${((data.partner_distribution.cp_count / data.overview.total_active_partners) * 100 || 0).toFixed(1)}%`
    ]
  ]

  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)

  // Set column widths
  overviewSheet['!cols'] = [
    { wch: 35 },
    { wch: 20 },
    { wch: 15 }
  ]

  XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview')

  // Sheet 2: Current Month Performance
  const metricsData = [
    ['CURRENT MONTH PERFORMANCE'],
    [],
    ['Metric', 'Count', 'Rate'],
    [
      'Leads Generated',
      data.current_month_metrics.leads_generated || 0,
      '-'
    ],
    [
      'Leads Converted',
      data.current_month_metrics.leads_converted || 0,
      `${(data.current_month_metrics.conversion_rate || 0).toFixed(1)}%`
    ],
    [
      'Leads Sanctioned',
      data.current_month_metrics.leads_sanctioned || 0,
      `${(data.current_month_metrics.sanction_rate || 0).toFixed(1)}%`
    ],
    [
      'Leads Disbursed',
      data.current_month_metrics.leads_disbursed || 0,
      `${(data.current_month_metrics.disbursement_rate || 0).toFixed(1)}%`
    ]
  ]

  const metricsSheet = XLSX.utils.aoa_to_sheet(metricsData)
  metricsSheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 15 }
  ]

  XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Current Month')

  // Sheet 3: Top Performing Partners
  const topPartnersData = [
    ['TOP 5 PERFORMING PARTNERS'],
    [],
    ['Rank', 'Partner Name', 'Partner Code', 'Type', 'Total Leads', 'Sanctioned', 'Conversion %']
  ]

  data.top_partners.forEach((partner, index) => {
    topPartnersData.push([
      index + 1,
      partner.partner_name,
      partner.partner_code,
      partner.partner_type,
      partner.total_leads,
      partner.leads_sanctioned,
      `${partner.conversion_rate.toFixed(1)}%`
    ])
  })

  const topPartnersSheet = XLSX.utils.aoa_to_sheet(topPartnersData)
  topPartnersSheet['!cols'] = [
    { wch: 8 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 }
  ]

  XLSX.utils.book_append_sheet(workbook, topPartnersSheet, 'Top Partners')

  // Sheet 4: Recent Recruitments
  const recruitmentData = [
    ['RECENT RECRUITMENTS'],
    [],
    ['Partner Name', 'Partner Code', 'Type', 'Joining Date', 'Days Active', 'Total Leads']
  ]

  data.recent_recruitments.forEach((partner) => {
    recruitmentData.push([
      partner.partner_name,
      partner.partner_code,
      partner.partner_type,
      partner.joining_date,
      partner.days_active,
      partner.total_leads || 0
    ])
  })

  const recruitmentSheet = XLSX.utils.aoa_to_sheet(recruitmentData)
  recruitmentSheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 }
  ]

  XLSX.utils.book_append_sheet(workbook, recruitmentSheet, 'Recent Recruitments')

  // Sheet 5: Target Achievement
  const targetData = [
    ['TARGET ACHIEVEMENT'],
    [],
    ['Category', 'Current', 'Target', 'Achievement %']
  ]

  const targetCategories = [
    {
      name: 'Partners Recruited',
      current: data.target_achievement.partners_recruited?.current || 0,
      target: data.target_achievement.partners_recruited?.target || 0,
      achievement: data.target_achievement.partners_recruited?.achievement_percentage || 0
    },
    {
      name: 'Leads Generated',
      current: data.target_achievement.leads_generated?.current || 0,
      target: data.target_achievement.leads_generated?.target || 0,
      achievement: data.target_achievement.leads_generated?.achievement_percentage || 0
    },
    {
      name: 'Business Volume',
      current: `₹${(data.target_achievement.business_volume?.current || 0).toLocaleString('en-IN')}`,
      target: `₹${(data.target_achievement.business_volume?.target || 0).toLocaleString('en-IN')}`,
      achievement: data.target_achievement.business_volume?.achievement_percentage || 0
    },
    {
      name: 'Commission',
      current: `₹${(data.target_achievement.commission?.current || 0).toLocaleString('en-IN')}`,
      target: `₹${(data.target_achievement.commission?.target || 0).toLocaleString('en-IN')}`,
      achievement: data.target_achievement.commission?.achievement_percentage || 0
    }
  ]

  targetCategories.forEach(category => {
    targetData.push([
      category.name,
      category.current,
      category.target,
      `${category.achievement}%`
    ])
  })

  const targetSheet = XLSX.utils.aoa_to_sheet(targetData)
  targetSheet['!cols'] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 15 }
  ]

  XLSX.utils.book_append_sheet(workbook, targetSheet, 'Target Achievement')

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const fileName = `CPE_Performance_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`
  saveAs(blob, fileName)
}

/**
 * Export History Report to Excel
 */
export function exportHistoryToExcel(data: HistoryData, userName: string) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new()

  // Sheet 1: Summary
  const summaryData = [
    ['MY PERFORMANCE REPORT - HISTORY'],
    ['Channel Partner Executive:', userName],
    ['Generated:', new Date().toLocaleString('en-IN')],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Partners Recruited', data.totalPartnersRecruited || 0],
    ['Active Partners', data.activePartnersCount || 0],
    ['Historical Months Tracked', data.history.length || 0]
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 20 }
  ]

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  // Sheet 2: Monthly History
  const historyData = [
    ['MONTHLY PERFORMANCE HISTORY'],
    [],
    ['Month', 'Partners Recruited', 'BA', 'BP', 'CP', 'Total Leads', 'Sanctioned', 'Grade', 'Score']
  ]

  data.history.slice(0, 12).forEach(month => {
    historyData.push([
      month.period,
      month.partnersRecruited || 0,
      month.partnersByType?.BA || 0,
      month.partnersByType?.BP || 0,
      month.partnersByType?.CP || 0,
      month.metrics?.totalPartnerLeadsGenerated || 0,
      month.metrics?.leadsSanctioned || 0,
      month.grade || 'N/A',
      month.overallScore || 0
    ])
  })

  const historySheet = XLSX.utils.aoa_to_sheet(historyData)
  historySheet['!cols'] = [
    { wch: 15 },
    { wch: 18 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 }
  ]

  XLSX.utils.book_append_sheet(workbook, historySheet, 'Monthly History')

  // Sheet 3: Partner Breakdown
  const partnerData = [
    ['PARTNER BREAKDOWN'],
    [],
    [
      'Partner Name',
      'Partner Code',
      'Type',
      'City',
      'State',
      'Joining Date',
      'Days Active',
      'Total Leads',
      'Sanctioned',
      'Avg Leads/Day',
      'Status'
    ]
  ]

  data.partnerBreakdown.forEach(partner => {
    partnerData.push([
      partner.partner_name,
      partner.partner_code,
      partner.partner_type,
      partner.city || '-',
      partner.state || '-',
      partner.joining_date || '-',
      partner.days_active,
      partner.total_leads,
      partner.leads_sanctioned,
      partner.avg_leads_per_day,
      partner.is_active ? 'Active' : 'Inactive'
    ])
  })

  const partnerSheet = XLSX.utils.aoa_to_sheet(partnerData)
  partnerSheet['!cols'] = [
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 10 }
  ]

  XLSX.utils.book_append_sheet(workbook, partnerSheet, 'Partner Breakdown')

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const fileName = `CPE_Performance_History_${new Date().toISOString().split('T')[0]}.xlsx`
  saveAs(blob, fileName)
}
