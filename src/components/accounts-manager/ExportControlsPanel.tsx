'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Download,
  FileText,
  FileSpreadsheet,
  BarChart3,
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  exportDashboardPDF,
  exportTeamPerformanceCSV,
  exportFinancialReportCSV,
  exportAnalyticsCSV,
  type DashboardExportData,
  type FinancialExport,
  type AnalyticsPoint,
} from '@/lib/utils/report-export'

interface ExportLogEntry {
  id: string
  user_id: string
  user_name: string
  export_type: string
  file_name: string
  record_count: number
  exported_at: string
}

interface Props {
  dashboardData?: any
}

type ExportType = 'pdf' | 'team' | 'financial' | 'analytics'

const EXPORT_OPTIONS: {
  type: ExportType
  label: string
  description: string
  format: string
  icon: typeof FileText
}[] = [
  { type: 'pdf', label: 'Dashboard Summary', description: 'Full dashboard overview', format: 'PDF', icon: FileText },
  { type: 'team', label: 'Team Performance', description: 'AE scorecards and metrics', format: 'CSV', icon: Users },
  { type: 'financial', label: 'Financial Report', description: 'Payout and revenue data', format: 'CSV', icon: FileSpreadsheet },
  { type: 'analytics', label: 'Analytics Data', description: 'Trend and pipeline data', format: 'CSV', icon: BarChart3 },
]

