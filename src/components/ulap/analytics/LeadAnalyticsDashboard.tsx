'use client'

/**
 * ULAP Lead Analytics Dashboard
 *
 * Comprehensive analytics dashboard for lead performance metrics
 * Shows conversion rates, source analysis, funnel visualization, and trends
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/cn'

// Types
interface AnalyticsSummary {
  totalLeads: number
  totalLeadsChange: number
  conversionRate: number
  conversionRateChange: number
  avgProcessingTime: number
  avgProcessingTimeChange: number
  totalDisbursed: number
  totalDisbursedChange: number
  pendingLeads: number
  approvedLeads: number
  rejectedLeads: number
  disbursedLeads: number
}

interface SourceMetrics {
  source: string
  leads: number
  conversions: number
  conversionRate: number
  avgAmount: number
  avgProcessingDays: number
}

interface FunnelStage {
  stage: string
  count: number
  percentage: number
  dropoff: number
}

interface DailyTrend {
  date: string
  leads: number
  conversions: number
  disbursements: number
}

interface LeadAnalyticsDashboardProps {
  partnerId?: string
  employeeId?: string
  dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year'
  showExport?: boolean
}

// Mock data for demonstration
const mockSummary: AnalyticsSummary = {
  totalLeads: 1247,
  totalLeadsChange: 12.5,
  conversionRate: 34.2,
  conversionRateChange: 2.8,
  avgProcessingTime: 4.5,
  avgProcessingTimeChange: -0.5,
  totalDisbursed: 45600000,
  totalDisbursedChange: 18.2,
  pendingLeads: 423,
  approvedLeads: 312,
  rejectedLeads: 189,
  disbursedLeads: 323
}

const mockSourceMetrics: SourceMetrics[] = [
  { source: 'Business Associate', leads: 456, conversions: 178, conversionRate: 39.0, avgAmount: 850000, avgProcessingDays: 4.2 },
  { source: 'Business Partner', leads: 312, conversions: 134, conversionRate: 42.9, avgAmount: 1200000, avgProcessingDays: 3.8 },
  { source: 'DSE Direct', leads: 234, conversions: 89, conversionRate: 38.0, avgAmount: 650000, avgProcessingDays: 3.5 },
  { source: 'Telecaller', leads: 189, conversions: 56, conversionRate: 29.6, avgAmount: 450000, avgProcessingDays: 5.2 },
  { source: 'Field Sales', leads: 145, conversions: 67, conversionRate: 46.2, avgAmount: 920000, avgProcessingDays: 4.0 },
  { source: 'Customer Self-Service', leads: 98, conversions: 23, conversionRate: 23.5, avgAmount: 380000, avgProcessingDays: 6.1 },
  { source: 'Referral', leads: 67, conversions: 31, conversionRate: 46.3, avgAmount: 780000, avgProcessingDays: 3.2 }
]

const mockFunnel: FunnelStage[] = [
  { stage: 'New Leads', count: 1247, percentage: 100, dropoff: 0 },
  { stage: 'Contacted', count: 1089, percentage: 87.3, dropoff: 12.7 },
  { stage: 'Documents Collected', count: 834, percentage: 66.9, dropoff: 23.4 },
  { stage: 'Under Review', count: 612, percentage: 49.1, dropoff: 26.6 },
  { stage: 'CAM Generated', count: 523, percentage: 41.9, dropoff: 14.5 },
  { stage: 'Approved', count: 426, percentage: 34.2, dropoff: 18.5 },
  { stage: 'Disbursed', count: 323, percentage: 25.9, dropoff: 24.2 }
]

const mockTrends: DailyTrend[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  leads: Math.floor(Math.random() * 50) + 30,
  conversions: Math.floor(Math.random() * 20) + 10,
  disbursements: Math.floor(Math.random() * 15) + 5
}))

export default function LeadAnalyticsDashboard({
  partnerId,
  employeeId,
  dateRange = 'month',
  showExport = true
}: LeadAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [selectedDateRange, setSelectedDateRange] = useState(dateRange)
  const [summary, setSummary] = useState<AnalyticsSummary>(mockSummary)
  const [sourceMetrics, setSourceMetrics] = useState<SourceMetrics[]>(mockSourceMetrics)
  const [funnel, setFunnel] = useState<FunnelStage[]>(mockFunnel)
  const [trends, setTrends] = useState<DailyTrend[]>(mockTrends)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [selectedDateRange, partnerId, employeeId])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API calls
      // const response = await fetch(`/api/analytics/leads?range=${selectedDateRange}&partnerId=${partnerId}&employeeId=${employeeId}`)
      // const data = await response.json()

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Use mock data for now
      setSummary(mockSummary)
      setSourceMetrics(mockSourceMetrics)
      setFunnel(mockFunnel)
      setTrends(mockTrends)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAnalytics()
    setIsRefreshing(false)
  }

  const getChangeColor = (change: number, inverse = false) => {
    if (inverse) {
      return change < 0 ? 'text-green-400' : change > 0 ? 'text-red-400' : 'text-gray-400'
    }
    return change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
  }

  const getChangeIcon = (change: number, inverse = false) => {
    if (inverse) {
      return change < 0 ? ArrowDownRight : ArrowUpRight
    }
    return change > 0 ? ArrowUpRight : ArrowDownRight
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-24 mb-4" />
              <div className="h-8 bg-white/10 rounded w-32 mb-2" />
              <div className="h-3 bg-white/10 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Lead Analytics</h2>
          <p className="text-gray-400 text-sm mt-1">Performance metrics and insights</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Filter */}
          <div className="relative">
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as typeof dateRange)}
              className="appearance-none bg-zinc-800 border border-white/10 rounded-lg px-4 py-2 text-sm text-white pr-10 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-zinc-800 border border-white/10 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Button */}
          {showExport && (
            <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium">
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary.totalLeadsChange)}`}>
              {React.createElement(getChangeIcon(summary.totalLeadsChange), { className: 'w-4 h-4' })}
              {Math.abs(summary.totalLeadsChange)}%
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Total Leads</p>
          <p className="text-3xl font-bold text-white">{summary.totalLeads.toLocaleString()}</p>
        </motion.div>

        {/* Conversion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-green-400" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary.conversionRateChange)}`}>
              {React.createElement(getChangeIcon(summary.conversionRateChange), { className: 'w-4 h-4' })}
              {Math.abs(summary.conversionRateChange)}%
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
          <p className="text-3xl font-bold text-white">{summary.conversionRate}%</p>
        </motion.div>

        {/* Avg Processing Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary.avgProcessingTimeChange, true)}`}>
              {React.createElement(getChangeIcon(summary.avgProcessingTimeChange, true), { className: 'w-4 h-4' })}
              {Math.abs(summary.avgProcessingTimeChange)} days
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Avg. Processing Time</p>
          <p className="text-3xl font-bold text-white">{summary.avgProcessingTime} days</p>
        </motion.div>

        {/* Total Disbursed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-900/50 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div className={`flex items-center gap-1 text-sm ${getChangeColor(summary.totalDisbursedChange)}`}>
              {React.createElement(getChangeIcon(summary.totalDisbursedChange), { className: 'w-4 h-4' })}
              {Math.abs(summary.totalDisbursedChange)}%
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-1">Total Disbursed</p>
          <p className="text-3xl font-bold text-white">{formatCurrency(summary.totalDisbursed)}</p>
        </motion.div>
      </div>

      {/* Lead Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Cards */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-orange-400" />
            Lead Status
          </h3>

          <div className="space-y-3">
            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-gray-300">Pending</span>
              </div>
              <span className="text-white font-semibold">{summary.pendingLeads}</span>
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-gray-300">Approved</span>
              </div>
              <span className="text-white font-semibold">{summary.approvedLeads}</span>
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-gray-300">Rejected</span>
              </div>
              <span className="text-white font-semibold">{summary.rejectedLeads}</span>
            </div>

            <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-gray-300">Disbursed</span>
              </div>
              <span className="text-white font-semibold">{summary.disbursedLeads}</span>
            </div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-orange-400" />
            Conversion Funnel
          </h3>

          <div className="space-y-3">
            {funnel.map((stage, index) => (
              <div key={stage.stage} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{stage.stage}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-white font-medium">{stage.count}</span>
                    {stage.dropoff > 0 && (
                      <span className="text-xs text-red-400">-{stage.dropoff}%</span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.percentage}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-lg flex items-center justify-end pr-3"
                  >
                    <span className="text-xs text-white font-medium">{stage.percentage}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Performance Table */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            Source Performance
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-gray-400 font-medium text-sm">Source</th>
                <th className="text-right p-4 text-gray-400 font-medium text-sm">Leads</th>
                <th className="text-right p-4 text-gray-400 font-medium text-sm">Conversions</th>
                <th className="text-right p-4 text-gray-400 font-medium text-sm">Conv. Rate</th>
                <th className="text-right p-4 text-gray-400 font-medium text-sm">Avg. Amount</th>
                <th className="text-right p-4 text-gray-400 font-medium text-sm">Avg. Days</th>
              </tr>
            </thead>
            <tbody>
              {sourceMetrics.map((source, index) => (
                <motion.tr
                  key={source.source}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="p-4 text-white font-medium">{source.source}</td>
                  <td className="p-4 text-right text-gray-300">{source.leads}</td>
                  <td className="p-4 text-right text-gray-300">{source.conversions}</td>
                  <td className="p-4 text-right">
                    <span className={`font-medium ${
                      source.conversionRate >= 40 ? 'text-green-400' :
                      source.conversionRate >= 30 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {source.conversionRate}%
                    </span>
                  </td>
                  <td className="p-4 text-right text-gray-300">{formatCurrency(source.avgAmount)}</td>
                  <td className="p-4 text-right">
                    <span className={`font-medium ${
                      source.avgProcessingDays <= 4 ? 'text-green-400' :
                      source.avgProcessingDays <= 5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {source.avgProcessingDays}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          Daily Trends (Last 30 Days)
        </h3>

        <div className="h-64 flex items-end justify-between gap-1">
          {trends.map((day, index) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex flex-col gap-0.5">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.leads / 80) * 100}%` }}
                  transition={{ delay: index * 0.02 }}
                  className="w-full bg-blue-500/50 rounded-t min-h-[4px]"
                  title={`Leads: ${day.leads}`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.conversions / 80) * 100}%` }}
                  transition={{ delay: index * 0.02 + 0.1 }}
                  className="w-full bg-green-500/50 rounded min-h-[4px]"
                  title={`Conversions: ${day.conversions}`}
                />
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(day.disbursements / 80) * 100}%` }}
                  transition={{ delay: index * 0.02 + 0.2 }}
                  className="w-full bg-emerald-500/50 rounded-b min-h-[4px]"
                  title={`Disbursements: ${day.disbursements}`}
                />
              </div>
              {index % 5 === 0 && (
                <span className="text-[10px] text-gray-500 mt-1">
                  {new Date(day.date).getDate()}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/50" />
            <span className="text-sm text-gray-400">Leads</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500/50" />
            <span className="text-sm text-gray-400">Conversions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-500/50" />
            <span className="text-sm text-gray-400">Disbursements</span>
          </div>
        </div>
      </div>
    </div>
  )
}
