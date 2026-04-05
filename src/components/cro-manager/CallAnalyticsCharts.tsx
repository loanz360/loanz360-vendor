'use client'

import type { CallAnalyticsSummary } from '@/types/cro-manager'

interface CallAnalyticsChartsProps {
  data: CallAnalyticsSummary | null
  loading?: boolean
}

export default function CallAnalyticsCharts({ data, loading = false }: CallAnalyticsChartsProps) {
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">No call analytics data available</p>
      </div>
    )
  }

  const maxDailyCalls = Math.max(...data.dailyTrend.map((d) => d.calls), 1)

  return (
    <div className="space-y-6">
      {/* Outcome Distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 uppercase mb-4">Call Outcomes</h3>
        <div className="space-y-3">
          {Object.entries(data.outcomes).map(([outcome, count]) => {
            const percent = data.totalCalls > 0 ? (count / data.totalCalls) * 100 : 0
            return (
              <div key={outcome} className="flex items-center gap-3">
                <span className="text-sm text-gray-300 w-28 truncate capitalize">
                  {outcome.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-orange-500 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-12 text-right">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Daily Trend (simple bar chart) */}
      {data.dailyTrend.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase mb-4">Daily Call Trend</h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyTrend.map((day) => {
              const height = maxDailyCalls > 0 ? (day.calls / maxDailyCalls) * 100 : 0
              const connectedHeight = maxDailyCalls > 0 ? (day.connected / maxDailyCalls) * 100 : 0
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-gray-700 rounded-t"
                      style={{ height: `${height}%` }}
                    />
                    <div
                      className="absolute bottom-0 w-full bg-orange-500 rounded-t"
                      style={{ height: `${connectedHeight}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 truncate w-full text-center">
                    {new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-gray-700 rounded" />
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-orange-500 rounded" />
              <span className="text-xs text-gray-400">Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* CRO Breakdown */}
      {data.croBreakdown.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-400 uppercase">CRO Call Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">CRO</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-center">Calls</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-center">Connected</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-center">Avg Duration</th>
                  <th className="px-4 py-2 text-xs font-medium text-gray-400 uppercase text-center">Positive %</th>
                </tr>
              </thead>
              <tbody>
                {data.croBreakdown.map((cro) => (
                  <tr key={cro.croId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-sm text-white">{cro.croName}</td>
                    <td className="px-4 py-2 text-sm text-gray-300 text-center">{cro.calls}</td>
                    <td className="px-4 py-2 text-sm text-gray-300 text-center">{cro.connected}</td>
                    <td className="px-4 py-2 text-sm text-gray-300 text-center">
                      {Math.floor(cro.avgDuration / 60)}m {cro.avgDuration % 60}s
                    </td>
                    <td className="px-4 py-2 text-sm text-center">
                      <span className={cro.positiveRate >= 30 ? 'text-green-400' : 'text-gray-400'}>
                        {cro.positiveRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
