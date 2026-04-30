'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  MessageSquare,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  ChevronDown
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface AnalyticsData {
  overview: {
    totalTickets: number
    openTickets: number
    resolvedTickets: number
    avgResolutionTime: number
    avgFirstResponseTime: number
    slaComplianceRate: number
    customerSatisfaction: number
    ticketsTrend: number // percentage change from previous period
  }
  volumeByDay: Array<{
    date: string
    created: number
    resolved: number
  }>
  byCategory: Array<{
    category: string
    count: number
    percentage: number
  }>
  byPriority: Array<{
    priority: string
    count: number
    avgResolutionHours: number
  }>
  byStatus: Array<{
    status: string
    count: number
    color: string
  }>
  agentPerformance: Array<{
    agentId: string
    agentName: string
    ticketsHandled: number
    avgResolutionTime: number
    slaCompliance: number
    satisfactionScore: number
  }>
  peakHours: Array<{
    hour: number
    ticketCount: number
  }>
  slaMetrics: {
    onTrack: number
    atRisk: number
    breached: number
    met: number
  }
}

interface AnalyticsDashboardProps {
  ticketSource?: 'employee' | 'customer' | 'partner' | 'all'
  className?: string
}

// ============================================================================
// ANALYTICS DASHBOARD COMPONENT
// ============================================================================

