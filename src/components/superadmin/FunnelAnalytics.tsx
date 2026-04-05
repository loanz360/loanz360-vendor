'use client'

/**
 * E35: Funnel Analytics
 * Lead -> Application -> Sanction -> Disbursal drop-off visualization
 */

import { useMemo } from 'react'

interface FunnelStage {
  label: string
  count: number
  color: string
  percentage?: number
}

interface FunnelAnalyticsProps {
  data: {
    total_leads: number
    applications: number
    sanctioned: number
    disbursed: number
    rejected: number
    dropped: number
  }
}

export function FunnelAnalytics({ data }: FunnelAnalyticsProps) {
  const stages = useMemo<FunnelStage[]>(() => {
    const total = data.total_leads || 1
    return [
      { label: 'Total Leads', count: data.total_leads, color: 'blue', percentage: 100 },
      { label: 'Applications', count: data.applications, color: 'purple', percentage: Math.round((data.applications / total) * 100) },
      { label: 'Sanctioned', count: data.sanctioned, color: 'orange', percentage: Math.round((data.sanctioned / total) * 100) },
      { label: 'Disbursed', count: data.disbursed, color: 'green', percentage: Math.round((data.disbursed / total) * 100) },
    ]
  }, [data])

  const dropOffRates = useMemo(() => {
    if (!stages.length) return []
    return stages.slice(1).map((stage, i) => {
      const prev = stages[i]
      const dropOff = prev.count > 0 ? Math.round(((prev.count - stage.count) / prev.count) * 100) : 0
      return { from: prev.label, to: stage.label, dropOff, conversion: 100 - dropOff }
    })
  }, [stages])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white font-poppins mb-6">Conversion Funnel</h3>

      {/* Visual Funnel */}
      <div className="space-y-2 mb-8">
        {stages.map((stage, i) => (
          <div key={stage.label} className="relative">
            <div
              className={`bg-${stage.color}-500/20 border border-${stage.color}-500/30 rounded-lg p-4 transition-all`}
              style={{ width: `${Math.max(stage.percentage || 0, 20)}%`, marginLeft: `${(100 - Math.max(stage.percentage || 0, 20)) / 2}%` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{stage.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{stage.count.toLocaleString()}</span>
                  <span className={`text-xs text-${stage.color}-400`}>{stage.percentage}%</span>
                </div>
              </div>
            </div>

            {/* Drop-off indicator */}
            {i < stages.length - 1 && dropOffRates[i] && (
              <div className="flex items-center justify-center py-1">
                <span className="text-xs text-red-400">
                  {dropOffRates[i].dropOff}% drop-off
                </span>
                <span className="mx-2 text-gray-600">|</span>
                <span className="text-xs text-green-400">
                  {dropOffRates[i].conversion}% conversion
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Side Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
        <div className="text-center p-3 bg-red-500/10 rounded-lg">
          <p className="text-2xl font-bold text-red-400">{data.rejected.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Rejected</p>
        </div>
        <div className="text-center p-3 bg-gray-500/10 rounded-lg">
          <p className="text-2xl font-bold text-gray-400">{data.dropped.toLocaleString()}</p>
          <p className="text-xs text-gray-400">Dropped</p>
        </div>
      </div>
    </div>
  )
}
