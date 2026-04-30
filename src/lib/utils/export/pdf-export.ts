import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AnalyticsData {
  overview: unknown  partner_distribution: unknown  current_month_metrics: unknown  top_partners: unknown[]
  recent_recruitments: unknown[]
  target_achievement: unknown  last_updated: string
}

interface HistoryData {
  history: unknown[]
  partnerBreakdown: unknown[]
  totalPartnersRecruited: number
  activePartnersCount: number
}

/**
 * Export Analytics Report to PDF
 */
export function exportAnalyticsToPDF(data: AnalyticsData, userName: string) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(20)
  doc.setTextColor(0, 0, 0)
  doc.text('My Performance Report - Analytics', pageWidth / 2, 20, { align: 'center' })

  // Subtitle
  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text(`Channel Partner Executive: ${userName}`, pageWidth / 2, 30, { align: 'center' })
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, pageWidth / 2, 37, { align: 'center' })

  let yPosition = 50

  // Overview Section
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('Performance Overview', 14, yPosition)
  yPosition += 10

  const overviewData = [
    ['Metric', 'Value'],
    ['Total Active Partners', data.overview.total_active_partners || 0],
    ['Partners Recruited This Month', data.overview.partners_recruited_this_month || 0],
    ['Total Leads Generated', data.overview.total_leads_generated || 0],
    ['Total Business Volume', `₹${(data.overview.total_business_volume || 0).toLocaleString('en-IN')}`],
    ['Estimated Commission', `₹${(data.overview.estimated_commission || 0).toLocaleString('en-IN')}`],
    ['Avg Partner Productivity', (data.overview.avg_partner_productivity || 0).toFixed(2)]
  ]

  autoTable(doc, {
    startY: yPosition,
    head: [overviewData[0]],
    body: overviewData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 }
  })

  yPosition = (doc as unknown).lastAutoTable.finalY + 15

  // Partner Distribution
  doc.setFontSize(14)
  doc.text('Partner Type Distribution', 14, yPosition)
  yPosition += 10

  const distributionData = [
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

  autoTable(doc, {
    startY: yPosition,
    head: [distributionData[0]],
    body: distributionData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: 14, right: 14 }
  })

  yPosition = (doc as unknown).lastAutoTable.finalY + 15

  // Check if we need a new page
  if (yPosition > 250) {
    doc.addPage()
    yPosition = 20
  }

  // Current Month Metrics
  doc.setFontSize(14)
  doc.text('Current Month Performance', 14, yPosition)
  yPosition += 10

  const metricsData = [
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

  autoTable(doc, {
    startY: yPosition,
    head: [metricsData[0]],
    body: metricsData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [168, 85, 247] },
    margin: { left: 14, right: 14 }
  })

  yPosition = (doc as unknown).lastAutoTable.finalY + 15

  // New page for Top Partners
  doc.addPage()
  yPosition = 20

  // Top Performing Partners
  doc.setFontSize(14)
  doc.text('Top 5 Performing Partners', 14, yPosition)
  yPosition += 10

  const topPartnersData = [
    ['Rank', 'Partner', 'Type', 'Total Leads', 'Sanctioned', 'Conversion %']
  ]

  data.top_partners.forEach((partner, index) => {
    topPartnersData.push([
      (index + 1).toString(),
      `${partner.partner_name}\n(${partner.partner_code})`,
      partner.partner_type,
      partner.total_leads.toString(),
      partner.leads_sanctioned.toString(),
      `${partner.conversion_rate.toFixed(1)}%`
    ])
  })

  autoTable(doc, {
    startY: yPosition,
    head: [topPartnersData[0]],
    body: topPartnersData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 }
  })

  // Target Achievement
  yPosition = (doc as unknown).lastAutoTable.finalY + 15

  doc.setFontSize(14)
  doc.text('Target Achievement', 14, yPosition)
  yPosition += 10

  const targetData = [
    ['Category', 'Current', 'Target', 'Achievement %'],
    [
      'Partners Recruited',
      data.target_achievement.partners_recruited?.current || 0,
      data.target_achievement.partners_recruited?.target || 0,
      `${data.target_achievement.partners_recruited?.achievement_percentage || 0}%`
    ],
    [
      'Leads Generated',
      data.target_achievement.leads_generated?.current || 0,
      data.target_achievement.leads_generated?.target || 0,
      `${data.target_achievement.leads_generated?.achievement_percentage || 0}%`
    ],
    [
      'Business Volume',
      `₹${(data.target_achievement.business_volume?.current || 0).toLocaleString('en-IN')}`,
      `₹${(data.target_achievement.business_volume?.target || 0).toLocaleString('en-IN')}`,
      `${data.target_achievement.business_volume?.achievement_percentage || 0}%`
    ],
    [
      'Commission',
      `₹${(data.target_achievement.commission?.current || 0).toLocaleString('en-IN')}`,
      `₹${(data.target_achievement.commission?.target || 0).toLocaleString('en-IN')}`,
      `${data.target_achievement.commission?.achievement_percentage || 0}%`
    ]
  ]

  autoTable(doc, {
    startY: yPosition,
    head: [targetData[0]],
    body: targetData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 }
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount} | LOANZ360 - My Performance Report`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save
  const fileName = `CPE_Performance_Analytics_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

/**
 * Export History Report to PDF
 */
export function exportHistoryToPDF(data: HistoryData, userName: string) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(20)
  doc.text('My Performance Report - History', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(12)
  doc.setTextColor(100, 100, 100)
  doc.text(`Channel Partner Executive: ${userName}`, pageWidth / 2, 30, { align: 'center' })
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 37, { align: 'center' })

  let yPosition = 50

  // Summary
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('Summary', 14, yPosition)
  yPosition += 10

  const summaryData = [
    ['Metric', 'Value'],
    ['Total Partners Recruited', data.totalPartnersRecruited || 0],
    ['Active Partners', data.activePartnersCount || 0],
    ['Historical Months Tracked', data.history.length || 0]
  ]

  autoTable(doc, {
    startY: yPosition,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 }
  })

  yPosition = (doc as unknown).lastAutoTable.finalY + 15

  // Monthly History
  doc.setFontSize(14)
  doc.text('Monthly Performance History', 14, yPosition)
  yPosition += 10

  const historyHeaders = ['Month', 'Partners', 'Leads', 'Sanctioned', 'Grade', 'Score']
  const historyBody = data.history.slice(0, 12).map(month => [
    month.period,
    month.partnersRecruited || 0,
    month.metrics?.totalPartnerLeadsGenerated || 0,
    month.metrics?.leadsSanctioned || 0,
    month.grade || 'N/A',
    month.overallScore || 0
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [historyHeaders],
    body: historyBody,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 }
  })

  // New page for Partner Breakdown
  doc.addPage()
  yPosition = 20

  doc.setFontSize(14)
  doc.text('Partner Breakdown', 14, yPosition)
  yPosition += 10

  const partnerHeaders = ['Partner', 'Type', 'Days Active', 'Leads', 'Sanctioned', 'Status']
  const partnerBody = data.partnerBreakdown.slice(0, 20).map(partner => [
    `${partner.partner_name}\n(${partner.partner_code})`,
    partner.partner_type,
    partner.days_active,
    partner.total_leads,
    partner.leads_sanctioned,
    partner.is_active ? 'Active' : 'Inactive'
  ])

  autoTable(doc, {
    startY: yPosition,
    head: [partnerHeaders],
    body: partnerBody,
    theme: 'grid',
    headStyles: { fillColor: [168, 85, 247] },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8 }
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount} | LOANZ360 - My Performance History`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save
  const fileName = `CPE_Performance_History_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}
