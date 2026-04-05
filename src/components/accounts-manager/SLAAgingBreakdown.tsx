'use client'

import React from 'react'
import { Timer, FileText, Users, Building2 } from 'lucide-react'

interface BucketData {
  bucket_0_1: number
  bucket_1_3: number
  bucket_3_7: number
  bucket_7_14: number
  bucket_14_plus: number
}

interface Props {
  agingBreakdown: {
    cp: BucketData
    ba: BucketData
    bp: BucketData
  }
}

const bucketLabels = ['0-1d', '1-3d', '3-7d', '7-14d', '14+d']
const bucketColors = [
  { bg: 'bg-green-500', label: 'text-green-400' },
  { bg: 'bg-lime-500', label: 'text-lime-400' },
  { bg: 'bg-yellow-500', label: 'text-yellow-400' },
  { bg: 'bg-orange-500', label: 'text-orange-400' },
  { bg: 'bg-red-500', label: 'text-red-400' },
]

function getBuckets(data: BucketData): number[] {
  return [data.bucket_0_1, data.bucket_1_3, data.bucket_3_7, data.bucket_7_14, data.bucket_14_plus]
}

function getTotal(data: BucketData): number {
  return data.bucket_0_1 + data.bucket_1_3 + data.bucket_3_7 + data.bucket_7_14 + data.bucket_14_plus
}

function getAvgAge(data: BucketData): string {
  const total = getTotal(data)
  if (total === 0) return '0'
  const weighted = data.bucket_0_1 * 0.5 + data.bucket_1_3 * 2 + data.bucket_3_7 * 5 + data.bucket_7_14 * 10.5 + data.bucket_14_plus * 18
  return (weighted / total).toFixed(1)
}

export default function SLAAgingBreakdown({ agingBreakdown }: Props) {
  const rows = [
    { label: 'CP', icon: FileText, color: 'text-yellow-400', data: agingBreakdown.cp },
    { label: 'BA', icon: Users, color: 'text-orange-400', data: agingBreakdown.ba },
    { label: 'BP', icon: Building2, color: 'text-amber-400', data: agingBreakdown.bp },
  ]

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Timer className="w-5 h-5 text-orange-500" />
        SLA Aging Breakdown
      </h2>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
        {bucketLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${bucketColors[i].bg}/60`} />
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {rows.map((row) => {
          const Icon = row.icon
          const buckets = getBuckets(row.data)
          const total = getTotal(row.data)
          const avgAge = getAvgAge(row.data)

          return (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${row.color}`} />
                  <span className="text-sm font-medium text-white">{row.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>Total: <span className="text-white font-medium">{total}</span></span>
                  <span>Avg: <span className="text-white font-medium">{avgAge}d</span></span>
                </div>
              </div>

              {/* Stacked horizontal bar */}
              <div className="w-full h-7 rounded-md overflow-hidden flex bg-gray-800/50 relative group">
                {total === 0 ? (
                  <div className="w-full flex items-center justify-center text-xs text-gray-600">No pending items</div>
                ) : (
                  buckets.map((count, i) => {
                    if (count === 0) return null
                    const pct = (count / total) * 100
                    return (
                      <div
                        key={i}
                        className={`${bucketColors[i].bg}/60 flex items-center justify-center relative group/seg transition-all hover:brightness-125`}
                        style={{ width: `${pct}%`, minWidth: count > 0 ? '20px' : 0 }}
                      >
                        <span className="text-[10px] font-medium text-white/90">{count}</span>
                        {/* Tooltip */}
                        <div className="absolute -top-8 hidden group-hover/seg:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                          {bucketLabels[i]}: {count} items ({pct.toFixed(0)}%)
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
