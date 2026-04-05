import { toast } from 'sonner'
/**
 * EMI PDF Report Generator - Enterprise-grade PDF Generation
 *
 * Generates comprehensive PDF reports for EMI calculations including:
 * - Loan summary with all details
 * - Complete amortization schedule
 * - Visual charts (pie chart for payment breakdown)
 * - Prepayment analysis (if applicable)
 * - Terms and conditions
 * - Company branding
 */

import { EMICalculationResult, AmortizationRow, LoanType, LOAN_TYPE_CONFIG } from '@/types/emi-calculator'

export interface PDFReportConfig {
  companyName: string
  companyLogo?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  primaryColor?: string
  secondaryColor?: string
  showAmortizationSchedule?: boolean
  showCharts?: boolean
  showTermsAndConditions?: boolean
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  generatedBy?: string
  referenceNumber?: string
}

export interface PDFReportData {
  calculation: EMICalculationResult
  amortizationSchedule?: AmortizationRow[]
  loanType: LoanType
  principal: number
  interestRate: number
  tenure: number
  tenureType: 'months' | 'years'
  config?: PDFReportConfig
}

const DEFAULT_CONFIG: PDFReportConfig = {
  companyName: 'Loanz360',
  companyAddress: 'Financial District, India',
  companyPhone: '1800-123-4567',
  companyEmail: 'support@loanz360.com',
  companyWebsite: 'www.loanz360.com',
  primaryColor: '#f97316', // Orange
  secondaryColor: '#1f2937', // Dark gray
  showAmortizationSchedule: true,
  showCharts: true,
  showTermsAndConditions: true,
}

/**
 * Format currency in Indian Rupee format
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date in readable format
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Generate a unique reference number
 */
function generateReferenceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `EMI-${timestamp}-${random}`
}

/**
 * Generate SVG pie chart for payment breakdown
 */
function generatePieChartSVG(principal: number, totalInterest: number): string {
  const total = principal + totalInterest
  const principalPercent = (principal / total) * 100
  const interestPercent = (totalInterest / total) * 100

  // Calculate pie slices using SVG path
  const principalAngle = (principalPercent / 100) * 360

  const largeArcFlag = principalAngle > 180 ? 1 : 0
  const principalEndX = 100 + 80 * Math.cos((principalAngle - 90) * Math.PI / 180)
  const principalEndY = 100 + 80 * Math.sin((principalAngle - 90) * Math.PI / 180)

  return `
    <svg width="200" height="200" viewBox="0 0 200 200">
      <!-- Principal slice (Orange) -->
      <path d="M 100 100 L 100 20 A 80 80 0 ${largeArcFlag} 1 ${principalEndX} ${principalEndY} Z"
            fill="#f97316" />
      <!-- Interest slice (Gray) -->
      <path d="M 100 100 L ${principalEndX} ${principalEndY} A 80 80 0 ${1 - largeArcFlag} 1 100 20 Z"
            fill="#6b7280" />
      <!-- Center circle (white) -->
      <circle cx="100" cy="100" r="40" fill="white" />
      <!-- Labels -->
      <text x="100" y="95" text-anchor="middle" font-size="12" font-weight="bold" fill="#1f2937">EMI</text>
      <text x="100" y="112" text-anchor="middle" font-size="10" fill="#6b7280">Breakdown</text>
    </svg>
  `
}

/**
 * Generate HTML content for the PDF report
 */
