import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

/**
 * Export utilities for PDF and Excel generation
 * Used across the incentive management system
 */

// ==================== INCENTIVE ANALYTICS PDF EXPORT ====================

interface AnalyticsExportData {
  summary: {
    total_incentives: number
    total_eligible_users: number
    total_participating_users: number
    total_allocated_amount: number
    total_earned_amount: number
    total_claimed_amount: number
    total_paid_amount: number
    avg_participation_rate: number
    avg_achievement_rate: number
  }
  data: Array<{
    incentive: {
      incentive_title: string
      incentive_type: string
      start_date: string
      end_date: string
    }
    total_eligible_users: number
    total_participating_users: number
    users_achieved: number
    users_partially_achieved: number
    users_not_achieved: number
    participation_rate: string
    achievement_rate: string
    total_earned_amount: string
    total_claimed_amount: string
    total_paid_amount: string
  }>
}

export function exportAnalyticsToPDF(data: AnalyticsExportData): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(249, 115, 22) // Orange
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('Incentive Analytics Report', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' })

  // Reset text color
  doc.setTextColor(0, 0, 0)

  // Summary Section
  let yPos = 50
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', 14, yPos)
  yPos += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const summaryData = [
    ['Total Active Incentives', data.summary.total_incentives.toString()],
    ['Total Eligible Employees', data.summary.total_eligible_users.toString()],
    ['Active Participants', data.summary.total_participating_users.toString()],
    ['Average Participation Rate', `${data.summary.avg_participation_rate.toFixed(1)}%`],
    ['Average Achievement Rate', `${data.summary.avg_achievement_rate.toFixed(1)}%`],
    ['Total Allocated Budget', `₹${data.summary.total_allocated_amount.toLocaleString()}`],
    ['Total Earned Amount', `₹${data.summary.total_earned_amount.toLocaleString()}`],
    ['Total Claimed Amount', `₹${data.summary.total_claimed_amount.toLocaleString()}`],
    ['Total Paid Amount', `₹${data.summary.total_paid_amount.toLocaleString()}`],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })

  // Detailed Metrics Table
  yPos = (doc as any).lastAutoTable.finalY + 15

  // Check if we need a new page
  if (yPos > pageHeight - 60) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Detailed Metrics by Incentive', 14, yPos)
  yPos += 5

  const detailedData = data.data.map(item => [
    item.incentive.incentive_title.substring(0, 30) + (item.incentive.incentive_title.length > 30 ? '...' : ''),
    item.total_eligible_users.toString(),
    item.total_participating_users.toString(),
    item.users_achieved.toString(),
    `${parseFloat(item.participation_rate).toFixed(1)}%`,
    `${parseFloat(item.achievement_rate).toFixed(1)}%`,
    `₹${parseFloat(item.total_earned_amount).toLocaleString()}`,
    `₹${parseFloat(item.total_paid_amount).toLocaleString()}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Incentive', 'Eligible', 'Participating', 'Achieved', 'Part. %', 'Achv. %', 'Earned', 'Paid']],
    body: detailedData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 25, halign: 'right' },
    },
  })

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    doc.text(
      'Loanz360 Incentive Management System',
      pageWidth - 14,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  // Save the PDF
  doc.save(`incentive-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
}

// ==================== INCENTIVE ANALYTICS EXCEL EXPORT ====================

export function exportAnalyticsToExcel(data: AnalyticsExportData): void {
  // Create workbook
  const wb = XLSX.utils.book_new()

  // Summary Sheet
  const summaryData = [
    ['Incentive Analytics Report'],
    [`Generated on: ${new Date().toLocaleDateString()}`],
    [],
    ['Executive Summary'],
    ['Metric', 'Value'],
    ['Total Active Incentives', data.summary.total_incentives],
    ['Total Eligible Employees', data.summary.total_eligible_users],
    ['Active Participants', data.summary.total_participating_users],
    ['Average Participation Rate', `${data.summary.avg_participation_rate.toFixed(1)}%`],
    ['Average Achievement Rate', `${data.summary.avg_achievement_rate.toFixed(1)}%`],
    ['Total Allocated Budget', data.summary.total_allocated_amount],
    ['Total Earned Amount', data.summary.total_earned_amount],
    ['Total Claimed Amount', data.summary.total_claimed_amount],
    ['Total Paid Amount', data.summary.total_paid_amount],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)

  // Style header
  summarySheet['A1'].s = {
    font: { bold: true, sz: 16 },
    fill: { fgColor: { rgb: 'F97316' } },
    alignment: { horizontal: 'center' },
  }

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Detailed Metrics Sheet
  const detailedHeaders = [
    'Incentive Title',
    'Type',
    'Start Date',
    'End Date',
    'Eligible Users',
    'Participating Users',
    'Users Achieved',
    'Users Partially Achieved',
    'Users Not Achieved',
    'Participation Rate (%)',
    'Achievement Rate (%)',
    'Total Earned Amount',
    'Total Claimed Amount',
    'Total Paid Amount',
  ]

  const detailedData = data.data.map(item => [
    item.incentive.incentive_title,
    item.incentive.incentive_type,
    new Date(item.incentive.start_date).toLocaleDateString(),
    new Date(item.incentive.end_date).toLocaleDateString(),
    item.total_eligible_users,
    item.total_participating_users,
    item.users_achieved,
    item.users_partially_achieved,
    item.users_not_achieved,
    parseFloat(item.participation_rate),
    parseFloat(item.achievement_rate),
    parseFloat(item.total_earned_amount),
    parseFloat(item.total_claimed_amount),
    parseFloat(item.total_paid_amount),
  ])

  const detailedSheet = XLSX.utils.aoa_to_sheet([detailedHeaders, ...detailedData])

  // Set column widths
  detailedSheet['!cols'] = [
    { wch: 40 }, // Incentive Title
    { wch: 15 }, // Type
    { wch: 12 }, // Start Date
    { wch: 12 }, // End Date
    { wch: 12 }, // Eligible
    { wch: 15 }, // Participating
    { wch: 12 }, // Achieved
    { wch: 18 }, // Partially Achieved
    { wch: 15 }, // Not Achieved
    { wch: 15 }, // Participation %
    { wch: 15 }, // Achievement %
    { wch: 18 }, // Earned
    { wch: 18 }, // Claimed
    { wch: 18 }, // Paid
  ]

  XLSX.utils.book_append_sheet(wb, detailedSheet, 'Detailed Metrics')

  // Save the workbook
  XLSX.writeFile(wb, `incentive-analytics-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ==================== CLAIMS MANAGEMENT PDF EXPORT ====================

interface ClaimExportData {
  id: string
  user_name: string
  incentive_title: string
  claimed_amount: number
  claim_status: string
  claim_date: string
  reviewed_at?: string | null
  reviewed_by_name?: string | null
  payment_reference?: string | null
  claim_notes?: string | null
  review_notes?: string | null
}

export function exportClaimsToPDF(claims: ClaimExportData[], filterStatus?: string): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(59, 130, 246) // Blue
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('Incentive Claims Report', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' })

  if (filterStatus) {
    doc.text(`Filter: ${filterStatus.toUpperCase()}`, pageWidth / 2, 35, { align: 'center' })
  }

  // Reset text color
  doc.setTextColor(0, 0, 0)

  // Summary Stats
  let yPos = 50
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 14, yPos)
  yPos += 8

  const totalClaims = claims.length
  const pendingClaims = claims.filter(c => c.claim_status === 'pending').length
  const approvedClaims = claims.filter(c => c.claim_status === 'approved').length
  const rejectedClaims = claims.filter(c => c.claim_status === 'rejected').length
  const paidClaims = claims.filter(c => c.claim_status === 'paid').length
  const totalAmount = claims.reduce((sum, c) => sum + c.claimed_amount, 0)
  const paidAmount = claims.filter(c => c.claim_status === 'paid').reduce((sum, c) => sum + c.claimed_amount, 0)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const summaryData = [
    ['Total Claims', totalClaims.toString()],
    ['Pending', pendingClaims.toString()],
    ['Approved', approvedClaims.toString()],
    ['Rejected', rejectedClaims.toString()],
    ['Paid', paidClaims.toString()],
    ['Total Claimed Amount', `₹${totalAmount.toLocaleString()}`],
    ['Total Paid Amount', `₹${paidAmount.toLocaleString()}`],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })

  // Claims Table
  yPos = (doc as any).lastAutoTable.finalY + 15

  // Check if we need a new page
  if (yPos > pageHeight - 60) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Claims Details', 14, yPos)
  yPos += 5

  const claimsData = claims.map(claim => [
    claim.user_name,
    claim.incentive_title.substring(0, 25) + (claim.incentive_title.length > 25 ? '...' : ''),
    `₹${claim.claimed_amount.toLocaleString()}`,
    claim.claim_status.toUpperCase(),
    new Date(claim.claim_date).toLocaleDateString(),
    claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleDateString() : '-',
    claim.payment_reference || '-',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Employee', 'Incentive', 'Amount', 'Status', 'Claim Date', 'Reviewed', 'Payment Ref']],
    body: claimsData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 35 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 25, halign: 'center' },
    },
  })

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    doc.text(
      'Loanz360 Incentive Management System',
      pageWidth - 14,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  // Save the PDF
  const filename = filterStatus
    ? `incentive-claims-${filterStatus}-${new Date().toISOString().split('T')[0]}.pdf`
    : `incentive-claims-all-${new Date().toISOString().split('T')[0]}.pdf`

  doc.save(filename)
}

// ==================== CLAIMS MANAGEMENT EXCEL EXPORT ====================

export function exportClaimsToExcel(claims: ClaimExportData[], filterStatus?: string): void {
  // Create workbook
  const wb = XLSX.utils.book_new()

  // Summary Sheet
  const totalClaims = claims.length
  const pendingClaims = claims.filter(c => c.claim_status === 'pending').length
  const approvedClaims = claims.filter(c => c.claim_status === 'approved').length
  const rejectedClaims = claims.filter(c => c.claim_status === 'rejected').length
  const paidClaims = claims.filter(c => c.claim_status === 'paid').length
  const totalAmount = claims.reduce((sum, c) => sum + c.claimed_amount, 0)
  const paidAmount = claims.filter(c => c.claim_status === 'paid').reduce((sum, c) => sum + c.claimed_amount, 0)

  const summaryData = [
    ['Incentive Claims Report'],
    [`Generated on: ${new Date().toLocaleDateString()}`],
    filterStatus ? [`Filter: ${filterStatus.toUpperCase()}`] : [],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Total Claims', totalClaims],
    ['Pending', pendingClaims],
    ['Approved', approvedClaims],
    ['Rejected', rejectedClaims],
    ['Paid', paidClaims],
    ['Total Claimed Amount', totalAmount],
    ['Total Paid Amount', paidAmount],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Claims Details Sheet
  const headers = [
    'Claim ID',
    'Employee Name',
    'Incentive Title',
    'Claimed Amount',
    'Status',
    'Claim Date',
    'Reviewed Date',
    'Reviewed By',
    'Payment Reference',
    'Claim Notes',
    'Review Notes',
  ]

  const claimsData = claims.map(claim => [
    claim.id,
    claim.user_name,
    claim.incentive_title,
    claim.claimed_amount,
    claim.claim_status.toUpperCase(),
    new Date(claim.claim_date).toLocaleDateString(),
    claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleDateString() : '',
    claim.reviewed_by_name || '',
    claim.payment_reference || '',
    claim.claim_notes || '',
    claim.review_notes || '',
  ])

  const claimsSheet = XLSX.utils.aoa_to_sheet([headers, ...claimsData])

  // Set column widths
  claimsSheet['!cols'] = [
    { wch: 36 }, // Claim ID
    { wch: 25 }, // Employee
    { wch: 35 }, // Incentive
    { wch: 15 }, // Amount
    { wch: 12 }, // Status
    { wch: 15 }, // Claim Date
    { wch: 15 }, // Reviewed Date
    { wch: 25 }, // Reviewed By
    { wch: 20 }, // Payment Ref
    { wch: 30 }, // Claim Notes
    { wch: 30 }, // Review Notes
  ]

  XLSX.utils.book_append_sheet(wb, claimsSheet, 'Claims Details')

  // Save the workbook
  const filename = filterStatus
    ? `incentive-claims-${filterStatus}-${new Date().toISOString().split('T')[0]}.xlsx`
    : `incentive-claims-all-${new Date().toISOString().split('T')[0]}.xlsx`

  XLSX.writeFile(wb, filename)
}

// ==================== COMMISSION HISTORY EXPORT ====================

export interface CommissionExportData {
  lead_id: string
  customer_name: string
  customer_phone: string
  loan_type: string
  bank_name: string | null
  location: string | null
  required_loan_amount: number
  commission_percentage: number | null
  commission_amount: number | null
  commission_status: string
  commission_calculated_at: string | null
  commission_paid_at: string | null
  payout_batch_id: string | null
}

export function exportCommissionHistoryToExcel(data: CommissionExportData[]): void {
  const wb = XLSX.utils.book_new()

  // Summary Sheet
  const totalCommission = data.reduce((sum, item) => sum + (item.commission_amount || 0), 0)
  const calculatedCount = data.filter(item => item.commission_status === 'CALCULATED').length
  const paidCount = data.filter(item => item.commission_status === 'PAID').length
  const paidAmount = data
    .filter(item => item.commission_status === 'PAID')
    .reduce((sum, item) => sum + (item.commission_amount || 0), 0)

  const summaryData = [
    ['Commission History Report'],
    [`Generated on: ${new Date().toLocaleDateString()}`],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Total Records', data.length],
    ['Calculated', calculatedCount],
    ['Paid', paidCount],
    ['Total Commission Amount', totalCommission],
    ['Total Paid Amount', paidAmount],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Details Sheet
  const headers = [
    'Lead ID',
    'Customer Name',
    'Customer Phone',
    'Loan Type',
    'Bank',
    'Location',
    'Loan Amount (₹)',
    'Commission %',
    'Commission Amount (₹)',
    'Status',
    'Calculated Date',
    'Paid Date',
    'Batch ID',
  ]

  const detailsData = data.map(item => [
    item.lead_id,
    item.customer_name,
    item.customer_phone,
    item.loan_type.replace(/_/g, ' '),
    item.bank_name || 'N/A',
    item.location || 'N/A',
    item.required_loan_amount,
    item.commission_percentage || 0,
    item.commission_amount || 0,
    item.commission_status,
    item.commission_calculated_at ? new Date(item.commission_calculated_at).toLocaleDateString() : 'N/A',
    item.commission_paid_at ? new Date(item.commission_paid_at).toLocaleDateString() : 'N/A',
    item.payout_batch_id || 'N/A',
  ])

  const detailsSheet = XLSX.utils.aoa_to_sheet([headers, ...detailsData])

  // Set column widths
  detailsSheet['!cols'] = [
    { wch: 20 }, // Lead ID
    { wch: 20 }, // Customer Name
    { wch: 15 }, // Phone
    { wch: 18 }, // Loan Type
    { wch: 20 }, // Bank
    { wch: 15 }, // Location
    { wch: 15 }, // Loan Amount
    { wch: 12 }, // Commission %
    { wch: 18 }, // Commission Amount
    { wch: 15 }, // Status
    { wch: 15 }, // Calculated Date
    { wch: 15 }, // Paid Date
    { wch: 25 }, // Batch ID
  ]

  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Commission Details')

  XLSX.writeFile(wb, `commission-history-${new Date().toISOString().split('T')[0]}.xlsx`)
}

export function exportCommissionHistoryToCSV(data: CommissionExportData[]): void {
  const headers = [
    'Lead ID',
    'Customer Name',
    'Customer Phone',
    'Loan Type',
    'Bank',
    'Location',
    'Loan Amount',
    'Commission %',
    'Commission Amount',
    'Status',
    'Calculated Date',
    'Paid Date',
    'Batch ID',
  ]

  const rows = data.map(item => [
    item.lead_id,
    item.customer_name,
    item.customer_phone,
    item.loan_type.replace(/_/g, ' '),
    item.bank_name || 'N/A',
    item.location || 'N/A',
    item.required_loan_amount,
    item.commission_percentage || 0,
    item.commission_amount || 0,
    item.commission_status,
    item.commission_calculated_at ? new Date(item.commission_calculated_at).toLocaleDateString() : 'N/A',
    item.commission_paid_at ? new Date(item.commission_paid_at).toLocaleDateString() : 'N/A',
    item.payout_batch_id || 'N/A',
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `commission-history-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// ==================== PAYOUT BATCH EXPORT ====================

export interface PayoutBatchExportData {
  batch_number: string
  partner_type: string
  total_leads: number
  total_amount: number
  status: string
  created_at: string
  approved_at?: string | null
  paid_at?: string | null
  payment_reference?: string | null
  created_by_name?: string
  approved_by_name?: string | null
}

export function exportPayoutBatchesToPDF(batches: PayoutBatchExportData[]): void {
  const doc = new jsPDF('l', 'mm', 'a4') // Landscape
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(249, 115, 22) // Orange
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('Payout Batches Report', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 30, { align: 'center' })

  // Reset text color
  doc.setTextColor(0, 0, 0)

  // Summary Stats
  let yPos = 50
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 15, yPos)
  yPos += 8

  const totalBatches = batches.length
  const pendingBatches = batches.filter(b => b.status === 'PENDING').length
  const approvedBatches = batches.filter(b => b.status === 'APPROVED').length
  const paidBatches = batches.filter(b => b.status === 'PAID').length
  const totalAmount = batches.reduce((sum, b) => sum + b.total_amount, 0)
  const paidAmount = batches.filter(b => b.status === 'PAID').reduce((sum, b) => sum + b.total_amount, 0)
  const totalLeads = batches.reduce((sum, b) => sum + b.total_leads, 0)

  const summaryData = [
    ['Total Batches', totalBatches.toString()],
    ['Total Leads', totalLeads.toString()],
    ['Pending Batches', pendingBatches.toString()],
    ['Approved Batches', approvedBatches.toString()],
    ['Paid Batches', paidBatches.toString()],
    ['Total Amount', `₹${totalAmount.toLocaleString('en-IN')}`],
    ['Paid Amount', `₹${paidAmount.toLocaleString('en-IN')}`],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 15, right: 15 },
  })

  // Batches Table
  yPos = (doc as any).lastAutoTable.finalY + 15

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Batch Details', 15, yPos)
  yPos += 5

  const batchesData = batches.map(batch => [
    batch.batch_number,
    batch.partner_type === 'BUSINESS_ASSOCIATE' ? 'BA' : 'BP',
    batch.total_leads.toString(),
    `₹${batch.total_amount.toLocaleString('en-IN')}`,
    batch.status,
    new Date(batch.created_at).toLocaleDateString('en-IN'),
    batch.approved_at ? new Date(batch.approved_at).toLocaleDateString('en-IN') : '-',
    batch.paid_at ? new Date(batch.paid_at).toLocaleDateString('en-IN') : '-',
    batch.payment_reference || '-',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Batch #', 'Type', 'Leads', 'Amount', 'Status', 'Created', 'Approved', 'Paid', 'Payment Ref']],
    body: batchesData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 15, right: 15 },
  })

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    doc.text(
      'LOANZ360 Payout Management System',
      pageWidth - 15,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  doc.save(`payout-batches-${new Date().toISOString().split('T')[0]}.pdf`)
}

