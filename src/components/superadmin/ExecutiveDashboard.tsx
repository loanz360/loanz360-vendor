'use client'

/**
 * E31: Executive Dashboard - P&L, Revenue Trends, Cost Analysis
 * Top-level KPI view for C-suite executives
 */

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, IndianRupee, Users, Briefcase, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KPIData {
  label: string
  value: string
  change: number
  changeLabel: string
  icon: React.ReactNode
  color: string
}

export function ExecutiveDashboard() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('month')
  const [kpis, setKpis] = useState<KPIData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchKPIs()
  }, [period])

  async function fetchKPIs() {
    setLoading(true)
    try {
      const response = await fetch(`/api/superadmin/dashboard?period=${period}`, { credentials: 'include' })
      const data = await response.json()

      if (data.success) {
        const d = data.data
        setKpis([
          {
            label: 'Revenue Pipeline',
            value: d.overview?.loan_portfolio?.total_applications || '0',
            change: parseFloat(d.overview?.loan_portfolio?.growth_pct || '0'),
            changeLabel: 'vs last period',
            icon: <IndianRupee className="w-6 h-6" />,
            color: 'orange',
          },
          {
            label: 'Disbursed Amount',
            value: d.overview?.loan_portfolio?.loans_disbursed || '0',
            change: 0,
            changeLabel: 'total disbursed',
            icon: <TrendingUp className="w-6 h-6" />,
            color: 'green',
          },
          {
            label: 'Active Partners',
            value: String(d.overview?.organization?.partners || 0),
            change: d.overview?.organization?.new_partners_this_month || 0,
            changeLabel: 'new this month',
            icon: <Users className="w-6 h-6" />,
            color: 'blue',
          },
          {
            label: 'Approval Rate',
            value: `${d.overview?.approval_rate || 0}%`,
            change: 0,
            changeLabel: 'of processed leads',
            icon: <Target className="w-6 h-6" />,
            color: 'purple',
          },
          {
            label: 'Active Leads',
            value: String(d.analytics?.lead_stats?.processing || 0),
            change: d.analytics?.lead_stats?.this_month || 0,
            changeLabel: 'this month',
            icon: <Briefcase className="w-6 h-6" />,
            color: 'cyan',
          },
          {
            label: 'Sanctioned',
            value: d.overview?.loan_portfolio?.loans_sanctioned || '0',
            change: d.analytics?.lead_stats?.sanctioned || 0,
            changeLabel: 'total sanctioned',
            icon: <TrendingUp className="w-6 h-6" />,
            color: 'emerald',
          },
        ])
      }
    } catch (error) {
      console.error('Error fetching KPIs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white font-poppins">Executive Overview</h2>
        <div className="flex bg-gray-800 rounded-lg p-1">
          {(['today', 'week', 'month', 'quarter', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi, i) => (
            <div
              key={i}
              className={`bg-${kpi.color}-500/5 border border-${kpi.color}-500/20 rounded-xl p-6 hover:border-${kpi.color}-500/40 transition-colors`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`text-${kpi.color}-400`}>{kpi.icon}</div>
                {kpi.change !== 0 && (
                  <div className={`flex items-center gap-1 text-xs ${kpi.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {kpi.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(kpi.change)}
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-white mb-1">{kpi.value}</p>
              <p className="text-xs text-gray-400">{kpi.label}</p>
              <p className="text-xs text-gray-500 mt-1">{kpi.changeLabel}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
