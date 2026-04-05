'use client'

import type { TeamTarget } from '@/types/cro-manager'

interface PerformanceTableProps {
  targets: TeamTarget[]
  loading?: boolean
  emptyMessage?: string
}

export default function PerformanceTable({
  targets,
  loading = false,
  emptyMessage = 'No target data available',
}: PerformanceTableProps) {
  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading targets...</span>
        </div>
      </div>
    )
  }

  if (targets.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">CRO Name</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-center">
                Calls
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-center">
                Leads
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-center">
                Conversions
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase text-center">
                Achievement
              </th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => (
              <tr
                key={target.croId}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-white">{target.croName}</td>
                <td className="px-4 py-3">
                  <ProgressCell actual={target.actualCalls} target={target.targetCalls} />
                </td>
                <td className="px-4 py-3">
                  <ProgressCell actual={target.actualLeads} target={target.targetLeads} />
                </td>
                <td className="px-4 py-3">
                  <ProgressCell actual={target.actualConversions} target={target.targetConversions} />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-sm font-bold ${
                      target.achievementPercent >= 100
                        ? 'text-green-400'
                        : target.achievementPercent >= 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {target.achievementPercent.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ProgressCell({ actual, target }: { actual: number; target: number }) {
  const percent = target > 0 ? Math.min(100, (actual / target) * 100) : 0
  return (
    <div className="text-center">
      <div className="text-sm text-gray-300">
        {actual} / {target}
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full mt-1">
        <div
          className={`h-1.5 rounded-full transition-all ${
            percent >= 100 ? 'bg-green-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-orange-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
