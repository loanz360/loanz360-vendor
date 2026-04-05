'use client'

import { useState, useEffect } from 'react'
import { Loader2, TrendingDown, ArrowRight, Clock, DollarSign } from 'lucide-react'

interface FunnelStage {
  name: string
  count: number
  color: string
  conversionRate: number
  dropOff: number
  avgDaysInStage: number
  value: number
}

interface FunnelData {
  stages: FunnelStage[]
  overallConversionRate: number
  totalContacts: number
  totalDeals: number
  totalDisbursed: number
}

type DateRange = 'this_week' | 'this_month' | 'last_30' | 'custom'

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return amount.toLocaleString('en-IN')
}

function getConversionColor(rate: number): string {
  if (rate >= 50) return 'text-green-400'
  if (rate >= 20) return 'text-yellow-400'
  return 'text-red-400'
}

function getConversionBg(rate: number): string {
  if (rate >= 50) return 'bg-green-500/20 text-green-400'
  if (rate >= 20) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

function getDropOffColor(rate: number): string {
  if (rate <= 30) return 'text-green-500'
  if (rate <= 60) return 'text-yellow-500'
  return 'text-red-500'
}

export default function FunnelAnalytics({ dateRange }: { dateRange?: DateRange }) {
  const [data, setData] = useState<FunnelData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchFunnel()
  }, [dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFunnel = async () => {
    setIsLoading(true)
    try {
      // Build query params from dateRange
      const params = new URLSearchParams()
      if (dateRange === 'this_month' || dateRange === 'last_30') {
        const now = new Date()
        if (dateRange === 'this_month') {
          params.set('from', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
        } else {
          const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          params.set('from', d.toISOString().slice(0, 10))
        }
        params.set('to', now.toISOString().slice(0, 10))
      }
      const qs = params.toString()
      const url = `/api/ai-crm/cro/analytics/funnel${qs ? `?${qs}` : ''}`
      const response = await fetch(url)
      const result = await response.json()
      if (result.success) setData(result.data)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-gray-500 text-center py-8">Unable to load funnel data</p>
  }

  const maxCount = Math.max(...data.stages.map((s) => s.count), 1)
  const maxValue = Math.max(...data.stages.map((s) => s.value), 1)

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
          <p className="text-2xl font-bold text-white">{data.totalContacts}</p>
          <p className="text-xs text-gray-500">Total Contacts</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
          <p className="text-2xl font-bold text-orange-400">{data.overallConversionRate}%</p>
          <p className="text-xs text-gray-500">Overall Conversion</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10 text-center">
          <p className="text-2xl font-bold text-green-400">{data.totalDeals}</p>
          <p className="text-xs text-gray-500">Total Deals</p>
        </div>
      </div>

      {/* Visual Funnel - Enhanced */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {data.stages.map((stage, index) => {
            const widthPct = Math.max(10, (stage.count / maxCount) * 100)

            return (
              <div key={stage.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-300 font-medium">{stage.name}</span>
                  <div className="flex items-center gap-3">
                    {/* Value at stage */}
                    {stage.value > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatCurrency(stage.value)}
                      </span>
                    )}
                    {/* Time in stage */}
                    {stage.avgDaysInStage > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {stage.avgDaysInStage}d avg
                      </span>
                    )}
                    <span className="text-white font-bold">{stage.count}</span>
                    {index > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getConversionBg(stage.conversionRate)}`}>
                        {stage.conversionRate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-gray-800 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: stage.color,
                      opacity: 0.8,
                    }}
                  >
                    {widthPct > 20 && (
                      <span className="text-xs font-medium text-white/80">
                        {stage.count}
                      </span>
                    )}
                  </div>
                </div>

                {/* Drop-off indicator between stages */}
                {index < data.stages.length - 1 && stage.dropOff > 0 && (
                  <div className="flex items-center justify-center my-1">
                    <div className={`flex items-center gap-1 text-xs ${getDropOffColor(stage.dropOff)}`}>
                      <TrendingDown className="w-3 h-3" />
                      <span>{stage.dropOff}% drop-off</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stage-by-stage breakdown - Enhanced with time and value */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-3">Stage Conversion Breakdown</h3>
        <div className="space-y-2">
          {data.stages.slice(1).map((stage, index) => {
            const prevStage = data.stages[index]
            return (
              <div
                key={stage.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-black/20 rounded-lg gap-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">{prevStage.name}</span>
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  <span className="text-white font-medium">{stage.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Time in stage */}
                  {stage.avgDaysInStage > 0 && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded">
                      <Clock className="w-3 h-3" />
                      {stage.avgDaysInStage}d
                    </span>
                  )}
                  {/* Value delta */}
                  {stage.value > 0 && prevStage.value > 0 && (
                    <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded">
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(stage.value)}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {prevStage.count} &rarr; {stage.count}
                  </span>
                  <span className={`text-sm font-bold ${getConversionColor(stage.conversionRate)}`}>
                    {stage.conversionRate}%
                  </span>
                  {/* Drop-off badge */}
                  {stage.dropOff > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full bg-red-500/10 ${getDropOffColor(stage.dropOff)}`}>
                      -{stage.dropOff}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Value Flow Visualization */}
      {data.stages.some(s => s.value > 0) && (
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            Value at Each Stage
          </h3>
          <div className="space-y-2">
            {data.stages.map((stage) => {
              const valuePct = maxValue > 0 ? Math.max(5, (stage.value / maxValue) * 100) : 0
              return (
                <div key={`val-${stage.name}`} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-24 text-right flex-shrink-0">{stage.name}</span>
                  <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
                    <div
                      className="h-full rounded transition-all duration-700 flex items-center pl-2"
                      style={{
                        width: `${valuePct}%`,
                        backgroundColor: stage.color,
                        opacity: 0.6,
                      }}
                    >
                      {valuePct > 15 && (
                        <span className="text-[10px] font-medium text-white/80">{formatCurrency(stage.value)}</span>
                      )}
                    </div>
                  </div>
                  {valuePct <= 15 && stage.value > 0 && (
                    <span className="text-xs text-gray-500">{formatCurrency(stage.value)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