export function exportPayoutBatchesToExcel(batches: PayoutBatchExportData[]): void {
  const wb = XLSX.utils.book_new()

  // Summary Sheet
  const totalBatches = batches.length
  const pendingBatches = batches.filter(b => b.status === 'PENDING').length
  const approvedBatches = batches.filter(b => b.status === 'APPROVED').length
  const paidBatches = batches.filter(b => b.status === 'PAID').length
  const totalAmount = batches.reduce((sum, b) => sum + b.total_amount, 0)
  const paidAmount = batches.filter(b => b.status === 'PAID').reduce((sum, b) => sum + b.total_amount, 0)
  const totalLeads = batches.reduce((sum, b) => sum + b.total_leads, 0)

  const summaryData = [
    ['Payout Batches Report'],
    [`Generated on: ${new Date().toLocaleDateString('en-IN')}`],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Total Batches', totalBatches],
    ['Total Leads', totalLeads],
    ['Pending Batches', pendingBatches],
    ['Approved Batches', approvedBatches],
    ['Paid Batches', paidBatches],
    ['Total Amount', totalAmount],
    ['Paid Amount', paidAmount],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Details Sheet
  const headers = [
    'Batch Number',
    'Partner Type',
    'Total Leads',
    'Total Amount (₹)',
    'Status',
    'Created Date',
    'Created By',
    'Approved Date',
    'Approved By',
    'Paid Date',
    'Payment Reference',
  ]

  const detailsData = batches.map(batch => [
    batch.batch_number,
    batch.partner_type,
    batch.total_leads,
    batch.total_amount,
    batch.status,
    new Date(batch.created_at).toLocaleDateString('en-IN'),
    batch.created_by_name || 'System',
    batch.approved_at ? new Date(batch.approved_at).toLocaleDateString('en-IN') : '',
    batch.approved_by_name || '',
    batch.paid_at ? new Date(batch.paid_at).toLocaleDateString('en-IN') : '',
    batch.payment_reference || '',
  ])

  const detailsSheet = XLSX.utils.aoa_to_sheet([headers, ...detailsData])

  detailsSheet['!cols'] = [
    { wch: 25 }, // Batch Number
    { wch: 20 }, // Partner Type
    { wch: 12 }, // Total Leads
    { wch: 18 }, // Total Amount
    { wch: 12 }, // Status
    { wch: 15 }, // Created Date
    { wch: 25 }, // Created By
    { wch: 15 }, // Approved Date
    { wch: 25 }, // Approved By
    { wch: 15 }, // Paid Date
    { wch: 30 }, // Payment Reference
  ]

  XLSX.utils.book_append_sheet(wb, detailsSheet, 'Batch Details')

  XLSX.writeFile(wb, `payout-batches-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ==================== PAYOUT ANALYTICS EXPORT ====================

export interface PayoutAnalyticsExportData {
  overview: {
    total_commissions_paid: number
    total_commissions_pending: number
    total_amount_paid: number
    total_amount_pending: number
    avg_commission_amount: number
    total_partners: number
  }
  top_performers: Array<{
    partner_name: string
    partner_type: string
    total_commissions: number
    total_amount: number
    avg_amount: number
  }>
  partner_breakdown: Array<{
    partner_type: string
    total_commissions: number
    total_amount: number
    avg_amount: number
  }>
  product_breakdown: Array<{
    loan_product: string
    total_commissions: number
    total_amount: number
    avg_amount: number
  }>
}

export function exportPayoutAnalyticsToPDF(data: PayoutAnalyticsExportData): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(249, 115, 22)
  doc.rect(0, 0, pageWidth, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.text('Payout Analytics Report', pageWidth / 2, 20, { align: 'center' })

  doc.setFontSize(10)
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 30, { align: 'center' })

  doc.setTextColor(0, 0, 0)

  // Overview Summary
  let yPos = 50
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Executive Summary', 14, yPos)
  yPos += 8

  const summaryData = [
    ['Total Commissions Paid', data.overview.total_commissions_paid.toString()],
    ['Total Amount Paid', `₹${data.overview.total_amount_paid.toLocaleString('en-IN')}`],
    ['Total Commissions Pending', data.overview.total_commissions_pending.toString()],
    ['Total Amount Pending', `₹${data.overview.total_amount_pending.toLocaleString('en-IN')}`],
    ['Average Commission', `₹${data.overview.avg_commission_amount.toLocaleString('en-IN')}`],
    ['Total Active Partners', data.overview.total_partners.toString()],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    styles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
  })

  // Top Performers
  yPos = (doc as any).lastAutoTable.finalY + 15

  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Top 10 Performers', 14, yPos)
  yPos += 5

  const performersData = data.top_performers.map(p => [
    p.partner_name,
    p.partner_type === 'BUSINESS_ASSOCIATE' ? 'BA' : 'BP',
    p.total_commissions.toString(),
    `₹${p.total_amount.toLocaleString('en-IN')}`,
    `₹${p.avg_amount.toLocaleString('en-IN')}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Partner Name', 'Type', 'Count', 'Total Amount', 'Avg Amount']],
    body: performersData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  })

  // Partner Breakdown
  yPos = (doc as any).lastAutoTable.finalY + 15

  if (yPos > pageHeight - 60) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Partner Type Breakdown', 14, yPos)
  yPos += 5

  const partnerData = data.partner_breakdown.map(p => [
    p.partner_type,
    p.total_commissions.toString(),
    `₹${p.total_amount.toLocaleString('en-IN')}`,
    `₹${p.avg_amount.toLocaleString('en-IN')}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Partner Type', 'Total Commissions', 'Total Amount', 'Avg Amount']],
    body: partnerData,
    theme: 'striped',
    headStyles: { fillColor: [249, 115, 22], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  })

  // Product Breakdown
  yPos = (doc as any).lastAutoTable.finalY + 15

  if (yPos > pageHeight - 80) {
    doc.addPage()
    yPos = 20
  }

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Top 10 Products by Commission', 14, yPos)
  yPos += 5

  const productData = data.product_breakdown.slice(0, 10).map(p => [
    p.loan_product,
    p.total_commissions.toString(),
    `₹${p.total_amount.toLocaleString('en-IN')}`,
    `₹${p.avg_amount.toLocaleString('en-IN')}`,
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Loan Product', 'Total Commissions', 'Total Amount', 'Avg Amount']],
    body: productData,
    theme: 'grid',
    headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    doc.text('LOANZ360 Payout Management System', pageWidth - 14, pageHeight - 10, { align: 'right' })
  }

  doc.save(`payout-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
}

export function exportPayoutAnalyticsToExcel(data: PayoutAnalyticsExportData): void {
  const wb = XLSX.utils.book_new()

  // Summary Sheet
  const summaryData = [
    ['Payout Analytics Report'],
    [`Generated on: ${new Date().toLocaleDateString('en-IN')}`],
    [],
    ['Executive Summary'],
    ['Metric', 'Value'],
    ['Total Commissions Paid', data.overview.total_commissions_paid],
    ['Total Amount Paid', data.overview.total_amount_paid],
    ['Total Commissions Pending', data.overview.total_commissions_pending],
    ['Total Amount Pending', data.overview.total_amount_pending],
    ['Average Commission Amount', data.overview.avg_commission_amount],
    ['Total Active Partners', data.overview.total_partners],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Top Performers Sheet
  const performersHeaders = ['Partner Name', 'Partner Type', 'Total Commissions', 'Total Amount', 'Avg Amount']
  const performersData = data.top_performers.map(p => [
    p.partner_name,
    p.partner_type,
    p.total_commissions,
    p.total_amount,
    p.avg_amount,
  ])
  const performersSheet = XLSX.utils.aoa_to_sheet([performersHeaders, ...performersData])
  performersSheet['!cols'] = [
    { wch: 30 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ]
  XLSX.utils.book_append_sheet(wb, performersSheet, 'Top Performers')

  // Partner Breakdown Sheet
  const partnerHeaders = ['Partner Type', 'Total Commissions', 'Total Amount', 'Avg Amount']
  const partnerData = data.partner_breakdown.map(p => [
    p.partner_type,
    p.total_commissions,
    p.total_amount,
    p.avg_amount,
  ])
  const partnerSheet = XLSX.utils.aoa_to_sheet([partnerHeaders, ...partnerData])
  partnerSheet['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, partnerSheet, 'Partner Breakdown')

  // Product Breakdown Sheet
  const productHeaders = ['Loan Product', 'Total Commissions', 'Total Amount', 'Avg Amount']
  const productData = data.product_breakdown.map(p => [
    p.loan_product,
    p.total_commissions,
    p.total_amount,
    p.avg_amount,
  ])
  const productSheet = XLSX.utils.aoa_to_sheet([productHeaders, ...productData])
  productSheet['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, productSheet, 'Product Breakdown')

  XLSX.writeFile(wb, `payout-analytics-${new Date().toISOString().split('T')[0]}.xlsx`)
}
