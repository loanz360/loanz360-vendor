'use client'

/**
 * Audit Log Viewer Component
 * Advanced filtering, timeline view, before/after diff, export
 */

import { useState, useEffect } from 'react'
import type { AuditLogEntry } from '@/lib/compliance/compliance-types'
import { getSeverityBadge, formatTimeAgo } from '@/lib/compliance/compliance-service'

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [showDiffModal, setShowDiffModal] = useState(false)

  // Filters
  const [filters, setFilters] = useState({
    adminId: '',
    action: '',
    resourceType: '',
    severity: '',
    framework: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      })

      const response = await fetch(`/api/compliance/audit-log?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filters])

  const exportLogs = (format: 'csv' | 'json') => {
    const dataStr = format === 'json'
      ? JSON.stringify(logs, null, 2)
      : convertToCSV(logs)

    const blob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.${format}`
    link.click()
  }

  const convertToCSV = (data: AuditLogEntry[]) => {
    const headers = ['Sequence', 'Timestamp', 'Admin', 'Action', 'Resource', 'Status', 'Severity']
    const rows = data.map(log => [
      log.sequence_number,
      log.created_at,
      log.admin_email,
      log.action,
      log.resource_type || 'N/A',
      log.status,
      log.severity,
    ])
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const viewDiff = (log: AuditLogEntry) => {
    setSelectedLog(log)
    setShowDiffModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log Viewer</h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete audit trail with cryptographic verification
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportLogs('csv')}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportLogs('json')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Action (e.g. update_lead)"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Resource Type"
            value={filters.resourceType}
            onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={filters.framework}
            onChange={(e) => setFilters({ ...filters, framework: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Frameworks</option>
            <option value="soc2">SOC 2</option>
            <option value="iso27001">ISO 27001</option>
            <option value="gdpr">GDPR</option>
          </select>
          <input
            type="date"
            placeholder="Date From"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="date"
            placeholder="Date To"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            onClick={() => {
              setFilters({ adminId: '', action: '', resourceType: '', severity: '', framework: '', dateFrom: '', dateTo: '' })
              setPage(1)
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Timeline View */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Audit Events</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit logs found</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {logs.map((log) => (
              <div key={log.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">#{log.sequence_number}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityBadge(log.severity)}`}>
                        {log.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'success' ? 'bg-green-600 text-white' :
                        log.status === 'failure' ? 'bg-red-600 text-white' :
                        'bg-orange-600 text-white'
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                      {log.policy_violations.length > 0 && (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-600 text-white">
                          VIOLATION
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-900 font-medium mb-1">
                      {log.action}
                      {log.resource_type && (
                        <span className="text-gray-500 ml-2">
                          on {log.resource_type} {log.resource_id && `(${log.resource_id.substring(0, 8)}...)`}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      by {log.admin_email} {log.admin_role && `(${log.admin_role})`}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{formatTimeAgo(log.created_at)}</span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                      {log.compliance_frameworks.length > 0 && (
                        <span>Frameworks: {log.compliance_frameworks.join(', ').toUpperCase()}</span>
                      )}
                    </div>

                    {log.error_message && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {log.error_message}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {(log.before_state || log.after_state) && (
                      <button
                        onClick={() => viewDiff(log)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        View Diff
                      </button>
                    )}
                    <span className="text-xs text-gray-500 text-right">
                      Hash: {log.current_hash.substring(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      {showDiffModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Before/After State</h3>
              <button
                onClick={() => setShowDiffModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Before State</h4>
                  <pre className="p-4 bg-red-50 border border-red-200 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.before_state, null, 2) || 'No data'}
                  </pre>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">After State</h4>
                  <pre className="p-4 bg-green-50 border border-green-200 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.after_state, null, 2) || 'No data'}
                  </pre>
                </div>
              </div>
              {selectedLog.changes && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Changes</h4>
                  <pre className="p-4 bg-blue-50 border border-blue-200 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
