'use client'

import React from 'react'
import { Scale, AlertCircle } from 'lucide-react'

interface WorkloadItem {
  id: string
  name: string
  sub_role: string
  current_queue: number
}

interface Props {
  workloadDistribution: WorkloadItem[]
}

export default function WorkloadDistribution({ workloadDistribution }: Props) {
  const executives = workloadDistribution.filter(w => w.sub_role === 'ACCOUNTS_EXECUTIVE')
  const maxQueue = Math.max(...executives.map(e => e.current_queue), 1)
  const totalQueue = executives.reduce((sum, e) => sum + e.current_queue, 0)
  const avgQueue = executives.length > 0 ? totalQueue / executives.length : 0

  // Imbalance detection: if any AE has >2x the average
  const isImbalanced = executives.some(e => e.current_queue > avgQueue * 2 && avgQueue > 0)

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Scale className="w-5 h-5 text-orange-500" />
          Workload Distribution
        </h2>
        {isImbalanced && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Imbalanced
          </span>
        )}
      </div>

      <div className="space-y-3">
        {executives.map((member) => {
          const barWidth = maxQueue > 0 ? (member.current_queue / maxQueue) * 100 : 0
          const isOverloaded = avgQueue > 0 && member.current_queue > avgQueue * 2
          const isIdle = member.current_queue === 0 && totalQueue > 0

          return (
            <div key={member.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className={`text-gray-300 ${isOverloaded ? 'font-medium text-orange-300' : ''}`}>
                  {member.name.split(' ')[0]}
                </span>
                <span className={`font-medium ${
                  isOverloaded ? 'text-orange-400' :
                  isIdle ? 'text-gray-500' :
                  'text-white'
                }`}>
                  {member.current_queue} in queue
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-gray-800/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverloaded ? 'bg-orange-500' :
                    isIdle ? 'bg-gray-600' :
                    'bg-blue-500/70'
                  }`}
                  style={{ width: `${Math.max(barWidth, member.current_queue > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {executives.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>Total in queue: {totalQueue}</span>
          <span>Avg: {avgQueue.toFixed(1)} per AE</span>
        </div>
      )}

      {executives.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">No executives found</p>
      )}
    </div>
  )
}
