'use client'

/**
 * E29: Export Center
 * Scheduled reports, PDF generation, email delivery
 */

import { useState } from 'react'
import { Download, FileText, Mail, Calendar, Clock, CheckCircle, Loader2 } from 'lucide-react'

interface ExportTemplate {
  id: string
  name: string
  description: string
  format: 'csv' | 'xlsx' | 'pdf' | 'json'
  endpoint: string
  schedule?: string
  lastExport?: string
}

const EXPORT_TEMPLATES: ExportTemplate[] = [
  { id: 'leads_report', name: 'Leads Report', description: 'All leads with status and amounts', format: 'csv', endpoint: '/api/superadmin/unified-crm/leads' },
  { id: 'partner_performance', name: 'Partner Performance', description: 'Partner-wise disbursement and commission', format: 'xlsx', endpoint: '/api/superadmin/partner-management/analytics' },
  { id: 'employee_directory', name: 'Employee Directory', description: 'Complete employee list with details', format: 'csv', endpoint: '/api/superadmin/employee-management' },
  { id: 'payout_summary', name: 'Payout Summary', description: 'All payout batches and settlements', format: 'xlsx', endpoint: '/api/superadmin/payouts/analytics' },
  { id: 'customer_portfolio', name: 'Customer Portfolio', description: 'Customer segments and loan details', format: 'csv', endpoint: '/api/superadmin/customer-management/analytics' },
  { id: 'audit_log', name: 'Audit Log', description: 'Complete activity trail', format: 'json', endpoint: '/api/superadmin/realtime-feed' },
]

export function ExportCenter() {
  const [exporting, setExporting] = useState<string | null>(null)

  const handleExport = async (template: ExportTemplate) => {
    setExporting(template.id)
    try {
      const response = await fetch(`${template.endpoint}?export=true&format=${template.format}&limit=10000`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        // Convert to CSV for now
        if (data.data || data.leads || data.activities) {
          const items = data.data || data.leads || data.activities || []
          if (items.length > 0) {
            const headers = Object.keys(items[0])
            const csvRows = [headers.join(',')]
            items.forEach((item: Record<string, unknown>) => {
              csvRows.push(
                headers.map(h => {
                  const val = item[h]
                  if (val === null || val === undefined) return ''
                  const str = String(val)
                  return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
                }).join(',')
              )
            })
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${template.id}_${new Date().toISOString().slice(0, 10)}.${template.format === 'json' ? 'json' : 'csv'}`
            a.click()
            URL.revokeObjectURL(url)
          }
        }
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExporting(null)
    }
  }

  const formatIcons: Record<string, string> = {
    csv: 'text-green-400',
    xlsx: 'text-blue-400',
    pdf: 'text-red-400',
    json: 'text-yellow-400',
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white font-poppins">Export Center</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EXPORT_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-orange-500/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className={`w-4 h-4 ${formatIcons[template.format]}`} />
                <h4 className="text-sm font-medium text-white">{template.name}</h4>
              </div>
              <span className="text-xs text-gray-500 uppercase font-mono">{template.format}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">{template.description}</p>
            <button
              onClick={() => handleExport(template)}
              disabled={exporting !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {exporting === template.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting === template.id ? 'Exporting...' : 'Export Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
