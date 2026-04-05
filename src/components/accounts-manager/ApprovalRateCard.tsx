'use client'

import React from 'react'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface ApprovalMetrics {
  current_rate: number
  prev_rate: number
  current_verified: number
  current_rejected: number
  prev_verified: number
  prev_rejected: number
  mom_change: number
}

interface Props {
  approvalMetrics: ApprovalMetrics
}

export default function ApprovalRateCard({ approvalMetrics }: Props) {
  const rateChange = approvalMetrics.current_rate - approvalMetrics.prev_rate
  const isImproving = rateChange > 0
  const isStable = rateChange === 0

  // Ring chart calculation
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (approvalMetrics.current_rate / 100) * circumference

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        {isImproving ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-orange-500" />}
        Approval Rate
      </h2>

      <div className="flex items-center gap-6">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r={radius} fill="none"
              stroke={approvalMetrics.current_rate >= 80 ? '#22c55e' : approvalMetrics.current_rate >= 60 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{approvalMetrics.current_rate}%</span>
            <span className="text-[10px] text-gray-500 uppercase">This Month</span>
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="flex-1 space-y-3">
          {/* MoM change */}
          <div className="flex items-center gap-2">
            {isStable ? (
              <Minus className="w-4 h-4 text-gray-400" />
            ) : isImproving ? (
              <ArrowUpRight className="w-4 h-4 text-green-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${isStable ? 'text-gray-400' : isImproving ? 'text-green-400' : 'text-red-400'}`}>
              {isStable ? 'No change' : `${Math.abs(rateChange)}% ${isImproving ? 'up' : 'down'}`} from last month
            </span>
          </div>

          {/* Volume MoM */}
          <div className="flex items-center gap-2">
            {approvalMetrics.mom_change >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-green-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${approvalMetrics.mom_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {approvalMetrics.mom_change >= 0 ? '+' : ''}{approvalMetrics.mom_change}% volume vs last month
            </span>
          </div>

          {/* This month vs Last month */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 rounded bg-gray-800/50">
              <p className="text-xs text-gray-500">This Month</p>
              <p className="text-sm text-white">
                <span className="text-green-400">{approvalMetrics.current_verified}</span> /
                <span className="text-red-400 ml-1">{approvalMetrics.current_rejected}</span>
              </p>
            </div>
            <div className="p-2 rounded bg-gray-800/50">
              <p className="text-xs text-gray-500">Last Month</p>
              <p className="text-sm text-white">
                <span className="text-green-400">{approvalMetrics.prev_verified}</span> /
                <span className="text-red-400 ml-1">{approvalMetrics.prev_rejected}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