export function generatePDFReportHTML(data: PDFReportData): string {
  const config = { ...DEFAULT_CONFIG, ...data.config }
  const referenceNumber = config.referenceNumber || generateReferenceNumber()
  const generatedDate = formatDate(new Date())
  const loanTypeInfo = LOAN_TYPE_CONFIG[data.loanType]

  const tenureDisplay = data.tenureType === 'years'
    ? `${data.tenure} Years (${data.tenure * 12} Months)`
    : `${data.tenure} Months`

  // Calculate yearly summary
  const yearlyData: { year: number; principal: number; interest: number; balance: number }[] = []
  let currentYear = 1
  let yearPrincipal = 0
  let yearInterest = 0

  data.amortizationSchedule?.forEach((entry, index) => {
    yearPrincipal += entry.principalPaid
    yearInterest += entry.interestPaid

    if ((index + 1) % 12 === 0 || index === (data.amortizationSchedule?.length ?? 0) - 1) {
      yearlyData.push({
        year: currentYear,
        principal: yearPrincipal,
        interest: yearInterest,
        balance: entry.balance,
      })
      currentYear++
      yearPrincipal = 0
      yearInterest = 0
    }
  })

  const pieChartSVG = generatePieChartSVG(data.principal, data.calculation.totalInterest)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EMI Calculation Report - ${referenceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: white;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 3px solid ${config.primaryColor};
      margin-bottom: 20px;
    }

    .logo {
      font-size: 28px;
      font-weight: bold;
      color: ${config.primaryColor};
    }

    .company-info {
      text-align: right;
      font-size: 10px;
      color: #6b7280;
    }

    /* Report Title */
    .report-title {
      text-align: center;
      margin-bottom: 20px;
    }

    .report-title h1 {
      font-size: 24px;
      color: ${config.secondaryColor};
      margin-bottom: 5px;
    }

    .report-title .subtitle {
      font-size: 14px;
      color: #6b7280;
    }

    .reference-info {
      display: flex;
      justify-content: space-between;
      background: #f9fafb;
      padding: 10px 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 11px;
    }

    /* Sections */
    .section {
      margin-bottom: 25px;
    }

    .section-title {
      font-size: 16px;
      font-weight: bold;
      color: ${config.primaryColor};
      border-bottom: 2px solid ${config.primaryColor};
      padding-bottom: 5px;
      margin-bottom: 15px;
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .summary-card {
      background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 15px;
      text-align: center;
    }

    .summary-card.highlight {
      background: linear-gradient(135deg, ${config.primaryColor}15 0%, ${config.primaryColor}25 100%);
      border-color: ${config.primaryColor};
    }

    .summary-card .label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .summary-card .value {
      font-size: 18px;
      font-weight: bold;
      color: ${config.secondaryColor};
    }

    .summary-card.highlight .value {
      color: ${config.primaryColor};
    }

    /* Loan Details Table */
    .details-table {
      width: 100%;
      border-collapse: collapse;
    }

    .details-table td {
      padding: 10px 15px;
      border-bottom: 1px solid #e5e7eb;
    }

    .details-table td:first-child {
      width: 40%;
      color: #6b7280;
      font-weight: 500;
    }

    .details-table td:last-child {
      font-weight: 600;
    }

    /* Chart Section */
    .chart-section {
      display: flex;
      gap: 30px;
      align-items: center;
      margin-bottom: 20px;
    }

    .chart-container {
      flex-shrink: 0;
    }

    .chart-legend {
      flex: 1;
    }

    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }

    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      margin-right: 10px;
    }

    .legend-label {
      flex: 1;
      color: #6b7280;
    }

    .legend-value {
      font-weight: bold;
    }

    /* Amortization Table */
    .amortization-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    .amortization-table th {
      background: ${config.secondaryColor};
      color: white;
      padding: 10px 8px;
      text-align: right;
      font-weight: 600;
    }

    .amortization-table th:first-child {
      text-align: center;
      border-radius: 8px 0 0 0;
    }

    .amortization-table th:last-child {
      border-radius: 0 8px 0 0;
    }

    .amortization-table td {
      padding: 8px;
      text-align: right;
      border-bottom: 1px solid #e5e7eb;
    }

    .amortization-table td:first-child {
      text-align: center;
      font-weight: 500;
    }

    .amortization-table tr:nth-child(even) {
      background: #f9fafb;
    }

    .amortization-table tr:hover {
      background: ${config.primaryColor}10;
    }

    /* Yearly Summary */
    .yearly-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }

    .yearly-table th {
      background: ${config.primaryColor};
      color: white;
      padding: 12px;
      text-align: right;
      font-weight: 600;
    }

    .yearly-table th:first-child {
      text-align: center;
      border-radius: 8px 0 0 0;
    }

    .yearly-table th:last-child {
      border-radius: 0 8px 0 0;
    }

    .yearly-table td {
      padding: 10px 12px;
      text-align: right;
      border-bottom: 1px solid #e5e7eb;
    }

    .yearly-table td:first-child {
      text-align: center;
      font-weight: 600;
    }

    .yearly-table tr:nth-child(even) {
      background: #f9fafb;
    }

    /* Terms and Conditions */
    .terms {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      font-size: 10px;
      color: #6b7280;
    }

    .terms h4 {
      color: ${config.secondaryColor};
      margin-bottom: 10px;
    }

    .terms ul {
      padding-left: 20px;
    }

    .terms li {
      margin-bottom: 5px;
    }

    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }

    .footer .disclaimer {
      margin-top: 10px;
      font-style: italic;
    }

    /* Customer Info */
    .customer-info {
      background: ${config.primaryColor}10;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .customer-info h4 {
      color: ${config.primaryColor};
      margin-bottom: 10px;
    }

    /* Print Styles */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .container {
        padding: 0;
      }

      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="header">
      <div class="logo">${config.companyName}</div>
      <div class="company-info">
        ${config.companyAddress ? `<div>${config.companyAddress}</div>` : ''}
        ${config.companyPhone ? `<div>Phone: ${config.companyPhone}</div>` : ''}
        ${config.companyEmail ? `<div>Email: ${config.companyEmail}</div>` : ''}
        ${config.companyWebsite ? `<div>Web: ${config.companyWebsite}</div>` : ''}
      </div>
    </header>

    <!-- Report Title -->
    <div class="report-title">
      <h1>EMI Calculation Report</h1>
      <div class="subtitle">${loanTypeInfo.label}</div>
    </div>

    <!-- Reference Info -->
    <div class="reference-info">
      <div><strong>Reference No:</strong> ${referenceNumber}</div>
      <div><strong>Generated On:</strong> ${generatedDate}</div>
      ${config.generatedBy ? `<div><strong>Generated By:</strong> ${config.generatedBy}</div>` : ''}
    </div>

    ${config.customerName ? `
    <!-- Customer Information -->
    <div class="customer-info">
      <h4>Customer Information</h4>
      <table class="details-table">
        <tr>
          <td>Name</td>
          <td>${config.customerName}</td>
        </tr>
        ${config.customerEmail ? `<tr><td>Email</td><td>${config.customerEmail}</td></tr>` : ''}
        ${config.customerPhone ? `<tr><td>Phone</td><td>${config.customerPhone}</td></tr>` : ''}
      </table>
    </div>
    ` : ''}

    <!-- Summary Cards -->
    <div class="section">
      <h2 class="section-title">Loan Summary</h2>
      <div class="summary-grid">
        <div class="summary-card highlight">
          <div class="label">Monthly EMI</div>
          <div class="value">${formatCurrency(data.calculation.monthlyEMI)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Interest</div>
          <div class="value">${formatCurrency(data.calculation.totalInterest)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Total Payment</div>
          <div class="value">${formatCurrency(data.calculation.totalAmount)}</div>
        </div>
      </div>
    </div>

    <!-- Loan Details -->
    <div class="section">
      <h2 class="section-title">Loan Details</h2>
      <table class="details-table">
        <tr>
          <td>Loan Type</td>
          <td>${loanTypeInfo.label}</td>
        </tr>
        <tr>
          <td>Principal Amount</td>
          <td>${formatCurrency(data.principal)}</td>
        </tr>
        <tr>
          <td>Interest Rate</td>
          <td>${data.interestRate}% per annum</td>
        </tr>
        <tr>
          <td>Loan Tenure</td>
          <td>${tenureDisplay}</td>
        </tr>
        <tr>
          <td>Interest Calculation Method</td>
          <td>Reducing Balance (Monthly)</td>
        </tr>
        <tr>
          <td>First EMI Due Date</td>
          <td>${formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}</td>
        </tr>
      </table>
    </div>

    ${config.showCharts ? `
    <!-- Payment Breakdown Chart -->
    <div class="section">
      <h2 class="section-title">Payment Breakdown</h2>
      <div class="chart-section">
        <div class="chart-container">
          ${pieChartSVG}
        </div>
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color" style="background: #f97316;"></div>
            <div class="legend-label">Principal Amount</div>
            <div class="legend-value">${formatCurrency(data.principal)} (${((data.principal / data.calculation.totalAmount) * 100).toFixed(1)}%)</div>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background: #6b7280;"></div>
            <div class="legend-label">Total Interest</div>
            <div class="legend-value">${formatCurrency(data.calculation.totalInterest)} (${((data.calculation.totalInterest / data.calculation.totalAmount) * 100).toFixed(1)}%)</div>
          </div>
          <div class="legend-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            <div class="legend-color" style="background: transparent;"></div>
            <div class="legend-label"><strong>Total Payment</strong></div>
            <div class="legend-value"><strong>${formatCurrency(data.calculation.totalAmount)}</strong></div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Yearly Summary -->
    <div class="section">
      <h2 class="section-title">Year-wise Breakdown</h2>
      <table class="yearly-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Principal Paid</th>
            <th>Interest Paid</th>
            <th>Total Paid</th>
            <th>Outstanding Balance</th>
          </tr>
        </thead>
        <tbody>
          ${yearlyData.map(year => `
          <tr>
            <td>${year.year}</td>
            <td>${formatCurrency(year.principal)}</td>
            <td>${formatCurrency(year.interest)}</td>
            <td>${formatCurrency(year.principal + year.interest)}</td>
            <td>${formatCurrency(year.balance)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${config.showAmortizationSchedule && (data.amortizationSchedule?.length ?? 0) <= 60 ? `
    <!-- Amortization Schedule -->
    <div class="section page-break">
      <h2 class="section-title">Complete Amortization Schedule</h2>
      <table class="amortization-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>EMI</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          ${data.amortizationSchedule?.map((entry, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${formatCurrency(entry.emi)}</td>
            <td>${formatCurrency(entry.principalPaid)}</td>
            <td>${formatCurrency(entry.interestPaid)}</td>
            <td>${formatCurrency(entry.balance)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : config.showAmortizationSchedule ? `
    <!-- Amortization Note -->
    <div class="section">
      <h2 class="section-title">Amortization Schedule</h2>
      <p style="color: #6b7280; font-style: italic;">
        The complete month-wise amortization schedule is available in the digital version of this report.
        Please visit ${config.companyWebsite} or contact us for the detailed schedule.
      </p>
    </div>
    ` : ''}

    ${config.showTermsAndConditions ? `
    <!-- Terms and Conditions -->
    <div class="section">
      <div class="terms">
        <h4>Important Notes & Disclaimer</h4>
        <ul>
          <li>This is an indicative calculation based on the inputs provided. Actual EMI may vary based on the lender's terms and conditions.</li>
          <li>Interest rates are subject to change based on RBI guidelines and individual lender policies.</li>
          <li>Processing fees, insurance, and other charges are not included in this calculation.</li>
          <li>The actual loan eligibility depends on various factors including income, credit score, existing liabilities, and lender policies.</li>
          <li>This document is for informational purposes only and does not constitute a loan offer or guarantee.</li>
          <li>EMI calculations assume regular monthly payments. Prepayments or delayed payments will affect the amortization schedule.</li>
          <li>Tax benefits shown (if any) are indicative and subject to prevailing tax laws. Consult a tax advisor for accurate information.</li>
        </ul>
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <footer class="footer">
      <div>
        <strong>${config.companyName}</strong> | Your Trusted Loan Partner
      </div>
      <div class="disclaimer">
        This report was generated electronically and is valid without signature.
        For queries, contact: ${config.companyEmail} | ${config.companyPhone}
      </div>
      <div style="margin-top: 10px; color: ${config.primaryColor};">
        © ${new Date().getFullYear()} ${config.companyName}. All rights reserved.
      </div>
    </footer>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Download PDF report (client-side using browser's print functionality)
 */
export function downloadPDFReport(data: PDFReportData): void {
  const htmlContent = generatePDFReportHTML(data)

  // Create a new window with the report
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast.error('Please allow popups to download the PDF report.')
    return
  }

  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }
}

/**
 * Generate PDF blob for advanced use cases
 * (Requires a library like html2pdf.js or jsPDF for actual PDF generation)
 */
export async function generatePDFBlob(data: PDFReportData): Promise<Blob> {
  const htmlContent = generatePDFReportHTML(data)

  // For now, return as HTML blob (can be enhanced with html2pdf.js)
  return new Blob([htmlContent], { type: 'text/html' })
}

/**
 * Email PDF report
 */
export function emailPDFReport(
  data: PDFReportData,
  recipientEmail: string
): { subject: string; body: string; attachmentHtml: string } {
  const config = data.config || DEFAULT_CONFIG
  const referenceNumber = config.referenceNumber || generateReferenceNumber()
  const loanTypeInfo = LOAN_TYPE_CONFIG[data.loanType]

  return {
    subject: `EMI Calculation Report - ${loanTypeInfo.label} - ${referenceNumber}`,
    body: `
Dear ${config.customerName || 'Customer'},

Thank you for using ${config.companyName} EMI Calculator.

Please find below the summary of your loan calculation:

Loan Type: ${loanTypeInfo.label}
Loan Amount: ${formatCurrency(data.principal)}
Interest Rate: ${data.interestRate}% p.a.
Tenure: ${data.tenureType === 'years' ? `${data.tenure} Years` : `${data.tenure} Months`}

Monthly EMI: ${formatCurrency(data.calculation.monthlyEMI)}
Total Interest: ${formatCurrency(data.calculation.totalInterest)}
Total Payment: ${formatCurrency(data.calculation.totalAmount)}

Reference Number: ${referenceNumber}

For detailed amortization schedule and complete report, please visit our website or contact us.

Best Regards,
${config.companyName}
${config.companyPhone}
${config.companyEmail}
    `.trim(),
    attachmentHtml: generatePDFReportHTML(data),
  }
}

/**
 * Share report via WhatsApp
 */
export function generateWhatsAppShareMessage(data: PDFReportData): string {
  const loanTypeInfo = LOAN_TYPE_CONFIG[data.loanType]
  const referenceNumber = data.config?.referenceNumber || generateReferenceNumber()

  return encodeURIComponent(`
*EMI Calculation Summary*
━━━━━━━━━━━━━━━━━━

📋 *Loan Type:* ${loanTypeInfo.label}
💰 *Loan Amount:* ${formatCurrency(data.principal)}
📊 *Interest Rate:* ${data.interestRate}% p.a.
📅 *Tenure:* ${data.tenureType === 'years' ? `${data.tenure} Years` : `${data.tenure} Months`}

━━━━━━━━━━━━━━━━━━
💵 *Monthly EMI:* ${formatCurrency(data.calculation.monthlyEMI)}
💹 *Total Interest:* ${formatCurrency(data.calculation.totalInterest)}
💎 *Total Payment:* ${formatCurrency(data.calculation.totalAmount)}
━━━━━━━━━━━━━━━━━━

📌 Ref: ${referenceNumber}

_Generated by ${data.config?.companyName || 'Loanz360'}_
  `.trim())
}
