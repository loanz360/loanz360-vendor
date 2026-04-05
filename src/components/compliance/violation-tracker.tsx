'use client'

/**
 * Violation Tracker Component
 * Violation workflow, risk scoring, assignment, resolution
 */

import { useState, useEffect } from 'react'
import type { PolicyViolation } from '@/lib/compliance/compliance-types'
import { getSeverityBadge, getViolationStatusColor, getRiskScoreColor } from '@/lib/compliance/compliance-service'

export default function ViolationTracker() {
  const [violations, setViolations] = useState<PolicyViolation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedViolation, setSelectedViolation] = useState<PolicyViolation | null>(null)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  const fetchViolations = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (severityFilter !== 'all') params.append('severity', severityFilter)

      const response = await fetch(`/api/compliance/violations?${params}`)
      const data = await response.json()

      if (data.success) {
        setViolations(data.violations)
      }
    } catch (error) {
      console.error('Failed to fetch violations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchViolations()
  }, [statusFilter, severityFilter])

  const updateViolationStatus = async (violationId: string, status: string, notes?: string) => {
    try {
      const response = await fetch('/api/compliance/violations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violationId,
          status,
          resolutionNotes: notes,
          resolvedBy: status === 'resolved' ? 'current-admin-id' : undefined, // TODO: Get from session
        }),
      })

      const data = await response.json()
      if (data.success) {
        setViolations(violations.map(v =>
          v.id === violationId ? data.violation : v
        ))
        setShowResolveModal(false)
        setResolutionNotes('')
      }
    } catch (error) {
      console.error('Failed to update violation:', error)
    }
  }

  const openResolveModal = (violation: PolicyViolation) => {
    setSelectedViolation(violation)
    setShowResolveModal(true)
  }

  const getStats = () => {
    const total = violations.length
    const open = violations.filter(v => v.status === 'open').length
    const critical = violations.filter(v => v.severity === 'critical').length
    const avgRisk = violations.length > 0
      ? (violations.reduce((sum, v) => sum + (v.risk_score || 0), 0) / violations.length).toFixed(0)
      : 0
    return { total, open, critical, avgRisk }
  }

  const stats = getStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Violation Tracker</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor and resolve policy violations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Total Violations</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Open</div>
          <div className="text-3xl font-bold text-red-600">{stats.open}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Critical</div>
          <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Avg Risk Score</div>
          <div className={`text-3xl font-bold ${getRiskScoreColor(Number(stats.avgRisk))}`}>
            {stats.avgRisk}/100
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
              <option value="accepted_risk">Accepted Risk</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Severity:</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Violations List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : violations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No violations found
        </div>
      ) : (
        <div className="space-y-4">
          {violations.map((violation) => (
            <div key={violation.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityBadge(violation.severity)}`}>
                      {violation.severity.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getViolationStatusColor(violation.status)}`}>
                      {violation.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {violation.violation_type}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {violation.description}
                  </h3>

                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                    <div>
                      <span className="font-medium">Detected:</span>{' '}
                      {new Date(violation.detected_at).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium">Detection Method:</span>{' '}
                      {violation.detection_method}
                    </div>
                    {violation.admin_id && (
                      <div>
                        <span className="font-medium">Admin ID:</span> {violation.admin_id.substring(0, 8)}...
                      </div>
                    )}
                    {violation.resource_type && (
                      <div>
                        <span className="font-medium">Resource:</span> {violation.resource_type}
                      </div>
                    )}
                  </div>

                  {/* Risk Gauge */}
                  {violation.risk_score !== null && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Risk Score</span>
                        <span className={`font-bold ${getRiskScoreColor(violation.risk_score)}`}>
                          {violation.risk_score}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            violation.risk_score >= 75 ? 'bg-red-600' :
                            violation.risk_score >= 50 ? 'bg-orange-600' :
                            violation.risk_score >= 25 ? 'bg-yellow-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${violation.risk_score}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Resolution Notes */}
                  {violation.resolution_notes && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                      <strong>Resolution:</strong> {violation.resolution_notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  {violation.status === 'open' && (
                    <>
                      <button
                        onClick={() => updateViolationStatus(violation.id, 'investigating')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                      >
                        Investigate
                      </button>
                      <button
                        onClick={() => openResolveModal(violation)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => updateViolationStatus(violation.id, 'false_positive')}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                      >
                        False Positive
                      </button>
                    </>
                  )}
                  {violation.status === 'investigating' && (
                    <button
                      onClick={() => openResolveModal(violation)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedViolation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Resolve Violation</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Describe how this violation was resolved..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateViolationStatus(selectedViolation.id, 'resolved', resolutionNotes)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={!resolutionNotes}
                >
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
