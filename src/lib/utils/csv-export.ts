/**
 * CSV Export Utility
 * Handles proper CSV generation with Indian locale formatting
 */
import { escapeCSVCell, formatDateIN } from '@/lib/utils/cro-helpers'

export interface ExportColumn {
  header: string
  accessor: string | ((row: Record<string, unknown>) => string)
}

/**
 * Export data to CSV file with proper escaping and BOM for Excel
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string
): void {
  if (data.length === 0) return

  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF'

  // Header row
  const headers = columns.map(c => escapeCSVCell(c.header)).join(',')

  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value: string
      if (typeof col.accessor === 'function') {
        value = col.accessor(row)
      } else {
        const raw = row[col.accessor]
        value = raw == null ? '' : String(raw)
      }
      return escapeCSVCell(value)
    }).join(',')
  })

  const csv = BOM + headers + '\n' + rows.join('\n')

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Format a date string for CSV export in IST
function formatDateForExport(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return formatDateIN(dateStr)
}

// Export column configs for each entity type
export const CONTACT_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Email', accessor: 'email' },
  { header: 'Status', accessor: (r) => (r.status || '').replace(/_/g, ' ') },
  { header: 'City', accessor: (r) => r.city || '' },
  { header: 'State', accessor: (r) => r.state || '' },
  { header: 'Loan Type', accessor: (r) => r.loan_type || '' },
  { header: 'Call Count', accessor: (r) => String(r.call_count || 0) },
  { header: 'Last Called', accessor: (r) => formatDateForExport(r.last_called_at) },
  { header: 'Assigned Date', accessor: (r) => formatDateForExport(r.assigned_at || r.created_at) },
]

export const LEAD_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Customer Name', accessor: 'customer_name' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Email', accessor: (r) => r.email || '' },
  { header: 'Loan Type', accessor: (r) => r.loan_type || '' },
  { header: 'Loan Amount', accessor: (r) => String(r.loan_amount || '') },
  { header: 'Status', accessor: (r) => (r.status || '').replace(/_/g, ' ') },
  { header: 'Stage', accessor: (r) => (r.stage || '').replace(/_/g, ' ') },
  { header: 'Lead Score', accessor: (r) => String(r.lead_score || '') },
  { header: 'Employment Type', accessor: (r) => r.employment_type || '' },
  { header: 'City', accessor: (r) => r.city || '' },
  { header: 'Created Date', accessor: (r) => formatDateForExport(r.created_at) },
]

export const DEAL_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Customer Name', accessor: 'customer_name' },
  { header: 'Phone', accessor: 'phone' },
  { header: 'Loan Type', accessor: (r) => r.loan_type || '' },
  { header: 'Loan Amount', accessor: (r) => String(r.loan_amount || '') },
  { header: 'Deal Value', accessor: (r) => String(r.deal_value || '') },
  { header: 'Status', accessor: (r) => (r.status || '').replace(/_/g, ' ') },
  { header: 'Stage', accessor: (r) => (r.stage || '').replace(/_/g, ' ') },
  { header: 'Expected Bank', accessor: (r) => r.expected_bank || '' },
  { header: 'Finalized Bank', accessor: (r) => r.finalized_bank || '' },
  { header: 'Created Date', accessor: (r) => formatDateForExport(r.created_at) },
]

export const FOLLOWUP_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Lead Name', accessor: (r) => r.lead?.customer_name || r.customer_name || '' },
  { header: 'Phone', accessor: (r) => r.lead?.phone || r.phone || '' },
  { header: 'Purpose', accessor: (r) => r.purpose || r.type || '' },
  { header: 'Status', accessor: (r) => r.status || '' },
  { header: 'Scheduled At', accessor: (r) => formatDateForExport(r.scheduled_at) },
  { header: 'Completed At', accessor: (r) => formatDateForExport(r.completed_at) },
  { header: 'Notes', accessor: (r) => r.notes || r.description || '' },
]
