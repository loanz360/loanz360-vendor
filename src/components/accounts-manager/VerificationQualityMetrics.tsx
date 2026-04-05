'use client'

import React from 'react'
import { ShieldCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Props {
  qualityMetrics: {
    total_verified: number
    post_verification_rejections: number
    accuracy_rate: number
    common_rejection_reasons: { reason: string; count: number }[]
    trend: 'improving' | 'declining' | 'stable'
  }
}

function CircularProgress({ value, size = 80, strokeWidth = 6, color }: { value: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-sm font-bold text-white">{value.toFixed(1)}%</span>
    </div>
  )
}

export default function VerificationQualityMetrics({ qualityMetrics }: Props) {
  const rejectionRate = qualityMetrics.total_verified > 0
    ? (qualityMetrics.post_verification_rejections / qualityMetrics.total_verified) * 100
    : 0

  const TrendIcon = qualityMetrics.trend === 'improving' ? TrendingUp
    : qualityMetrics.trend === 'declining' ? TrendingDown
    : Minus

  const trendColor = qualityMetrics.trend === 'improving' ? 'text-green-400'
    : qualityMetrics.trend === 'declining' ? 'text-red-400'
    : 'text-yellow-400'

  const trendLabel = qualityMetrics.trend === 'improving' ? 'Improving'
    : qualityMetrics.trend === 'declining' ? 'Declining'
    : 'Stable'

  const maxReasonCount = Math.max(...qualityMetrics.common_rejection_reasons.map(r => r.count), 1)

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-orange-500" />
          Verification Quality
        </h2>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {trendLabel}
        </div>
      </div>

      {/* Circular indicators */}
      <div className="flex items-center justify-around mb-6">
        <div className="flex flex-col items-center gap-2 group relative">
          <CircularProgress value={qualityMetrics.accuracy_rate} color="#22c55e" />
          <span className="text-xs text-gray-400">Accuracy</span>
          {/* Tooltip */}
          <div className="absolute -top-8 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            {qualityMetrics.total_verified} verified total
          </div>
        </div>
        <div className="flex flex-col items-center gap-2 group relative">
          <CircularProgress value={rejectionRate} color="#ef4444" />
          <span className="text-xs text-gray-400">Rejection Rate</span>
          {/* Tooltip */}
          <div className="absolute -top-8 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            {qualityMetrics.post_verification_rejections} rejected post-verification
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 text-center">
          <p className="text-lg font-bold text-white">{qualityMetrics.total_verified}</p>
          <p className="text-xs text-gray-400">Total Verified</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 text-center">
          <p className="text-lg font-bold text-white">{qualityMetrics.post_verification_rejections}</p>
          <p className="text-xs text-gray-400">Post Rejections</p>
        </div>
      </div>

      {/* Common rejection reasons */}
      {qualityMetrics.common_rejection_reasons.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Top Rejection Reasons</p>
          <div className="space-y-2">
            {qualityMetrics.common_rejection_reasons.slice(0, 5).map((reason) => (
              <div key={reason.reason} className="group relative">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-300 truncate mr-2">{reason.reason}</span>
                  <span className="text-gray-500 flex-shrink-0">{reason.count}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-800/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500/50 transition-all"
                    style={{ width: `${(reason.count / maxReasonCount) * 100}%` }}
                  />
                </div>
                {/* Tooltip */}
                <div className="absolute -top-6 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                  {reason.reason}: {reason.count} occurrences
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
