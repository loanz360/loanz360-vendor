/**
 * Commission Invoice PDF Generator
 * Generates branded PDF invoices for partner commission payments
 * Uses jsPDF + jspdf-autotable following emi-pdf-generator.ts pattern
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface CommissionInvoiceData {
  // Partner details
  partnerName: string
  partnerId: string
  partnerType: 'BA' | 'BP' | 'CP'
  partnerEmail?: string
  partnerMobile?: string
  partnerPAN?: string

  // Invoice details
  invoiceNumber: string
  invoiceDate: string
  period: string // e.g., "January 2026"

  // Commission line items
  items: CommissionLineItem[]

  // Totals
  grossCommission: number
  tdsDeduction: number // TDS @ 5% u/s 194H
  netPayable: number

  // Payment details
  paymentMode?: string
  paymentDate?: string
  transactionId?: string
  bankName?: string
}

export interface CommissionLineItem {
  bankName: string
  loanType: string
  customerName: string
  loanAmount: number
  commissionRate: number
  commissionAmount: number
  disbursementDate: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function generateCommissionInvoicePDF(data: CommissionInvoiceData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // Colors
  const orange = [249, 115, 22] as [number, number, number]
  const darkGray = [23, 23, 23] as [number, number, number]
  const lightGray = [156, 163, 175] as [number, number, number]

  // Header background
  doc.setFillColor(...orange)
  doc.rect(0, 0, pageWidth, 40, 'F')

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('LOANZ360', margin, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Commission Payout Invoice', margin, 28)

  // Invoice number (right side)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Invoice #${data.invoiceNumber}`, pageWidth - margin, 18, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Date: ${formatDate(data.invoiceDate)}`, pageWidth - margin, 28, { align: 'right' })

  y = 50

  // Partner Details section
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Partner Details', margin, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...lightGray)

  const partnerTypeMap: Record<string, string> = {
    'BA': 'Business Associate',
    'BP': 'Business Partner',
    'CP': 'Channel Partner',
  }

  const details = [
    ['Name', data.partnerName],
    ['Partner ID', data.partnerId],
    ['Type', partnerTypeMap[data.partnerType] || data.partnerType],
    ['Period', data.period],
  ]
  if (data.partnerEmail) details.push(['Email', data.partnerEmail])
  if (data.partnerPAN) details.push(['PAN', data.partnerPAN])

  details.forEach(([label, value]) => {
    doc.setTextColor(...lightGray)
    doc.text(`${label}:`, margin, y)
    doc.setTextColor(...darkGray)
    doc.text(value, margin + 35, y)
    y += 5
  })

  y += 5

  // Commission Details Table
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...darkGray)
  doc.text('Commission Breakdown', margin, y)
  y += 3

  const tableHeaders = [['#', 'Bank', 'Loan Type', 'Customer', 'Loan Amt', 'Rate', 'Commission', 'Date']]
  const tableBody = data.items.map((item, idx) => [
    String(idx + 1),
    item.bankName,
    item.loanType,
    item.customerName,
    formatCurrency(item.loanAmount),
    `${item.commissionRate}%`,
    formatCurrency(item.commissionAmount),
    formatDate(item.disbursementDate),
  ])

  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableBody,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: orange,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: darkGray,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { cellWidth: 20 },
    },
  })

  // Get the final Y after table
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // Summary Box
  const summaryX = pageWidth - margin - 70
  const summaryW = 70

  doc.setFillColor(249, 250, 251)
  doc.rect(summaryX, y, summaryW, 35, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.rect(summaryX, y, summaryW, 35, 'S')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...lightGray)
  doc.text('Gross Commission', summaryX + 3, y + 7)
  doc.text('TDS (5% u/s 194H)', summaryX + 3, y + 14)
  doc.setDrawColor(229, 231, 235)
  doc.line(summaryX + 3, y + 18, summaryX + summaryW - 3, y + 18)

  doc.setTextColor(...darkGray)
  doc.text(formatCurrency(data.grossCommission), summaryX + summaryW - 3, y + 7, { align: 'right' })
  doc.setTextColor(239, 68, 68)
  doc.text(`-${formatCurrency(data.tdsDeduction)}`, summaryX + summaryW - 3, y + 14, { align: 'right' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...orange)
  doc.text('Net Payable', summaryX + 3, y + 28)
  doc.text(formatCurrency(data.netPayable), summaryX + summaryW - 3, y + 28, { align: 'right' })

  y += 45

  // Payment Details (if available)
  if (data.paymentMode || data.transactionId) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...darkGray)
    doc.text('Payment Details', margin, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (data.paymentMode) { doc.text(`Mode: ${data.paymentMode}`, margin, y); y += 4 }
    if (data.paymentDate) { doc.text(`Date: ${formatDate(data.paymentDate)}`, margin, y); y += 4 }
    if (data.transactionId) { doc.text(`Transaction ID: ${data.transactionId}`, margin, y); y += 4 }
    if (data.bankName) { doc.text(`Bank: ${data.bankName}`, margin, y); y += 4 }
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setFontSize(7)
  doc.setTextColor(...lightGray)
  doc.text('This is a system-generated invoice. For queries, contact support@loanz360.com', pageWidth / 2, footerY, { align: 'center' })
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} by Loanz360`, pageWidth / 2, footerY + 4, { align: 'center' })

  return doc
}

export function downloadCommissionInvoice(data: CommissionInvoiceData): void {
  const doc = generateCommissionInvoicePDF(data)
  doc.save(`Loanz360_Commission_Invoice_${data.invoiceNumber}.pdf`)
}