export default function AnalyticsDashboard({
  ticketSource = 'all',
  className = ''
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [ticketSource, dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('source', ticketSource)
      params.append('range', dateRange)
      if (dateRange === 'custom' && customDateFrom && customDateTo) {
        params.append('from', customDateFrom)
        params.append('to', customDateTo)
      }

      const response = await fetch(`/api/support/analytics?${params.toString()}`)
      const result = await response.json()

      if (response.ok) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAnalytics()
    setRefreshing(false)
  }

  const handleExport = async () => {
    // Export analytics data as CSV
    if (!data) return

    const csvContent = generateCSV(data)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ticket-analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-white/5 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-white/5 rounded-xl" />
            <div className="h-80 bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <BarChart3 className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Analytics Data</h3>
        <p className="text-gray-400">Analytics data is not available for the selected period.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Support Analytics</h2>
          <p className="text-gray-400 text-sm mt-1">
            {ticketSource === 'all' ? 'All Tickets' : `${ticketSource.charAt(0).toUpperCase() + ticketSource.slice(1)} Tickets`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as unknown)}
            className="bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Tickets"
          value={data.overview.totalTickets}
          trend={data.overview.ticketsTrend}
          icon={<MessageSquare className="w-6 h-6" />}
          color="blue"
        />
        <KPICard
          title="Open Tickets"
          value={data.overview.openTickets}
          subtitle={`${data.overview.resolvedTickets} resolved`}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
        <KPICard
          title="Avg Resolution Time"
          value={formatDuration(data.overview.avgResolutionTime)}
          subtitle="hours"
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <KPICard
          title="SLA Compliance"
          value={`${data.overview.slaComplianceRate.toFixed(1)}%`}
          icon={<AlertTriangle className="w-6 h-6" />}
          color={data.overview.slaComplianceRate >= 90 ? 'green' : data.overview.slaComplianceRate >= 75 ? 'yellow' : 'red'}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Volume Chart */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            Ticket Volume
          </h3>
          <div className="h-64">
            <VolumeChart data={data.volumeByDay} />
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-orange-400" />
            By Category
          </h3>
          <div className="space-y-3">
            {data.byCategory.slice(0, 6).map((cat, index) => (
              <CategoryBar
                key={cat.category}
                category={cat.category}
                count={cat.count}
                percentage={cat.percentage}
                color={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
          <div className="space-y-2">
            {data.byStatus.map(status => (
              <div key={status.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${status.color}`} />
                  <span className="text-sm capitalize">{status.status.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-sm font-medium">{status.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">By Priority</h3>
          <div className="space-y-3">
            {data.byPriority.map(p => (
              <div key={p.priority} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(p.priority)}`}>
                  {p.priority.toUpperCase()}
                </span>
                <div className="text-right">
                  <div className="text-sm font-medium">{p.count} tickets</div>
                  <div className="text-xs text-gray-400">{p.avgResolutionHours.toFixed(1)}h avg</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SLA Metrics */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">SLA Status</h3>
          <div className="grid grid-cols-2 gap-4">
            <SLAMetricCard label="On Track" value={data.slaMetrics.onTrack} color="green" />
            <SLAMetricCard label="At Risk" value={data.slaMetrics.atRisk} color="yellow" />
            <SLAMetricCard label="Breached" value={data.slaMetrics.breached} color="red" />
            <SLAMetricCard label="Met" value={data.slaMetrics.met} color="blue" />
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-400" />
          Agent Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Agent</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Tickets</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Avg Resolution</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">SLA %</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Satisfaction</th>
              </tr>
            </thead>
            <tbody>
              {data.agentPerformance.map(agent => (
                <tr key={agent.agentId} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4">{agent.agentName}</td>
                  <td className="py-3 px-4 text-right">{agent.ticketsHandled}</td>
                  <td className="py-3 px-4 text-right">{formatDuration(agent.avgResolutionTime)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={agent.slaCompliance >= 90 ? 'text-green-400' : agent.slaCompliance >= 75 ? 'text-yellow-400' : 'text-red-400'}>
                      {agent.slaCompliance.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {agent.satisfactionScore.toFixed(1)}
                      <span className="text-yellow-400">★</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peak Hours */}
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-400" />
          Peak Hours (Tickets Created)
        </h3>
        <div className="flex items-end gap-1 h-32">
          {data.peakHours.map(hour => {
            const maxCount = Math.max(...data.peakHours.map(h => h.ticketCount))
            const height = maxCount > 0 ? (hour.ticketCount / maxCount) * 100 : 0

            return (
              <div
                key={hour.hour}
                className="flex-1 flex flex-col items-center gap-1"
                title={`${hour.hour}:00 - ${hour.ticketCount} tickets`}
              >
                <div
                  className="w-full bg-orange-500/80 rounded-t hover:bg-orange-400 transition-colors"
                  style={{ height: `${height}%`, minHeight: hour.ticketCount > 0 ? '4px' : '0' }}
                />
                <span className="text-xs text-gray-400">{hour.hour}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'yellow' | 'red' | 'orange'
}

function KPICard({ title, value, subtitle, trend, icon, color }: KPICardProps) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    yellow: 'text-yellow-400 bg-yellow-400/10',
    red: 'text-red-400 bg-red-400/10',
    orange: 'text-orange-400 bg-orange-400/10'
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-gray-400 text-sm">{subtitle || title}</div>
      </div>
    </div>
  )
}

interface CategoryBarProps {
  category: string
  count: number
  percentage: number
  color: string
}

function CategoryBar({ category, count, percentage, color }: CategoryBarProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="capitalize">{category.replace(/_/g, ' ')}</span>
        <span className="text-gray-400">{count} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface SLAMetricCardProps {
  label: string
  value: number
  color: 'green' | 'yellow' | 'red' | 'blue'
}

function SLAMetricCard({ label, value, color }: SLAMetricCardProps) {
  const colorClasses = {
    green: 'text-green-400 border-green-400/30 bg-green-400/5',
    yellow: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    red: 'text-red-400 border-red-400/30 bg-red-400/5',
    blue: 'text-blue-400 border-blue-400/30 bg-blue-400/5'
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  )
}

// Simple bar chart component
function VolumeChart({ data }: { data: AnalyticsData['volumeByDay'] }) {
  const maxValue = Math.max(...data.flatMap(d => [d.created, d.resolved]))

  return (
    <div className="flex items-end gap-2 h-full">
      {data.map((day, index) => (
        <div key={day.date} className="flex-1 flex flex-col gap-1">
          <div className="flex-1 flex items-end gap-0.5">
            <div
              className="flex-1 bg-blue-500/80 rounded-t"
              style={{ height: `${maxValue > 0 ? (day.created / maxValue) * 100 : 0}%` }}
              title={`Created: ${day.created}`}
            />
            <div
              className="flex-1 bg-green-500/80 rounded-t"
              style={{ height: `${maxValue > 0 ? (day.resolved / maxValue) * 100 : 0}%` }}
              title={`Resolved: ${day.resolved}`}
            />
          </div>
          <span className="text-xs text-gray-400 text-center truncate">
            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500'
]

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-400 bg-green-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    urgent: 'text-red-400 bg-red-400/10',
    critical: 'text-red-500 bg-red-500/10'
  }
  return colors[priority] || colors.medium
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`
  }
  return `${(hours / 24).toFixed(1)}d`
}

function generateCSV(data: AnalyticsData): string {
  const lines: string[] = []

  // Overview section
  lines.push('OVERVIEW')
  lines.push('Metric,Value')
  lines.push(`Total Tickets,${data.overview.totalTickets}`)
  lines.push(`Open Tickets,${data.overview.openTickets}`)
  lines.push(`Resolved Tickets,${data.overview.resolvedTickets}`)
  lines.push(`Avg Resolution Time (hours),${data.overview.avgResolutionTime}`)
  lines.push(`SLA Compliance Rate,${data.overview.slaComplianceRate}%`)
  lines.push('')

  // Volume by day
  lines.push('DAILY VOLUME')
  lines.push('Date,Created,Resolved')
  data.volumeByDay.forEach(day => {
    lines.push(`${day.date},${day.created},${day.resolved}`)
  })
  lines.push('')

  // By category
  lines.push('BY CATEGORY')
  lines.push('Category,Count,Percentage')
  data.byCategory.forEach(cat => {
    lines.push(`${cat.category},${cat.count},${cat.percentage}%`)
  })
  lines.push('')

  // Agent performance
  lines.push('AGENT PERFORMANCE')
  lines.push('Agent,Tickets Handled,Avg Resolution (hours),SLA Compliance,Satisfaction')
  data.agentPerformance.forEach(agent => {
    lines.push(`${agent.agentName},${agent.ticketsHandled},${agent.avgResolutionTime},${agent.slaCompliance}%,${agent.satisfactionScore}`)
  })

  return lines.join('\n')
}

export { AnalyticsDashboard }