export default function ExportControlsPanel({ dashboardData }: Props) {
  const [exportLogs, setExportLogs] = useState<ExportLogEntry[]>([])
  const [dailyLimit, setDailyLimit] = useState(10)
  const [dailyUsed, setDailyUsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<ExportType | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const quotaPercent = dailyLimit > 0 ? Math.min((dailyUsed / dailyLimit) * 100, 100) : 0
  const isApproachingLimit = dailyUsed >= dailyLimit - 2
  const isLimitReached = dailyUsed >= dailyLimit

  const fetchExportLogs = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/employees/accounts-manager/export-log')
      const data = await response.json()

      if (response.ok && data.success) {
        setExportLogs(data.data.exports || [])
        setDailyLimit(data.data.daily_limit || 10)
        setDailyUsed(data.data.daily_used || 0)
      }
    } catch {
      // Silently handle - non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExportLogs()
  }, [fetchExportLogs])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const logExport = async (exportType: string, fileName: string, recordCount: number) => {
    try {
      const response = await fetch('/api/employees/accounts-manager/export-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          export_type: exportType,
          file_name: fileName,
          record_count: recordCount,
        }),
      })

      const data = await response.json()

      if (response.status === 429) {
        setError(data.error || 'Daily export limit reached')
        return false
      }

      if (response.ok && data.success) {
        setDailyUsed((prev) => prev + 1)
        return true
      }

      return true // Allow export even if logging fails
    } catch {
      return true // Allow export even if logging fails
    }
  }

  const handleExport = async (type: ExportType) => {
    if (isLimitReached) {
      setError('Daily export limit reached. Try again tomorrow or contact an admin for override.')
      return
    }

    setExporting(type)
    setError(null)
    setSuccess(null)

    try {
      let fileName = ''
      let recordCount = 0
      const dateStr = new Date().toISOString().split('T')[0]

      switch (type) {
        case 'pdf': {
          fileName = `dashboard-summary-${dateStr}.pdf`
          const pdfData: DashboardExportData = {
            stats: dashboardData?.stats,
            financial: dashboardData?.financial,
            teamPerformance: dashboardData?.teamPerformance || [],
            approvalMetrics: dashboardData?.approvalMetrics || { current_rate: 0, mom_change: 0 },
            processingTime: dashboardData?.processingTime || { avg_hours: 0, median_hours: 0 },
          }
          recordCount = 1
          const allowed = await logExport('Dashboard PDF', fileName, recordCount)
          if (!allowed) break
          exportDashboardPDF(pdfData)
          setSuccess('Dashboard summary exported successfully')
          break
        }
        case 'team': {
          const teamData = dashboardData?.teamPerformance || []
          fileName = `team-performance-${dateStr}.csv`
          recordCount = teamData.length
          const allowed = await logExport('Team Performance CSV', fileName, recordCount)
          if (!allowed) break
          exportTeamPerformanceCSV(teamData)
          setSuccess(`Team performance exported (${recordCount} records)`)
          break
        }
        case 'financial': {
          fileName = `financial-report-${dateStr}.csv`
          const financialRows: FinancialExport[] = [
            {
              partner_type: 'Channel Partner (CP)',
              pending_count: dashboardData?.financial?.cp_pending_count || 0,
              pending_amount: dashboardData?.financial?.cp_pending_amount || 0,
              verified_this_month: dashboardData?.financial?.cp_verified_month || 0,
              avg_processing_time: dashboardData?.processingTime?.avg_hours || 0,
            },
            {
              partner_type: 'Business Associate (BA)',
              pending_count: dashboardData?.financial?.ba_pending_count || 0,
              pending_amount: dashboardData?.financial?.ba_pending_amount || 0,
              verified_this_month: dashboardData?.financial?.ba_verified_month || 0,
              avg_processing_time: dashboardData?.processingTime?.avg_hours || 0,
            },
            {
              partner_type: 'Business Partner (BP)',
              pending_count: dashboardData?.financial?.bp_pending_count || 0,
              pending_amount: dashboardData?.financial?.bp_pending_amount || 0,
              verified_this_month: dashboardData?.financial?.bp_verified_month || 0,
              avg_processing_time: dashboardData?.processingTime?.avg_hours || 0,
            },
          ]
          recordCount = financialRows.length
          const allowed = await logExport('Financial Report CSV', fileName, recordCount)
          if (!allowed) break
          exportFinancialReportCSV(financialRows)
          setSuccess('Financial report exported successfully')
          break
        }
        case 'analytics': {
          const analyticsData: AnalyticsPoint[] =
            dashboardData?.analytics || dashboardData?.dailyTrend || []
          fileName = `analytics-${dateStr}.csv`
          recordCount = analyticsData.length
          const allowed = await logExport('Analytics CSV', fileName, recordCount)
          if (!allowed) break
          exportAnalyticsCSV(analyticsData)
          setSuccess(`Analytics data exported (${recordCount} records)`)
          break
        }
      }

      // Refresh logs after export
      setTimeout(() => fetchExportLogs(), 500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setTimeout(() => setExporting(null), 300)
    }
  }

  const getQuotaColor = () => {
    if (quotaPercent >= 100) return 'bg-red-500'
    if (quotaPercent >= 80) return 'bg-orange-500'
    if (quotaPercent >= 60) return 'bg-yellow-500'
    return 'bg-emerald-500'
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const getExportTypeIcon = (exportType: string) => {
    if (exportType.includes('PDF')) return <FileText className="w-4 h-4 text-red-400" />
    if (exportType.includes('Team')) return <Users className="w-4 h-4 text-blue-400" />
    if (exportType.includes('Financial')) return <FileSpreadsheet className="w-4 h-4 text-green-400" />
    return <BarChart3 className="w-4 h-4 text-purple-400" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-poppins text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-orange-500" />
              Export Controls
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Manage data exports and track export activity
            </p>
          </div>
          <button
            onClick={fetchExportLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Messages */}
        {success && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Daily Export Quota */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <h3 className="text-white font-semibold font-poppins">Daily Export Quota</h3>
          </div>
          <span className="text-sm font-mono text-gray-400">
            {dailyUsed} / {dailyLimit}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getQuotaColor()}`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>

        {/* Warning */}
        {isApproachingLimit && !isLimitReached && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            You are approaching your daily export limit ({dailyLimit - dailyUsed} remaining)
          </div>
        )}
        {isLimitReached && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Daily export limit reached. Exports will reset at midnight IST.
          </div>
        )}

        {/* Super admin note */}
        {dailyLimit > 100 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5" />
            Super Admin override: unlimited exports
          </div>
        )}
      </div>

      {/* Export Buttons */}
      <div className="frosted-card p-6 rounded-lg">
        <h3 className="text-white font-semibold font-poppins mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-400" />
          Quick Export
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon
            const isLoading = exporting === option.type
            return (
              <button
                key={option.type}
                onClick={() => handleExport(option.type)}
                disabled={isLoading || exporting !== null || isLimitReached}
                className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-orange-500/30 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5 text-orange-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{option.label}</p>
                  <p className="text-gray-500 text-xs">{option.description}</p>
                </div>
                <span className="text-[10px] text-gray-600 font-medium bg-gray-800/80 px-1.5 py-0.5 rounded flex-shrink-0">
                  {option.format}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Export History */}
      <div className="frosted-card rounded-lg overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-white font-semibold font-poppins flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            Export History
          </h3>
          <p className="text-gray-400 text-sm mt-1">Recent exports (last 30 days)</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : exportLogs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <Download className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No export history yet</p>
            <p className="text-gray-500 text-xs mt-1">
              Exports you make will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-6 py-3 bg-white/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <div className="col-span-4">Type</div>
              <div className="col-span-3">File Name</div>
              <div className="col-span-2 text-right">Records</div>
              <div className="col-span-3 text-right">Date</div>
            </div>

            {/* Rows */}
            {exportLogs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-12 gap-3 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors"
              >
                <div className="col-span-4 flex items-center gap-2">
                  {getExportTypeIcon(log.export_type)}
                  <span className="text-white text-sm truncate">
                    {log.export_type}
                  </span>
                </div>
                <div className="col-span-3">
                  <span className="text-gray-400 text-sm font-mono truncate block">
                    {log.file_name}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-gray-300 text-sm">
                    {log.record_count.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="col-span-3 text-right">
                  <span className="text-gray-500 text-xs">
                    {formatDate(log.exported_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
