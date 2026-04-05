'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  ShieldAlert, IndianRupee, AlertTriangle, AlertOctagon, Info,
  Search, Filter, ChevronDown, ChevronUp, ExternalLink,
  XCircle, Loader2, RefreshCw, Eye, X,
} from 'lucide-react'

interface LeakageAlert {
  id: string
  type: 'low_commission' | 'unprocessed' | 'duplicate' | 'delayed'
  severity: 'critical' | 'warning' | 'info'
  app_id: string
  partner_type: string
  description: string
  amount: number
  expected_amount: number
  created_at: string
  recommended_action: string
}

interface LeakageSummary {
  total_alerts: number
  potential_leakage_amount: number
  critical_count: number
  warning_count: number
}

interface Props {
  className?: string
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: <AlertOctagon className="w-4 h-4" />, label: 'Critical' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: <AlertTriangle className="w-4 h-4" />, label: 'Warning' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: <Info className="w-4 h-4" />, label: 'Info' },
}

const TYPE_LABELS: Record<string, string> = {
  low_commission: 'Low Commission',
  unprocessed: 'Unprocessed Payout',
  duplicate: 'Possible Duplicate',
  delayed: 'Delayed Processing',
}

const TYPE_COLORS: Record<string, string> = {
  low_commission: 'text-yellow-400',
  unprocessed: 'text-red-400',
  duplicate: 'text-purple-400',
  delayed: 'text-blue-400',
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

export default function RevenueLeakageDetector({ className = '' }: Props) {
  const [alerts, setAlerts] = useState<LeakageAlert[]>([])
  const [summary, setSummary] = useState<LeakageSummary>({ total_alerts: 0, potential_leakage_amount: 0, critical_count: 0, warning_count: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  // Filters
  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/employees/accounts-manager/revenue-leakage')
      const json = await res.json()

      if (!json.success) {
        setError(json.error || 'Failed to load revenue leakage data')
        return
      }

      setAlerts(json.data.alerts)
      setSummary(json.data.summary)
      setLastRefresh(new Date())
    } catch {
      setError('Failed to load revenue leakage data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }, [])

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (dismissedIds.has(a.id)) return false
      if (severityFilter && a.severity !== severityFilter) return false
      if (typeFilter && a.type !== typeFilter) return false
      return true
    })
  }, [alerts, dismissedIds, severityFilter, typeFilter])

  // Group by type
  const groupedAlerts = useMemo(() => {
    const groups: Record<string, LeakageAlert[]> = {}
    for (const alert of filteredAlerts) {
      if (!groups[alert.type]) groups[alert.type] = []
      groups[alert.type].push(alert)
    }
    return groups
  }, [filteredAlerts])

  const activeAlertCount = alerts.length - dismissedIds.size

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10">
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-poppins">Revenue Leakage Detection</h1>
            <p className="text-sm text-gray-400">
              Last refreshed: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              {' '}(auto-refreshes every 5 min)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:border-orange-500/40 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="frosted-card p-4 rounded-lg border border-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Total Alerts</p>
          <p className="text-2xl font-bold text-white mt-1">{activeAlertCount}</p>
        </div>
        <div className="frosted-card p-4 rounded-lg border border-red-500/20">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Potential Leakage</p>
          <p className="text-2xl font-bold text-white mt-1">
            <span className="text-red-400">&#8377;</span> {formatCurrency(summary.potential_leakage_amount)}
          </p>
        </div>
        <div className="frosted-card p-4 rounded-lg border border-red-500/30">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider">Critical</p>
          </div>
          <p className="text-2xl font-bold text-red-400 mt-1">{summary.critical_count}</p>
        </div>
        <div className="frosted-card p-4 rounded-lg border border-amber-500/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-gray-400 uppercase tracking-wider">Warnings</p>
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-1">{summary.warning_count}</p>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="frosted-card p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Severity</label>
              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white focus:border-orange-500/40 focus:outline-none"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Alert Type</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800 text-sm text-white focus:border-orange-500/40 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="low_commission">Low Commission</option>
                <option value="unprocessed">Unprocessed Payout</option>
                <option value="duplicate">Possible Duplicate</option>
                <option value="delayed">Delayed Processing</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => { setSeverityFilter(''); setTypeFilter('') }}
              className="text-xs text-gray-400 hover:text-orange-400 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && alerts.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="frosted-card p-6 rounded-lg text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchData} className="mt-3 text-sm text-orange-400 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredAlerts.length === 0 && (
        <div className="frosted-card p-12 rounded-lg text-center">
          <ShieldAlert className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-emerald-400 text-sm font-semibold">No Revenue Leakage Detected</p>
          <p className="text-gray-500 text-xs mt-1">All applications are within expected parameters</p>
        </div>
      )}

      {/* Alerts grouped by type */}
      {!error && filteredAlerts.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedAlerts).map(([type, typeAlerts]) => (
            <div key={type} className="space-y-3">
              {/* Group header */}
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${TYPE_COLORS[type] || 'text-gray-400'} font-poppins`}>
                  {TYPE_LABELS[type] || type}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">
                  {typeAlerts.length}
                </span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Alert cards */}
              {typeAlerts.map((alert) => {
                const severity = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info
                return (
                  <div
                    key={alert.id}
                    className={`frosted-card p-4 rounded-lg border ${severity.border} hover:border-opacity-60 transition-all`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg ${severity.bg} flex-shrink-0 mt-0.5`}>
                          <span className={severity.text}>{severity.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Top line */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${severity.bg} ${severity.text}`}>
                              {severity.label}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-400 font-mono">
                              {alert.partner_type}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">
                              {alert.app_id}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-gray-300 mt-2">{alert.description}</p>

                          {/* Amount info */}
                          {(alert.amount > 0 || alert.expected_amount > 0) && (
                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                              {alert.amount > 0 && (
                                <span className="text-xs text-gray-400">
                                  Amount: <span className="text-white font-semibold">&#8377;{formatCurrency(alert.amount)}</span>
                                </span>
                              )}
                              {alert.expected_amount > 0 && alert.type === 'low_commission' && (
                                <span className="text-xs text-gray-400">
                                  Expected: <span className="text-emerald-400 font-semibold">&#8377;{formatCurrency(alert.expected_amount)}</span>
                                </span>
                              )}
                              {alert.type === 'low_commission' && alert.expected_amount > alert.amount && (
                                <span className="text-xs text-red-400 font-semibold">
                                  Gap: &#8377;{formatCurrency(alert.expected_amount - alert.amount)}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Recommended action */}
                          <div className="mt-3 px-3 py-2 rounded bg-gray-900/50 border border-gray-800">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Recommended Action</p>
                            <p className="text-xs text-gray-300">{alert.recommended_action}</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            // Navigate to application detail based on partner type
                            const basePath = alert.partner_type === 'CP'
                              ? '/employees/accounts-manager/cp-applications'
                              : alert.partner_type === 'BA'
                              ? '/employees/accounts-manager/ba-applications'
                              : '/employees/accounts-manager/bp-applications'
                            window.location.href = basePath
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20 transition-colors"
                          title="Investigate this alert"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Investigate
                        </button>
                        <button
                          onClick={() => handleDismiss(alert.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:border-gray-600 transition-colors"
                          title="Dismiss this alert"
                        >
                          <X className="w-3.5 h-3.5" />
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
