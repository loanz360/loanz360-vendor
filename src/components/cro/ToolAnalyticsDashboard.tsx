'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3, Calculator, Shield, BookOpen, Tag, Building2,
  Scale, TrendingUp, Calendar, Activity, Loader2, RefreshCw
} from 'lucide-react'
import { CARD_COLORS } from '@/lib/constants/theme'

interface ToolStats {
  summary: {
    total_actions: number
    unique_tools: number
    most_used_tool: string | null
    period_days: number
  }
  by_tool: Record<string, { count: number; actions: Record<string, number> }>
  daily_trend: Array<{ date: string; count: number }>
}

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: keyof typeof CARD_COLORS }> = {
  emi_calculator: { label: 'EMI Calculator', icon: Calculator, color: 'primary' },
  eligibility_checker: { label: 'Eligibility Checker', icon: Shield, color: 'success' },
  knowledge_base: { label: 'Knowledge Base', icon: BookOpen, color: 'info' },
  offers: { label: 'Offers', icon: Tag, color: 'warning' },
  bank_products: { label: 'Bank Products', icon: Building2, color: 'purple' },
  product_comparison: { label: 'Product Comparison', icon: Scale, color: 'teal' },
}

export default function ToolAnalyticsDashboard() {
  const [stats, setStats] = useState<ToolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tools/analytics?period=${period}`)
      const result = await res.json()
      if (result.success) {
        setStats(result.data)
      }
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [period])

  // Calculate tool usage percentages
  const toolBreakdown = useMemo(() => {
    if (!stats?.by_tool) return []
    const total = stats.summary.total_actions || 1
    return Object.entries(stats.by_tool)
      .map(([tool, data]) => ({
        tool,
        ...TOOL_META[tool] || { label: tool, icon: Activity, color: 'primary' as const },
        count: data.count,
        percentage: Math.round((data.count / total) * 100),
        actions: data.actions,
      }))
      .sort((a, b) => b.count - a.count)
  }, [stats])

  // Max count for bar chart scaling
  const maxDailyCount = useMemo(() => {
    if (!stats?.daily_trend) return 1
    return Math.max(...stats.daily_trend.map(d => d.count), 1)
  }, [stats])

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Loading analytics...</p>
      </div>
    )
  }

  if (!stats || stats.summary.total_actions === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <BarChart3 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">No tool usage data yet</p>
        <p className="text-gray-600 text-sm mt-1">Start using tools to see your analytics here</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Tool Usage Analytics
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            aria-label="Analytics time period"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={fetchStats} className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${CARD_COLORS.primary.bg} border ${CARD_COLORS.primary.border} rounded-xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Total Actions</p>
          <p className={`text-2xl font-bold ${CARD_COLORS.primary.text}`}>{stats.summary.total_actions}</p>
        </div>
        <div className={`${CARD_COLORS.info.bg} border ${CARD_COLORS.info.border} rounded-xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Tools Used</p>
          <p className={`text-2xl font-bold ${CARD_COLORS.info.text}`}>{stats.summary.unique_tools}</p>
        </div>
        <div className={`${CARD_COLORS.success.bg} border ${CARD_COLORS.success.border} rounded-xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Most Used</p>
          <p className={`text-sm font-bold ${CARD_COLORS.success.text}`}>
            {TOOL_META[stats.summary.most_used_tool || '']?.label || 'N/A'}
          </p>
        </div>
        <div className={`${CARD_COLORS.purple.bg} border ${CARD_COLORS.purple.border} rounded-xl p-4`}>
          <p className="text-xs text-gray-500 mb-1">Avg/Day</p>
          <p className={`text-2xl font-bold ${CARD_COLORS.purple.text}`}>
            {Math.round(stats.summary.total_actions / (parseInt(period) || 1))}
          </p>
        </div>
      </div>

      {/* Tool Usage Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-gray-300 mb-4">Usage by Tool</h4>
        <div className="space-y-3">
          {toolBreakdown.map(({ tool, label, icon: Icon, color, count, percentage }) => (
            <div key={tool} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CARD_COLORS[color].bg}`}>
                <Icon className={`w-4 h-4 ${CARD_COLORS[color].icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white truncate">{label}</span>
                  <span className="text-xs text-gray-400 ml-2">{count} ({percentage}%)</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      color === 'primary' ? 'bg-orange-500' :
                      color === 'success' ? 'bg-emerald-500' :
                      color === 'info' ? 'bg-blue-500' :
                      color === 'warning' ? 'bg-amber-500' :
                      color === 'purple' ? 'bg-purple-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Activity Chart */}
      {stats.daily_trend.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            Daily Activity
          </h4>
          <div className="flex items-end gap-1 h-32">
            {stats.daily_trend.slice(-30).map((day) => (
              <div
                key={day.date}
                className="flex-1 min-w-[4px] group relative"
              >
                <div
                  className="bg-orange-500/60 hover:bg-orange-500 rounded-t transition-all cursor-pointer"
                  style={{ height: `${Math.max(4, (day.count / maxDailyCount) * 100)}%` }}
                />
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap z-10">
                  {day.date}: {day.count} actions
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>{stats.daily_trend[0]?.date}</span>
            <span>{stats.daily_trend[stats.daily_trend.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </div>
  )
}
