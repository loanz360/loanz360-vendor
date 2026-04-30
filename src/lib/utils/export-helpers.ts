/**
 * Export Utilities - CSV, Excel (HTML-table), PDF (print dialog)
 * Brand: LOANZ 360 (Orange #FF6700, Ash Gray #171717, Poppins font)
 */

/**
 * Convert JSON data to CSV format
 */
export function jsonToCSV(data: unknown[], columns?: string[]): string {
  if (!data || data.length === 0) return ''

  // Get columns from data keys if not provided
  const cols = columns || Object.keys(data[0])

  // Create header row
  const header = cols.join(',')

  // Create data rows
  const rows = data.map(row => {
    return cols.map(col => {
      let value = row[col]

      // Handle nested objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value)
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        value = ''
      }

      // Escape quotes and wrap in quotes if contains comma
      value = String(value).replace(/"/g, '""')
      if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        value = `"${value}"`
      }

      return value
    }).join(',')
  })

  return [header, ...rows].join('\n')
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: unknown[], filename: string, columns?: string[]) {
  const csv = jsonToCSV(data, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Generate Excel (XLSX) file
 * Note: This is a simplified version. For production, use libraries like 'xlsx' or 'exceljs'
 */
export function generateExcelXML(data: unknown[], sheetName: string = 'Sheet1'): string {
  if (!data || data.length === 0) return ''

  const cols = Object.keys(data[0])

  // Generate XML for Excel
  let xml = '<?xml version="1.0"?>\n'
  xml += '<?mso-application progid="Excel.Sheet"?>\n'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'
  xml += ` <Worksheet ss:Name="${sheetName}">\n`
  xml += '  <Table>\n'

  // Header row
  xml += '   <Row>\n'
  cols.forEach(col => {
    xml += `    <Cell><Data ss:Type="String">${escapeXML(col)}</Data></Cell>\n`
  })
  xml += '   </Row>\n'

  // Data rows
  data.forEach(row => {
    xml += '   <Row>\n'
    cols.forEach(col => {
      const value = row[col]
      const type = typeof value === 'number' ? 'Number' : 'String'
      const displayValue = value !== null && value !== undefined
        ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
        : ''

      xml += `    <Cell><Data ss:Type="${type}">${escapeXML(displayValue)}</Data></Cell>\n`
    })
    xml += '   </Row>\n'
  })

  xml += '  </Table>\n'
  xml += ' </Worksheet>\n'
  xml += '</Workbook>\n'

  return xml
}

/**
 * Export data as a formatted HTML table that can be opened in Excel
 * Uses HTML table format which Excel natively supports with LOANZ 360 branding
 * (no external library needed)
 */
export function downloadExcel(data: Record<string, unknown>[] | any[], filename: string, sheetTitle?: string): void {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const title = sheetTitle || filename.replace(/[^a-zA-Z0-9]/g, ' ')

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHtml(title)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; }
  th { background-color: #FF6700; color: white; font-weight: bold; padding: 8px 12px; border: 1px solid #ddd; font-family: Poppins, Arial; }
  td { padding: 6px 12px; border: 1px solid #ddd; font-family: Poppins, Arial; }
  tr:nth-child(even) td { background-color: #f9f9f9; }
  .title { font-size: 16px; font-weight: bold; font-family: Poppins, Arial; color: #171717; padding: 10px 0; }
  .generated { font-size: 10px; color: #999; padding: 5px 0; }
</style>
</head>
<body>
<div class="title">${escapeHtml(title)}</div>
<div class="generated">Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}</div>
<table>
<thead><tr>${headers.map(h => `<th>${escapeHtml(formatHeader(h))}</th>`).join('')}</tr></thead>
<tbody>
${data.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</body></html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export data as a printable PDF (opens browser print dialog)
 * Generates a branded print-ready document with LOANZ 360 styling
 */
export function downloadPDF(data: Record<string, unknown>[] | any[], filename: string, options?: { title?: string; orientation?: 'portrait' | 'landscape' }): void {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const title = options?.title || filename.replace(/[^a-zA-Z0-9]/g, ' ')
  const orientation = options?.orientation || (headers.length > 6 ? 'landscape' : 'portrait')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: ${orientation}; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #FF6700; padding-bottom: 10px; margin-bottom: 15px; }
  .title { font-size: 18px; font-weight: bold; color: #171717; }
  .meta { font-size: 9px; color: #999; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #171717; color: white; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px; border-bottom: 1px solid #eee; font-size: 10px; }
  tr:nth-child(even) td { background: #f8f8f8; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 8px; color: #999; text-align: center; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head><body>
<div class="header">
  <div class="title">${escapeHtml(title)}</div>
  <div class="meta">Generated: ${new Date().toLocaleDateString('en-IN')} | Total Records: ${data.length}</div>
</div>
<table>
<thead><tr>${headers.map(h => `<th>${escapeHtml(formatHeader(h))}</th>`).join('')}</tr></thead>
<tbody>
${data.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
<div class="footer">LOANZ 360 - Confidential | Page <span class="page-number"></span></div>
</body></html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Format a camelCase or snake_case key into a readable header
 */
function formatHeader(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format audit log for export
 */
export function formatAuditLogForExport(logs: unknown[]): unknown[] {
  return logs.map(log => ({
    'Audit ID': log.id,
    'Admin ID': log.admin_unique_id || log.admin_id,
    'Admin Name': log.admin_name || '',
    'Action Type': log.action_type,
    'Action Description': log.action_description,
    'Performed By': log.performed_by_name || log.performed_by,
    'IP Address': log.ip_address,
    'User Agent': log.user_agent,
    'Performed At': new Date(log.performed_at).toLocaleString(),
    'Changes': typeof log.changes === 'object' ? JSON.stringify(log.changes) : log.changes
  }))
}

/**
 * Format session data for export
 */
export function formatSessionsForExport(sessions: unknown[]): unknown[] {
  return sessions.map(session => ({
    'Session ID': session.id,
    'Admin ID': session.admin_unique_id || session.admin_id,
    'Device Name': session.device_name,
    'Browser': session.browser,
    'OS': session.os,
    'Device Type': session.device_type,
    'IP Address': session.ip_address,
    'Location': session.ip_location || '',
    'Status': session.is_active ? 'Active' : 'Terminated',
    'Risk Score': session.risk_score,
    'Suspicious': session.is_suspicious ? 'Yes' : 'No',
    'Created At': new Date(session.created_at).toLocaleString(),
    'Last Activity': new Date(session.last_activity_at).toLocaleString(),
    'Expires At': new Date(session.expires_at).toLocaleString(),
    'Terminated At': session.terminated_at ? new Date(session.terminated_at).toLocaleString() : '',
    'Termination Reason': session.termination_reason || ''
  }))
}

/**
 * Format admin list for export
 */
export function formatAdminsForExport(admins: unknown[]): unknown[] {
  return admins.map(admin => ({
    'Admin ID': admin.admin_unique_id,
    'Full Name': admin.full_name,
    'Email': admin.email,
    'Mobile Number': admin.mobile_number,
    'Location': admin.location,
    'Status': admin.status,
    'Enabled Modules': admin.enabled_modules_count || 0,
    '2FA Enabled': admin.two_factor_enabled ? 'Yes' : 'No',
    'Created At': new Date(admin.created_at).toLocaleString(),
    'Last Login': admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : 'Never'
  }))
}

/**
 * Generate filename with timestamp
 */
export function generateExportFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  return `${prefix}_${timestamp}`
}

/**
 * Batch download (zip multiple files)
 * Note: Requires JSZip library for production
 */
export async function downloadMultipleFiles(files: { name: string, content: string, type: string }[]) {
  // For now, download one by one
  // In production, use JSZip to create a zip file
  for (const file of files) {
    const blob = new Blob([file.content], { type: file.type })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', file.name)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Small delay between downloads
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}
