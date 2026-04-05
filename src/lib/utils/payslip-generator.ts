/**
 * Payslip PDF Generator
 * Generates branded payslip HTML for browser print dialog or server-side rendering.
 * Uses HTML approach (same pattern as emi-pdf-generator.ts) for maximum compatibility.
 * Brand: Orange #FF6700, Ash Gray #171717
 */

interface PayslipData {
  company: {
    name: string
    address?: string
    logo_url?: string
  }
  employee: {
    name: string
    employee_id: string
    department: string
    designation: string
    date_of_joining: string
    pan_number?: string
    bank_name?: string
    bank_account?: string
  }
  payroll: {
    month: string
    year: number
    working_days: number
    days_worked: number
    lop_days: number
  }
  earnings: Array<{ label: string; amount: number }>
  deductions: Array<{ label: string; amount: number }>
  gross_salary: number
  total_deductions: number
  net_salary: number
}

export type { PayslipData }

export function generatePayslipHTML(data: PayslipData): string {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip - ${escapeHtml(data.employee.name)} - ${escapeHtml(data.payroll.month)} ${data.payroll.year}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; }
    .payslip { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #FF6700; padding-bottom: 15px; margin-bottom: 15px; }
    .company-name { font-size: 22px; font-weight: bold; color: #171717; }
    .payslip-title { font-size: 14px; color: #FF6700; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .employee-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; padding: 12px; background: #f8f8f8; border-radius: 6px; }
    .info-row { display: flex; gap: 8px; }
    .info-label { font-weight: 600; color: #666; min-width: 130px; }
    .info-value { color: #333; }
    .table-section { margin-bottom: 15px; }
    .section-title { font-size: 13px; font-weight: 700; color: #FF6700; margin-bottom: 8px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #171717; color: white; font-size: 11px; text-transform: uppercase; }
    td:last-child, th:last-child { text-align: right; }
    .totals { display: flex; justify-content: space-between; padding: 15px; background: #171717; color: white; border-radius: 6px; margin-top: 20px; }
    .total-item { text-align: center; }
    .total-label { font-size: 10px; text-transform: uppercase; opacity: 0.7; }
    .total-value { font-size: 18px; font-weight: bold; }
    .net-pay { color: #FF6700; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 10px; color: #999; text-align: center; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .payslip { padding: 0; } }
  </style>
</head>
<body>
  <div class="payslip">
    <div class="header">
      <div>
        <div class="company-name">${escapeHtml(data.company.name)}</div>
        ${data.company.address ? `<div style="color: #666; font-size: 11px; margin-top: 4px;">${escapeHtml(data.company.address)}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div class="payslip-title">Payslip</div>
        <div style="color: #666; font-size: 11px;">${escapeHtml(data.payroll.month)} ${data.payroll.year}</div>
      </div>
    </div>

    <div class="employee-info">
      <div class="info-row"><span class="info-label">Employee Name:</span><span class="info-value">${escapeHtml(data.employee.name)}</span></div>
      <div class="info-row"><span class="info-label">Employee ID:</span><span class="info-value">${escapeHtml(data.employee.employee_id)}</span></div>
      <div class="info-row"><span class="info-label">Department:</span><span class="info-value">${escapeHtml(data.employee.department)}</span></div>
      <div class="info-row"><span class="info-label">Designation:</span><span class="info-value">${escapeHtml(data.employee.designation)}</span></div>
      <div class="info-row"><span class="info-label">Date of Joining:</span><span class="info-value">${escapeHtml(data.employee.date_of_joining)}</span></div>
      ${data.employee.pan_number ? `<div class="info-row"><span class="info-label">PAN Number:</span><span class="info-value">${escapeHtml(data.employee.pan_number)}</span></div>` : ''}
      ${data.employee.bank_name ? `<div class="info-row"><span class="info-label">Bank:</span><span class="info-value">${escapeHtml(data.employee.bank_name)}</span></div>` : ''}
      ${data.employee.bank_account ? `<div class="info-row"><span class="info-label">Account No:</span><span class="info-value">${maskBankAccount(data.employee.bank_account)}</span></div>` : ''}
    </div>

    <div class="info-row" style="margin-bottom: 15px; padding: 8px 12px; background: #fff3e6; border-radius: 4px; border-left: 3px solid #FF6700;">
      <span class="info-label">Working Days: ${data.payroll.working_days}</span>
      <span style="margin-left: 20px;">Days Worked: ${data.payroll.days_worked}</span>
      ${data.payroll.lop_days > 0 ? `<span style="margin-left: 20px; color: #e53e3e;">LOP Days: ${data.payroll.lop_days}</span>` : ''}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="table-section">
        <div class="section-title">Earnings</div>
        <table>
          <thead><tr><th>Component</th><th>Amount</th></tr></thead>
          <tbody>
            ${data.earnings.map(e => `<tr><td>${escapeHtml(e.label)}</td><td>${formatCurrency(e.amount)}</td></tr>`).join('')}
            <tr style="font-weight: bold; border-top: 2px solid #FF6700;"><td>Gross Salary</td><td>${formatCurrency(data.gross_salary)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-section">
        <div class="section-title">Deductions</div>
        <table>
          <thead><tr><th>Component</th><th>Amount</th></tr></thead>
          <tbody>
            ${data.deductions.map(d => `<tr><td>${escapeHtml(d.label)}</td><td>${formatCurrency(d.amount)}</td></tr>`).join('')}
            <tr style="font-weight: bold; border-top: 2px solid #e53e3e;"><td>Total Deductions</td><td>${formatCurrency(data.total_deductions)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="totals">
      <div class="total-item"><div class="total-label">Gross Salary</div><div class="total-value">${formatCurrency(data.gross_salary)}</div></div>
      <div class="total-item"><div class="total-label">Total Deductions</div><div class="total-value">${formatCurrency(data.total_deductions)}</div></div>
      <div class="total-item"><div class="total-label">Net Pay</div><div class="total-value net-pay">${formatCurrency(data.net_salary)}</div></div>
    </div>

    <div class="footer">
      This is a computer-generated payslip and does not require a signature. | Generated on ${new Date().toLocaleDateString('en-IN')}
    </div>
  </div>
</body>
</html>`
}

function maskBankAccount(account: string): string {
  const digits = account.replace(/\s/g, '')
  if (digits.length <= 4) return escapeHtml(digits)
  const lastFour = digits.slice(-4)
  return `XXXX XXXX ${escapeHtml(lastFour)}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
