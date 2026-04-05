'use client'

/**
 * Compliance Dashboard Component
 * Main dashboard showing compliance status across all frameworks
 */

import { useState, useEffect } from 'react'
import type { ComplianceDashboardStats } from '@/lib/compliance/compliance-types'
import {
  getComplianceScoreColor,
  formatComplianceScore,
  getSeverityBadge,
  getFrameworkColor,
} from '@/lib/compliance/compliance-service'

export default function ComplianceDashboard() {
  const [stats, setStats] = useState<ComplianceDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/compliance/dashboard')
      const data = await response.json()

      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch compliance stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading compliance dashboard...</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-gray-500">
        Failed to load compliance dashboard
      </div>
    )
  }

  const { audit_summary, violation_summary, review_summary, framework_compliance, evidence_summary, report_summary } = stats

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enterprise compliance monitoring and reporting
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overall Compliance Score */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-lg font-semibold mb-4">Overall Compliance Score</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-5xl font-bold">
              {report_summary.avg_compliance_score?.toFixed(1) || 'N/A'}%
            </div>
            <div className="mt-2 text-sm opacity-90">
              {formatComplianceScore(report_summary.avg_compliance_score || 0)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90">Total Reports</div>
            <div className="text-2xl font-semibold">{report_summary.total_reports}</div>
            <div className="text-xs opacity-75 mt-1">
              {report_summary.recent_reports} this month
            </div>
          </div>
        </div>
      </div>

      {/* Framework Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {framework_compliance.map((framework) => (
          <div key={framework.framework} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getFrameworkColor(framework.framework)}`}>
                {framework.framework.toUpperCase()}
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {framework.enforcement_rate.toFixed(0)}%
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Policies:</span>
                <span className="font-semibold">{framework.total_policies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active:</span>
                <span className="font-semibold text-green-600">{framework.active_policies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Enforced:</span>
                <span className="font-semibold text-blue-600">{framework.enforced_policies}</span>
              </div>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${framework.enforcement_rate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Audit Events */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Audit Events (30d)</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{audit_summary.total_events.toLocaleString()}</div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-600 font-semibold">{audit_summary.events_last_24h}</span>
            <span className="text-gray-600 ml-1">in last 24h</span>
          </div>
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Success:</span>
              <span className="text-green-600">{audit_summary.successful_events}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Failed:</span>
              <span className="text-red-600">{audit_summary.failed_events}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Blocked:</span>
              <span className="text-orange-600">{audit_summary.blocked_events}</span>
            </div>
          </div>
        </div>

        {/* Violations */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Policy Violations</h3>
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{violation_summary.total_violations}</div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-red-600 font-semibold">{violation_summary.violations_last_24h}</span>
            <span className="text-gray-600 ml-1">in last 24h</span>
          </div>
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Open:</span>
              <span className="text-red-600">{violation_summary.open_violations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Critical:</span>
              <span className="text-red-600 font-bold">{violation_summary.critical_violations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Risk:</span>
              <span>{violation_summary.avg_risk_score?.toFixed(0) || 0}/100</span>
            </div>
          </div>
        </div>

        {/* Access Reviews */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Access Reviews</h3>
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{review_summary.total_reviews}</div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-green-600 font-semibold">{review_summary.completed_reviews}</span>
            <span className="text-gray-600 ml-1">completed</span>
          </div>
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Pending:</span>
              <span className="text-yellow-600">{review_summary.pending_reviews}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Overdue:</span>
              <span className="text-red-600">{review_summary.overdue_reviews}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Findings:</span>
              <span>{review_summary.total_findings}</span>
            </div>
          </div>
        </div>

        {/* Evidence Vault */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Evidence Vault</h3>
            <span className="text-2xl">🔒</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{evidence_summary.total_evidence}</div>
          <div className="mt-2 flex items-center text-sm">
            <span className="text-blue-600 font-semibold">{evidence_summary.recent_uploads}</span>
            <span className="text-gray-600 ml-1">recent uploads</span>
          </div>
          <div className="mt-4 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Storage:</span>
              <span>{(evidence_summary.total_storage_bytes / 1024 / 1024 / 1024).toFixed(2)} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Types:</span>
              <span>{evidence_summary.evidence_types_count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a
            href="/compliance/audit-log"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <span className="text-2xl">📋</span>
            <div>
              <div className="font-medium text-gray-900">View Audit Log</div>
              <div className="text-xs text-gray-500">Browse all events</div>
            </div>
          </a>
          <a
            href="/compliance/policies"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <span className="text-2xl">📜</span>
            <div>
              <div className="font-medium text-gray-900">Manage Policies</div>
              <div className="text-xs text-gray-500">Configure enforcement</div>
            </div>
          </a>
          <a
            href="/compliance/violations"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-medium text-gray-900">View Violations</div>
              <div className="text-xs text-gray-500">{violation_summary.open_violations} open</div>
            </div>
          </a>
          <a
            href="/compliance/reports"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <span className="text-2xl">📊</span>
            <div>
              <div className="font-medium text-gray-900">Generate Report</div>
              <div className="text-xs text-gray-500">Compliance reports</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
