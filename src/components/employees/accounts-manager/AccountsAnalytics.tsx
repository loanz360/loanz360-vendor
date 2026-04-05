/**
 * AccountsAnalytics - Comprehensive Analytics for Accounts Manager
 * Combines: Revenue Analytics, Anomaly Detection, Smart Notifications, Report Builder
 * Brand: LOANZ 360 (Orange #FF6700, Ash Gray #171717, Poppins)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Bell,
  BellOff,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  IndianRupee,
  ShieldAlert,
  Clock,
  Users,
  ChevronDown,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/cn'
import { downloadCSV, downloadExcel, downloadPDF } from '@/lib/utils/export-helpers'

// =============================================
// TYPES
// =============================================

interface FinancialData {
  total_revenue: number
  cp_payouts: number
  ba_commission: number
  bp_commission: number
  rejectedToday: number
  aging: { total_overdue: number }
  onHoldTotal: number
  team_members?: TeamMember[]
}

interface TeamMember {
  name: string
  total_applications: number
  rejected: number
}

interface MonthlyTrend {
  month: string
  cp: number
  ba: number
  bp: number
  total: number
}

interface Anomaly {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'clear'
  action: string
}

interface NotificationPref {
  dailyBriefing: boolean
  slaBreach: boolean
  weeklyDigest: boolean
  escalationChain: boolean
  newApplication: boolean
}

const NOTIFICATION_KEY = 'accounts_manager_notifications'

const DEFAULT_NOTIFICATIONS: NotificationPref = {
  dailyBriefing: true,
  slaBreach: true,
  weeklyDigest: false,
  escalationChain: true,
  newApplication: false,
}

const REPORT_TYPES = [
  { value: 'partner-wise', label: 'Partner-wise Report' },
  { value: 'bank-wise', label: 'Bank-wise Report' },
  { value: 'monthly', label: 'Monthly Summary' },
  { value: 'team-performance', label: 'Team Performance' },
]

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
]

// =============================================
// CARD WRAPPER
// =============================================

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border border-neutral-800 bg-neutral-900/80 p-5 backdrop-blur-sm ${className}`}
    >
      {children}
    </motion.div>
  )
}

// =============================================
// MAIN COMPONENT
// =============================================

export default function AccountsAnalytics({ defaultSection }: { defaultSection?: string } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [financial, setFinancial] = useState<FinancialData | null>(null)
  const [trends, setTrends] = useState<MonthlyTrend[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [notifications, setNotifications] = useState<NotificationPref>(DEFAULT_NOTIFICATIONS)

  // Report builder state
  const [reportType, setReportType] = useState('partner-wise')
  const [reportFormat, setReportFormat] = useState('csv')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [generating, setGenerating] = useState(false)

  // ---- Load notification preferences from localStorage ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_KEY)
      if (stored) setNotifications(JSON.parse(stored))
    } catch {
      // ignore parse errors
    }
  }, [])

  // ---- Fetch data ----
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch('/api/employees/accounts-executive/dashboard'),
        fetch('/api/employees/reports/financial?type=monthly'),
      ])

      if (!dashRes.ok) throw new Error('Failed to load dashboard data')

      const dashJson = await dashRes.json()
      const trendJson = trendRes.ok ? await trendRes.json() : { data: [] }

      const fin: FinancialData = dashJson.data?.financial ?? {
        total_revenue: 0,
        cp_payouts: 0,
        ba_commission: 0,
        bp_commission: 0,
        rejectedToday: dashJson.data?.rejectedToday ?? 0,
        aging: dashJson.data?.aging ?? { total_overdue: 0 },
        onHoldTotal: dashJson.data?.onHoldTotal ?? 0,
        team_members: dashJson.data?.team_members ?? [],
      }

      // Merge top-level fields that may live outside financial
      fin.rejectedToday = fin.rejectedToday ?? dashJson.data?.rejectedToday ?? 0
      fin.aging = fin.aging ?? dashJson.data?.aging ?? { total_overdue: 0 }
      fin.onHoldTotal = fin.onHoldTotal ?? dashJson.data?.onHoldTotal ?? 0
      fin.team_members = fin.team_members ?? dashJson.data?.team_members ?? []

      setFinancial(fin)
      setTrends(trendJson.data ?? [])
      setAnomalies(computeAnomalies(fin))
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---- Anomaly computation ----
  function computeAnomalies(data: FinancialData): Anomaly[] {
    const result: Anomaly[] = []

    if (data.rejectedToday > 3) {
      result.push({
        id: 'high-rejection',
        title: 'High Rejection Rate',
        description: `${data.rejectedToday} applications rejected today, exceeding the threshold of 3.`,
        severity: 'warning',
        action: 'Review Rejections',
      })
    }

    if (data.aging?.total_overdue > 5) {
      result.push({
        id: 'overdue',
        title: 'Overdue Applications',
        description: `${data.aging.total_overdue} applications are overdue. Immediate action required.`,
        severity: 'critical',
        action: 'View Overdue',
      })
    }

    const flaggedMembers = (data.team_members ?? []).filter((m) => {
      if (!m.total_applications || m.total_applications === 0) return false
      return (m.rejected / m.total_applications) * 100 > 30
    })
    if (flaggedMembers.length > 0) {
      result.push({
        id: 'unusual-activity',
        title: 'Unusual Activity Detected',
        description: `${flaggedMembers.length} team member(s) have rejection rate above 30%: ${flaggedMembers.map((m) => m.name).join(', ')}.`,
        severity: 'warning',
        action: 'Investigate',
      })
    }

    if (data.onHoldTotal > 10) {
      result.push({
        id: 'stale-queue',
        title: 'Stale Queue Alert',
        description: `${data.onHoldTotal} applications on hold. Queue may be stalling.`,
        severity: 'warning',
        action: 'Clear Queue',
      })
    }

    if (result.length === 0) {
      result.push({
        id: 'all-clear',
        title: 'All Systems Normal',
        description: 'No anomalies detected. All metrics are within expected ranges.',
        severity: 'clear',
        action: 'Dismiss',
      })
    }

    return result
  }

  // ---- Toggle notification pref ----
  function toggleNotification(key: keyof NotificationPref) {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] }
      localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(updated))
      toast.success('Notification preference updated')
      return updated
    })
  }

  // ---- Generate report ----
  async function handleGenerateReport() {
    if (!dateFrom || !dateTo) {
      toast.error('Please select both start and end dates')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(
        `/api/employees/reports/financial?type=${reportType}&from=${dateFrom}&to=${dateTo}`
      )
      if (!res.ok) throw new Error('Failed to generate report')
      const json = await res.json()
      const data = json.data ?? []

      if (data.length === 0) {
        toast.warning('No data found for the selected criteria')
        setGenerating(false)
        return
      }

      const filename = `loanz360_${reportType}_${dateFrom}_${dateTo}`

      switch (reportFormat) {
        case 'csv':
          downloadCSV(data, filename)
          break
        case 'excel':
          downloadExcel(data, filename, `${reportType} Report`)
          break
        case 'pdf':
          downloadPDF(data, filename, {
            title: `LOANZ 360 - ${REPORT_TYPES.find((r) => r.value === reportType)?.label}`,
          })
          break
      }

      toast.success('Report generated successfully')
    } catch (err: any) {
      toast.error(err.message ?? 'Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // ---- Severity styling ----
  function severityStyle(severity: Anomaly['severity']) {
    switch (severity) {
      case 'critical':
        return {
          border: 'border-red-500/40',
          bg: 'bg-red-500/10',
          icon: <ShieldAlert className="h-5 w-5 text-red-400" />,
          badge: 'bg-red-500/20 text-red-400',
        }
      case 'warning':
        return {
          border: 'border-orange-500/40',
          bg: 'bg-orange-500/10',
          icon: <AlertTriangle className="h-5 w-5 text-orange-400" />,
          badge: 'bg-orange-500/20 text-orange-400',
        }
      case 'clear':
        return {
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-500/10',
          icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
          badge: 'bg-emerald-500/20 text-emerald-400',
        }
    }
  }

  // ---- Loading / Error states ----
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center font-poppins">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <span className="ml-3 text-neutral-400">Loading analytics...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 font-poppins">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-neutral-300">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    )
  }

  const totalRevenue =
    (financial?.cp_payouts ?? 0) +
    (financial?.ba_commission ?? 0) +
    (financial?.bp_commission ?? 0)

  // =============================================
  // RENDER
  // =============================================

  return (
    <div className="space-y-8 font-poppins">
      {/* ===== SECTION A: Revenue Analytics ===== */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Revenue Analytics</h2>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-orange-500 hover:text-orange-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {/* Revenue summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Revenue */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Total Revenue
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatCurrency(financial?.total_revenue ?? totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-2">
                <IndianRupee className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <p className="mt-2 flex items-center text-xs text-emerald-400">
              <TrendingUp className="mr-1 h-3 w-3" /> This month
            </p>
          </Card>

          {/* CP Payouts */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  CP Payouts
                </p>
                <p className="mt-1 text-2xl font-bold text-yellow-400">
                  {formatCurrency(financial?.cp_payouts)}
                </p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </Card>

          {/* BA Commission */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  BA Commission
                </p>
                <p className="mt-1 text-2xl font-bold text-orange-400">
                  {formatCurrency(financial?.ba_commission)}
                </p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </Card>

          {/* BP Commission */}
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  BP Commission
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-400">
                  {formatCurrency(financial?.bp_commission)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Monthly Revenue Trend Chart */}
        <Card className="mt-4">
          <h3 className="mb-4 text-sm font-medium text-neutral-400">
            Monthly Revenue Trend (Last 6 Months)
          </h3>
          {trends.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="gradCP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradBP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#444' }}
                  />
                  <YAxis
                    tick={{ fill: '#a3a3a3', fontSize: 12 }}
                    axisLine={{ stroke: '#444' }}
                    tickFormatter={(v: number) =>
                      v >= 100000
                        ? `${(v / 100000).toFixed(1)}L`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                      fontFamily: 'Poppins',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'cp' ? 'CP Payouts' : name === 'ba' ? 'BA Commission' : 'BP Commission',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cp"
                    stroke="#EAB308"
                    fill="url(#gradCP)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="ba"
                    stroke="#F97316"
                    fill="url(#gradBA)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="bp"
                    stroke="#F59E0B"
                    fill="url(#gradBP)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-sm text-neutral-500">
              No trend data available yet
            </div>
          )}
          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" /> CP Payouts
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" /> BA Commission
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> BP Commission
            </span>
          </div>
        </Card>
      </section>

      {/* ===== SECTION B: Anomaly Detection ===== */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Anomaly Detection</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {anomalies.map((anomaly) => {
              const style = severityStyle(anomaly.severity)
              return (
                <motion.div
                  key={anomaly.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`rounded-xl border ${style.border} ${style.bg} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{style.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">{anomaly.title}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${style.badge}`}
                        >
                          {anomaly.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                        {anomaly.description}
                      </p>
                      <button
                        onClick={() =>
                          toast.info(`Action: ${anomaly.action} — navigating...`)
                        }
                        className="mt-2.5 rounded-md bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/10"
                      >
                        {anomaly.action}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </section>

      {/* ===== SECTION C: Smart Notifications Panel ===== */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Smart Notifications</h2>
        <Card>
          <div className="space-y-1">
            {(
              [
                {
                  key: 'dailyBriefing' as const,
                  label: 'Daily Morning Briefing',
                  desc: 'Receive a summary of pending tasks and key metrics every morning at 9 AM.',
                  icon: <Clock className="h-4 w-4 text-orange-400" />,
                },
                {
                  key: 'slaBreach' as const,
                  label: 'SLA Breach Alerts',
                  desc: 'Get notified immediately when an application is about to breach its SLA.',
                  icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
                },
                {
                  key: 'weeklyDigest' as const,
                  label: 'Weekly Performance Digest',
                  desc: 'Weekly summary of team performance, revenue, and key metrics every Monday.',
                  icon: <FileText className="h-4 w-4 text-blue-400" />,
                },
                {
                  key: 'escalationChain' as const,
                  label: 'Escalation Chain Alerts',
                  desc: 'Alerts when applications are escalated or require managerial intervention.',
                  icon: <Users className="h-4 w-4 text-purple-400" />,
                },
                {
                  key: 'newApplication' as const,
                  label: 'New Application Alerts',
                  desc: 'Notify when a new application is assigned to your team.',
                  icon: <Bell className="h-4 w-4 text-emerald-400" />,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-white/5"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{item.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleNotification(item.key)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    notifications[item.key] ? 'bg-orange-500' : 'bg-neutral-700'
                  }`}
                  aria-label={`Toggle ${item.label}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* ===== SECTION D: Report Builder ===== */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Report Builder</h2>
        <Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Report Type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Report Type
              </label>
              <div className="relative">
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm text-white outline-none transition-colors focus:border-orange-500"
                >
                  {REPORT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-neutral-500" />
              </div>
            </div>

            {/* Date From */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-orange-500 [color-scheme:dark]"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-orange-500 [color-scheme:dark]"
              />
            </div>

            {/* Format */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                Format
              </label>
              <div className="relative">
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 pr-8 text-sm text-white outline-none transition-colors focus:border-orange-500"
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-neutral-500" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </Card>
      </section>
    </div>
  )
}
