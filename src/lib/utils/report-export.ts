/**
 * Report Export Utilities for Accounts Manager Portal
 * Handles PDF generation (via print) and CSV exports for dashboard reports.
 */

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a number to Indian currency notation with the Rupee symbol.
 * Examples: ₹12,34,567 | ₹1,23,456.78
 */
export function formatCurrencyINR(amount: number, decimals = 0): string {
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `₹${formatted}`
}

/**
 * Compact Indian currency for large values (e.g. ₹1.2 Cr, ₹45.3 L)
 */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)} K`
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format a date range string for report headers.
 * E.g. "01 Mar 2026 – 28 Mar 2026"
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(startDate)} – ${fmt(endDate)}`
}

// ---------------------------------------------------------------------------
// Internal CSV helpers
// ---------------------------------------------------------------------------

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '""'
  const str = String(value)
  // Prevent formula injection
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str
  return `"${safe.replace(/"/g, '""')}"`
}

function downloadCSV(filename: string, csvContent: string): void {
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Shared interfaces (aligned with dashboard data shapes)
// ---------------------------------------------------------------------------

export interface TeamMemberExport {
  name: string
  sub_role: string
  today: { picked_up: number; verified: number; rejected: number }
  monthly: { verified: number; rejected: number }
  last_login_at: string | null
}

export interface FinancialExport {
  partner_type: string
  pending_count: number
  pending_amount: number
  verified_this_month: number
  avg_processing_time: number
}

export interface AnalyticsPoint {
  date: string
  verified: number
  rejected: number
}

export interface DashboardExportData {
  stats: {
    pending_total: number
    in_progress_total: number
    verified_today_total: number
    monthly: { total_verified: number; total_rejected: number }
  }
  financial: {
    cp_pending_amount: number
    ba_pending_amount: number
    bp_pending_amount: number
    total_pending_amount: number
  }
  teamPerformance: TeamMemberExport[]
  approvalMetrics: { current_rate: number; mom_change: number }
  processingTime: { avg_hours: number; median_hours: number }
}

// ---------------------------------------------------------------------------
// 1. Dashboard PDF (print-based)
// ---------------------------------------------------------------------------

/**
 * Generate a printable PDF view of the dashboard summary.
 * Opens a new window with styled HTML and triggers window.print().
 */
export function exportDashboardPDF(
  data: DashboardExportData,
  dateRange?: { start: string; end: string }
): void {
  const rangeLabel = dateRange
    ? formatDateRange(dateRange.start, dateRange.end)
    : `As of ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`

  const teamRows = data.teamPerformance
    .map(
      (m) => `
    <tr>
      <td>${m.name}</td>
      <td>${m.sub_role === 'ACCOUNTS_MANAGER' ? 'Manager' : 'Executive'}</td>
      <td style="text-align:center">${m.today.picked_up}</td>
      <td style="text-align:center">${m.today.verified}</td>
      <td style="text-align:center">${m.today.rejected}</td>
      <td style="text-align:center">${m.monthly.verified}</td>
      <td style="text-align:center">${m.monthly.rejected}</td>
    </tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Accounts Manager Dashboard Report</title>
  <style>
    @page { margin: 20mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #171717; padding: 16px; font-size: 13px; }
    h1 { color: #FF6700; font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 22px; font-weight: 700; margin-top: 2px; }
    h2 { font-size: 16px; color: #FF6700; margin-top: 24px; margin-bottom: 8px; border-bottom: 2px solid #FF6700; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #FF6700; color: #fff; padding: 8px 6px; text-align: left; }
    td { padding: 6px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 32px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>Accounts Manager Dashboard Report</h1>
  <p class="subtitle">${rangeLabel} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value">${data.stats.pending_total}</div></div>
    <div class="stat-card"><div class="stat-label">In Verification</div><div class="stat-value">${data.stats.in_progress_total}</div></div>
    <div class="stat-card"><div class="stat-label">Verified Today</div><div class="stat-value">${data.stats.verified_today_total}</div></div>
    <div class="stat-card"><div class="stat-label">Monthly Verified</div><div class="stat-value">${data.stats.monthly.total_verified}</div></div>
  </div>

  <h2>Quality Metrics</h2>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label">Approval Rate</div><div class="stat-value">${data.approvalMetrics.current_rate}%</div></div>
    <div class="stat-card"><div class="stat-label">MoM Change</div><div class="stat-value">${data.approvalMetrics.mom_change > 0 ? '+' : ''}${data.approvalMetrics.mom_change}%</div></div>
    <div class="stat-card"><div class="stat-label">Avg Processing</div><div class="stat-value">${data.processingTime.avg_hours}h</div></div>
    <div class="stat-card"><div class="stat-label">Median Processing</div><div class="stat-value">${data.processingTime.median_hours}h</div></div>
  </div>

  <h2>Financial Summary</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr><td>CP Payouts Pending</td><td style="text-align:right">${formatCurrencyINR(data.financial.cp_pending_amount)}</td></tr>
      <tr><td>BA Commission Pending</td><td style="text-align:right">${formatCurrencyINR(data.financial.ba_pending_amount)}</td></tr>
      <tr><td>BP Commission Pending</td><td style="text-align:right">${formatCurrencyINR(data.financial.bp_pending_amount)}</td></tr>
      <tr style="font-weight:700"><td>Total Pending</td><td style="text-align:right">${formatCurrencyINR(data.financial.total_pending_amount)}</td></tr>
    </tbody>
  </table>

  <h2>Team Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th><th>Role</th>
        <th style="text-align:center">Today Picked</th>
        <th style="text-align:center">Today Verified</th>
        <th style="text-align:center">Today Rejected</th>
        <th style="text-align:center">Monthly Verified</th>
        <th style="text-align:center">Monthly Rejected</th>
      </tr>
    </thead>
    <tbody>${teamRows || '<tr><td colspan="7" style="text-align:center;color:#999">No team data</td></tr>'}</tbody>
  </table>

  <div class="footer">LOANZ 360 &mdash; Confidential Report</div>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

// ---------------------------------------------------------------------------
// 2. Team Performance CSV
// ---------------------------------------------------------------------------

export function exportTeamPerformanceCSV(team: TeamMemberExport[]): void {
  const headers = [
    'Name',
    'Role',
    'Today Picked Up',
    'Today Verified',
    'Today Rejected',
    'Monthly Verified',
    'Monthly Rejected',
    'Last Active',
  ]

  const formatLastActive = (dateStr: string | null): string => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const rows = team.map((m) =>
    [
      escapeCSV(m.name),
      escapeCSV(m.sub_role === 'ACCOUNTS_MANAGER' ? 'Manager' : 'Executive'),
      m.today.picked_up,
      m.today.verified,
      m.today.rejected,
      m.monthly.verified,
      m.monthly.rejected,
      escapeCSV(formatLastActive(m.last_login_at)),
    ].join(',')
  )

  const csv = [headers.map((h) => escapeCSV(h)).join(','), ...rows].join('\n')
  downloadCSV(`team-performance-${dateStamp()}.csv`, csv)
}

// ---------------------------------------------------------------------------
// 3. Financial Report CSV
// ---------------------------------------------------------------------------

export function exportFinancialReportCSV(financial: FinancialExport[]): void {
  const headers = [
    'Partner Type',
    'Pending Count',
    'Pending Amount',
    'Verified This Month',
    'Avg Processing Time (hrs)',
  ]

  const rows = financial.map((f) =>
    [
      escapeCSV(f.partner_type),
      f.pending_count,
      f.pending_amount,
      f.verified_this_month,
      f.avg_processing_time,
    ].join(',')
  )

  const csv = [headers.map((h) => escapeCSV(h)).join(','), ...rows].join('\n')
  downloadCSV(`financial-report-${dateStamp()}.csv`, csv)
}

// ---------------------------------------------------------------------------
// 4. Analytics CSV
// ---------------------------------------------------------------------------

export function exportAnalyticsCSV(analytics: AnalyticsPoint[]): void {
  const headers = ['Date', 'Verified', 'Rejected', 'Total', 'Accuracy Rate (%)']

  const rows = analytics.map((a) => {
    const total = a.verified + a.rejected
    const accuracy = total > 0 ? ((a.verified / total) * 100).toFixed(1) : '0.0'
    return [
      escapeCSV(
        new Date(a.date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      ),
      a.verified,
      a.rejected,
      total,
      accuracy,
    ].join(',')
  })

  const csv = [headers.map((h) => escapeCSV(h)).join(','), ...rows].join('\n')
  downloadCSV(`analytics-data-${dateStamp()}.csv`, csv)
}
