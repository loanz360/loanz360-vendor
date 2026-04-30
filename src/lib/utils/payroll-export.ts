// =====================================================
// PAYROLL EXPORT UTILITIES (Enhancement E16)
// Export payroll data in various formats
// =====================================================

import { formatCurrency, formatDate, formatMonthYear } from './payroll-utils'

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Escape a CSV field value — wraps in quotes if it contains commas, quotes, or newlines
 */
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generate CSV content from payroll data
 */
export function generatePayrollCSV(payslips: unknown[]): string {
  if (payslips.length === 0) {
    return 'No data available'
  }

  // CSV Headers
  const headers = [
    'Month',
    'Year',
    'Period',
    'Basic Salary',
    'HRA',
    'Special Allowance',
    'Gross Salary',
    'PF Employee',
    'ESI Employee',
    'Professional Tax',
    'TDS',
    'Total Deductions',
    'Net Salary',
    'Working Days',
    'Present Days',
    'LOP Days',
    'LOP Amount'
  ]

  const csvRows = [headers.map(escapeCsvField).join(',')]

  // Data rows
  payslips.forEach(payslip => {
    const row = [
      payslip.month,
      payslip.year,
      formatMonthYear(payslip.month, payslip.year),
      payslip.basic_salary || 0,
      payslip.hra || 0,
      payslip.special_allowance || 0,
      payslip.gross_salary || 0,
      payslip.pf_employee || 0,
      payslip.esi_employee || 0,
      payslip.professional_tax || 0,
      payslip.tds || 0,
      payslip.total_deductions || 0,
      payslip.net_salary || 0,
      payslip.working_days || 0,
      payslip.present_days || 0,
      payslip.lop_days || 0,
      payslip.lop_amount || 0
    ]
    csvRows.push(row.map(escapeCsvField).join(','))
  })

  return csvRows.join('\n')
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Revoke the object URL to free memory
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Generate Annual Salary Statement HTML
 */
export function generateAnnualSalaryStatementHTML(
  employeeDetails: {
    name: string
    employeeId: string
    designation: string
    department: string
    pan?: string
  },
  payslips: unknown[],
  year: number
): string {
  const totalGross = payslips.reduce((sum, p) => sum + (p.gross_salary || 0), 0)
  const totalDeductions = payslips.reduce((sum, p) => sum + (p.total_deductions || 0), 0)
  const totalNet = payslips.reduce((sum, p) => sum + (p.net_salary || 0), 0)
  const totalPF = payslips.reduce((sum, p) => sum + (p.pf_employee || 0), 0)
  const totalESI = payslips.reduce((sum, p) => sum + (p.esi_employee || 0), 0)
  const totalPT = payslips.reduce((sum, p) => sum + (p.professional_tax || 0), 0)
  const totalTDS = payslips.reduce((sum, p) => sum + (p.tds || 0), 0)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Annual Salary Statement ${year}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: #f5f5f5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #FF6B00;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #333;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .employee-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .detail-item {
      display: flex;
      flex-direction: column;
    }
    .detail-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .detail-value {
      font-size: 16px;
      color: #333;
      font-weight: 600;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card.gross {
      background: #e8f5e9;
      border: 2px solid #4caf50;
    }
    .summary-card.deductions {
      background: #ffebee;
      border: 2px solid #f44336;
    }
    .summary-card.net {
      background: #e3f2fd;
      border: 2px solid #2196f3;
    }
    .summary-card .label {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    .summary-card .amount {
      font-size: 32px;
      font-weight: bold;
    }
    .summary-card.gross .amount { color: #2e7d32; }
    .summary-card.deductions .amount { color: #c62828; }
    .summary-card.net .amount { color: #1565c0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #333;
      color: white;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    td {
      font-size: 14px;
      color: #333;
    }
    tr:hover {
      background: #f5f5f5;
    }
    .amount-cell {
      text-align: right;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Annual Salary Statement</h1>
      <p>Financial Year ${year} - ${year + 1}</p>
    </div>

    <div class="employee-details">
      <div class="detail-item">
        <div class="detail-label">Employee Name</div>
        <div class="detail-value">${escapeHtml(employeeDetails.name)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Employee ID</div>
        <div class="detail-value">${escapeHtml(employeeDetails.employeeId)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Designation</div>
        <div class="detail-value">${escapeHtml(employeeDetails.designation)}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Department</div>
        <div class="detail-value">${escapeHtml(employeeDetails.department)}</div>
      </div>
      ${
        employeeDetails.pan
          ? `
      <div class="detail-item">
        <div class="detail-label">PAN Number</div>
        <div class="detail-value">${escapeHtml(employeeDetails.pan)}</div>
      </div>
      `
          : ''
      }
      <div class="detail-item">
        <div class="detail-label">Generated On</div>
        <div class="detail-value">${formatDate(new Date())}</div>
      </div>
    </div>

    <div class="summary-cards">
      <div class="summary-card gross">
        <div class="label">Total Gross Salary</div>
        <div class="amount">${formatCurrency(totalGross)}</div>
      </div>
      <div class="summary-card deductions">
        <div class="label">Total Deductions</div>
        <div class="amount">${formatCurrency(totalDeductions)}</div>
      </div>
      <div class="summary-card net">
        <div class="label">Total Net Pay</div>
        <div class="amount">${formatCurrency(totalNet)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Gross Salary</th>
          <th>PF</th>
          <th>PT</th>
          <th>TDS</th>
          <th>Deductions</th>
          <th>Net Pay</th>
        </tr>
      </thead>
      <tbody>
        ${payslips
          .map(
            p => `
        <tr>
          <td>${formatMonthYear(p.month, p.year)}</td>
          <td class="amount-cell">${formatCurrency(p.gross_salary || 0)}</td>
          <td class="amount-cell">${formatCurrency(p.pf_employee || 0)}</td>
          <td class="amount-cell">${formatCurrency(p.professional_tax || 0)}</td>
          <td class="amount-cell">${formatCurrency(p.tds || 0)}</td>
          <td class="amount-cell">${formatCurrency(p.total_deductions || 0)}</td>
          <td class="amount-cell">${formatCurrency(p.net_salary || 0)}</td>
        </tr>
        `
          )
          .join('')}
        <tr style="background: #f5f5f5; font-weight: bold;">
          <td>TOTAL</td>
          <td class="amount-cell">${formatCurrency(totalGross)}</td>
          <td class="amount-cell">${formatCurrency(totalPF)}</td>
          <td class="amount-cell">${formatCurrency(totalPT)}</td>
          <td class="amount-cell">${formatCurrency(totalTDS)}</td>
          <td class="amount-cell">${formatCurrency(totalDeductions)}</td>
          <td class="amount-cell">${formatCurrency(totalNet)}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p>This is a computer-generated statement and does not require a signature.</p>
      <p>Generated on ${formatDate(new Date(), 'full')}</p>
      <p>© ${new Date().getFullYear()} LOANZ 360. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * Download HTML as PDF (triggers print dialog)
 */
export function downloadAnnualStatement(html: string, filename: string) {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()

    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print()
      // Optional: close after printing
      // printWindow.close()
    }, 250)
  }
}

/**
 * Download data as JSON
 */
export function downloadJSON(data: unknown, filename: string) {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Revoke the object URL to free memory
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Generate Tax Summary Report
 */
export function generateTaxSummaryHTML(
  employeeDetails: { name: string; pan: string; financialYear: string },
  taxData: {
    grossIncome: number
    deductions: { section: string; amount: number }[]
    taxableIncome: number
    taxPaid: number
    tdsDeducted: number
  }
): string {
  const totalDeductions = taxData.deductions.reduce((sum, d) => sum + d.amount, 0)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Summary ${escapeHtml(taxData.financialYear)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    h1 { color: #333; }
    .info { margin-bottom: 30px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .amount { text-align: right; font-weight: 600; }
    .total { background: #e8f5e9; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Income Tax Summary</h1>
    <p>Financial Year: ${escapeHtml(taxData.financialYear)}</p>
  </div>

  <div class="info">
    <div class="info-row"><span>Name:</span><span>${escapeHtml(employeeDetails.name)}</span></div>
    <div class="info-row"><span>PAN:</span><span>${escapeHtml(employeeDetails.pan)}</span></div>
  </div>

  <table>
    <thead>
      <tr><th>Particulars</th><th class="amount">Amount</th></tr>
    </thead>
    <tbody>
      <tr><td>Gross Annual Income</td><td class="amount">${formatCurrency(taxData.grossIncome)}</td></tr>
      ${taxData.deductions.map(d => `<tr><td>${escapeHtml(d.section)}</td><td class="amount">${formatCurrency(d.amount)}</td></tr>`).join('')}
      <tr class="total"><td>Total Deductions</td><td class="amount">${formatCurrency(totalDeductions)}</td></tr>
      <tr class="total"><td>Taxable Income</td><td class="amount">${formatCurrency(taxData.taxableIncome)}</td></tr>
      <tr><td>Tax Payable</td><td class="amount">${formatCurrency(taxData.taxPaid)}</td></tr>
      <tr><td>TDS Deducted</td><td class="amount">${formatCurrency(taxData.tdsDeducted)}</td></tr>
      <tr class="total"><td>Tax Remaining</td><td class="amount">${formatCurrency(Math.max(0, taxData.taxPaid - taxData.tdsDeducted))}</td></tr>
    </tbody>
  </table>

  <p style="text-align: center; color: #666; font-size: 12px; margin-top: 40px;">
    Generated on ${formatDate(new Date(), 'full')}
  </p>
</body>
</html>
  `
}
