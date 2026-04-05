'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Info } from 'lucide-react'
import { formatINR } from '@/lib/utils/cro-helpers'

interface FunnelStage {
  label: string
  count: number
  value?: number
  color: string
}

interface ConversionFunnelProps {
  stages: FunnelStage[]
  loading?: boolean
  title?: string
  dateRange?: string
}

export default function ConversionFunnel({ stages, loading, title = 'Sales Funnel', dateRange }: ConversionFunnelProps) {
  const maxCount = Math.max(...stages.map(s => s.count), 1)

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
        <div className="h-6 w-40 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {dateRange && <p className="text-xs text-gray-500 mt-1">{dateRange}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {stages.map((stage, i) => {
          const widthPercent = Math.max((stage.count / maxCount) * 100, 8)
          const conversionRate = i > 0 && stages[i - 1].count > 0
            ? ((stage.count / stages[i - 1].count) * 100).toFixed(1)
            : null

          return (
            <div key={stage.label} className="group">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400 font-medium">{stage.label}</span>
                <div className="flex items-center gap-3">
                  {conversionRate && (
                    <span className="text-gray-500">
                      {Number(conversionRate) >= 50 ? (
                        <TrendingUp className="inline h-3 w-3 text-green-400 mr-1" />
                      ) : Number(conversionRate) < 25 ? (
                        <TrendingDown className="inline h-3 w-3 text-red-400 mr-1" />
                      ) : (
                        <Minus className="inline h-3 w-3 text-yellow-400 mr-1" />
                      )}
                      {conversionRate}%
                    </span>
                  )}
                  <span className="text-white font-semibold">{stage.count}</span>
                  {stage.value != null && stage.value > 0 && (
                    <span className="text-gray-500">{formatINR(stage.value)}</span>
                  )}
                </div>
              </div>
              <div className="h-10 bg-gray-800/50 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-700 ease-out flex items-center px-3"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: stage.color,
                    opacity: 0.8,
                  }}
                >
                  {widthPercent > 20 && (
                    <span className="text-xs font-bold text-white/90">{stage.count}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall conversion rate */}
      {stages.length >= 2 && stages[0].count > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between">
          <span className="text-sm text-gray-400">Overall Conversion Rate</span>
          <span className="text-lg font-bold text-orange-400">
            {((stages[stages.length - 1].count / stages[0].count) * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  )
}
