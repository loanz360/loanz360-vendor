'use client'

import React from 'react'
import { LayoutGrid } from 'lucide-react'

interface Props {
  workloadData: {
    id: string
    name: string
    in_progress: number
    pending_review: number
    total_active: number
    capacity: number
    last_login_at: string | null
  }[]
}

export default function WorkloadHeatmap({ workloadData }: Props) {
  const getUtilization = (active: number, capacity: number) => {
    if (capacity === 0) return 0
    return Math.min((active / capacity) * 100, 100)
  }

  const getHeatColor = (active: number, capacity: number) => {
    const pct = getUtilization(active, capacity)
    if (pct >= 90) return 'bg-red-500/40 border-red-500/50'
    if (pct >= 70) return 'bg-orange-500/30 border-orange-500/40'
    if (pct >= 50) return 'bg-yellow-500/25 border-yellow-500/35'
    if (pct >= 25) return 'bg-green-500/20 border-green-500/30'
    return 'bg-gray-800/40 border-gray-700/50'
  }

  const getStatusDot = (lastLogin: string | null) => {
    if (!lastLogin) return 'bg-gray-500'
    const diff = Date.now() - new Date(lastLogin).getTime()
    if (diff < 5 * 60000) return 'bg-green-400 animate-pulse'
    if (diff < 60 * 60000) return 'bg-yellow-400'
    return 'bg-gray-500'
  }

  const getStatusLabel = (lastLogin: string | null) => {
    if (!lastLogin) return 'Offline'
    const diff = Date.now() - new Date(lastLogin).getTime()
    if (diff < 5 * 60000) return 'Online'
    if (diff < 60 * 60000) return 'Away'
    return 'Offline'
  }

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <LayoutGrid className="w-5 h-5 text-orange-500" />
        Workload Heatmap
      </h2>

      {workloadData.length === 0 ? (
        <p className="text-center py-6 text-gray-500 text-sm">No team members found</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {workloadData.map((member) => {
            const utilPct = getUtilization(member.total_active, member.capacity)
            return (
              <div
                key={member.id}
                className={`relative p-3 rounded-lg border transition-all hover:scale-[1.02] ${getHeatColor(member.total_active, member.capacity)}`}
              >
                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                  {member.in_progress} in progress, {member.pending_review} pending review
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(member.last_login_at)}`} />
                  <p className="text-sm font-medium text-white truncate">{member.name}</p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{member.total_active}/{member.capacity}</span>
                  <span>{getStatusLabel(member.last_login_at)}</span>
                </div>

                {/* Utilization bar */}
                <div className="w-full h-1.5 rounded-full bg-gray-800/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      utilPct >= 90 ? 'bg-red-400' : utilPct >= 70 ? 'bg-orange-400' : utilPct >= 50 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
                  <span>{member.in_progress} active</span>
                  <span>{member.pending_review} review</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-gray-800/40" /> &lt;25%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500/20" /> 25-50%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-500/25" /> 50-70%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-orange-500/30" /> 70-90%</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500/40" /> 90%+</div>
      </div>
    </div>
  )
}
