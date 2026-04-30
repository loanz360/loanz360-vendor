'use client'

import { toast } from 'sonner'

/**
 * Report Builder Component
 * Custom report builder, template selector, scheduling
 */

import { useState, useEffect } from 'react'
import type { ComplianceReport } from '@/lib/compliance/compliance-types'

const REPORT_TEMPLATES = [
  { id: 'soc2_audit', name: 'SOC 2 Access Control Audit', framework: 'soc2', category: 'Access Control' },
  { id: 'soc2_change', name: 'SOC 2 Change Management Log', framework: 'soc2', category: 'Change Management' },
  { id: 'soc2_incident', name: 'SOC 2 Incident Response Summary', framework: 'soc2', category: 'Incident Response' },
  { id: 'soc2_availability', name: 'SOC 2 System Availability Report', framework: 'soc2', category: 'Availability' },
  { id: 'iso_security', name: 'ISO 27001 Information Security Review', framework: 'iso27001', category: 'Security' },
  { id: 'iso_risk', name: 'ISO 27001 Risk Assessment Summary', framework: 'iso27001', category: 'Risk' },
  { id: 'iso_access', name: 'ISO 27001 Access Rights Review', framework: 'iso27001', category: 'Access Control' },
  { id: 'gdpr_dsar', name: 'GDPR Data Subject Access Request', framework: 'gdpr', category: 'Data Rights' },
  { id: 'gdpr_consent', name: 'GDPR Consent Management Report', framework: 'gdpr', category: 'Consent' },
  { id: 'gdpr_breach', name: 'GDPR Data Breach Register', framework: 'gdpr', category: 'Breach' },
  { id: 'failed_logins', name: 'Failed Login Attempts', framework: 'operational', category: 'Security' },
  { id: 'privilege_escalation', name: 'Privilege Escalation Log', framework: 'operational', category: 'Security' },
  { id: 'data_export', name: 'Data Export Activity', framework: 'operational', category: 'Data' },
  { id: 'policy_violations', name: 'Policy Violation Summary', framework: 'operational', category: 'Compliance' },
  { id: 'compliance_trends', name: 'Compliance Score Trends', framework: 'operational', category: 'Compliance' },
]

export default function ReportBuilder() {
  const [reports, setReports] = useState<ComplianceReport[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [framework, setFramework] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv' | 'json'>('pdf')
  const [includeEvidence, setIncludeEvidence] = useState(false)

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/compliance/reports')
      const data = await response.json()

      if (data.success) {
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const generateReport = async () => {
    if (!selectedTemplate || !periodStart || !periodEnd) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      setGenerating(true)
      const response = await fetch('/api/compliance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selectedTemplate,
          framework,
          periodStart,
          periodEnd,
          exportFormat,
          includeEvidence,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.info(`Report generation started! Report ID: ${data.reportId}`)
        fetchReports()
        // Reset form
        setSelectedTemplate('')
        setFramework('')
        setPeriodStart('')
        setPeriodEnd('')
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId)
    const template = REPORT_TEMPLATES.find(t => t.id === templateId)
    if (template && template.framework !== 'operational') {
      setFramework(template.framework)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generate compliance reports from pre-built templates
        </p>
      </div>

      {/* Report Builder Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Report</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Template Selection */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Template *
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a template...</option>
              <optgroup label="SOC 2 Reports">
                {REPORT_TEMPLATES.filter(t => t.framework === 'soc2').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="ISO 27001 Reports">
                {REPORT_TEMPLATES.filter(t => t.framework === 'iso27001').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="GDPR Reports">
                {REPORT_TEMPLATES.filter(t => t.framework === 'gdpr').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="Operational Reports">
                {REPORT_TEMPLATES.filter(t => t.framework === 'operational').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Framework (auto-filled) */}
          {framework && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Framework
              </label>
              <input
                type="text"
                value={framework.toUpperCase()}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
              />
            </div>
          )}

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period Start *
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period End *
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as unknown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>

          {/* Options */}
          <div className="col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeEvidence}
                onChange={(e) => setIncludeEvidence(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">
                Include evidence attachments
              </span>
            </label>
          </div>

          {/* Generate Button */}
          <div className="col-span-2">
            <button
              onClick={generateReport}
              disabled={generating || !selectedTemplate || !periodStart || !periodEnd}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Generated Reports List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Generated Reports</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No reports generated yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {reports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-600">{report.report_code}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        report.status === 'completed' ? 'bg-green-600 text-white' :
                        report.status === 'generating' ? 'bg-blue-600 text-white' :
                        report.status === 'failed' ? 'bg-red-600 text-white' :
                        'bg-yellow-600 text-white'
                      }`}>
                        {report.status.toUpperCase()}
                      </span>
                      {report.framework && (
                        <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-semibold">
                          {report.framework.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{report.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{report.description}</p>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Period: {report.period_start} to {report.period_end}</span>
                      {report.compliance_score !== null && (
                        <span className="font-semibold">
                          Score: {report.compliance_score.toFixed(1)}%
                        </span>
                      )}
                      {report.export_format && (
                        <span>Format: {report.export_format.toUpperCase()}</span>
                      )}
                    </div>

                    {report.status === 'completed' && (
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Events:</span>{' '}
                          <span className="font-semibold">{report.total_events}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Compliant:</span>{' '}
                          <span className="font-semibold text-green-600">{report.compliant_events}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Non-Compliant:</span>{' '}
                          <span className="font-semibold text-red-600">{report.non_compliant_events}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-4">
                    {report.status === 'completed' && report.export_path && (
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                        Download
                      </button>
                    )}
                    {report.status === 'failed' && (
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
