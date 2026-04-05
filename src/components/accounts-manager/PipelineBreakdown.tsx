'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Layers, ArrowRight } from 'lucide-react'

interface PipelineStats {
  cp: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
  ba: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
  bp: { pending: number; in_verification: number; verified_today: number; sa_approved: number; finance_processing: number }
}

interface Props {
  stats: PipelineStats
}

const stages = [
  { key: 'pending', label: 'Pending', color: 'bg-yellow-500/60' },
  { key: 'in_verification', label: 'In Verification', color: 'bg-blue-500/60' },
  { key: 'verified_today', label: 'Verified Today', color: 'bg-green-500/60' },
  { key: 'sa_approved', label: 'SA Approved', color: 'bg-emerald-500/60' },
  { key: 'finance_processing', label: 'Finance', color: 'bg-purple-500/60' },
] as const

export default function PipelineBreakdown({ stats }: Props) {
  const router = useRouter()
  const types = [
    { key: 'cp', label: 'CP', data: stats.cp, href: '/employees/accounts-executive/cp-applications', color: 'text-yellow-400' },
    { key: 'ba', label: 'BA', data: stats.ba, href: '/employees/accounts-executive/ba-applications', color: 'text-orange-400' },
    { key: 'bp', label: 'BP', data: stats.bp, href: '/employees/accounts-executive/bp-applications', color: 'text-amber-400' },
  ] as const

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Layers className="w-5 h-5 text-orange-500" />
        Pipeline Breakdown
      </h2>
      <div className="space-y-4">
        {types.map((type) => {
          const total = type.data.pending + type.data.in_verification + type.data.verified_today + type.data.sa_approved + type.data.finance_processing
          return (
            <div key={type.key}>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => router.push(type.href)}
                  className={`text-sm font-medium ${type.color} hover:underline flex items-center gap-1`}
                >
                  {type.label} Pipeline
                  <ArrowRight className="w-3 h-3" />
                </button>
                <span className="text-xs text-gray-500">{total} total</span>
              </div>
              {/* Stacked horizontal bar */}
              <div className="flex h-6 rounded-lg overflow-hidden bg-gray-800/50">
                {stages.map((stage) => {
                  const value = type.data[stage.key]
                  if (value === 0) return null
                  const width = total > 0 ? (value / total) * 100 : 0
                  return (
                    <div
                      key={stage.key}
                      className={`${stage.color} flex items-center justify-center text-[10px] text-white font-medium transition-all relative group`}
                      style={{ width: `${Math.max(width, 8)}%` }}
                    >
                      {value > 0 && width > 12 && value}
                      <div className="absolute -top-7 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-xs text-white whitespace-nowrap">
                        {stage.label}: {value}
                      </div>
                    </div>
                  )
                })}
                {total === 0 && (
                  <div className="flex items-center justify-center w-full text-xs text-gray-600">No applications</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${s.color}`} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}
