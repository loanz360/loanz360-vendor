'use client'

import React from 'react'
import { BrainCircuit, TrendingUp, TrendingDown, Minus, Calendar, Activity, ArrowRight } from 'lucide-react'

interface Props {
  predictions: {
    current_pending: number
    daily_clearance_rate: number
    daily_incoming_rate: number
    projected_end_of_week: number
    estimated_clearance_days: number | null
    velocity_trend: 'accelerating' | 'decelerating' | 'stable'
    week_over_week_change: number
  }
}

export default function PredictiveAnalytics({ predictions }: Props) {
  const VelocityIcon = predictions.velocity_trend === 'accelerating' ? TrendingUp
    : predictions.velocity_trend === 'decelerating' ? TrendingDown
    : Minus

  const velocityColor = predictions.velocity_trend === 'accelerating' ? 'text-green-400'
    : predictions.velocity_trend === 'decelerating' ? 'text-red-400'
    : 'text-yellow-400'

  const velocityLabel = predictions.velocity_trend === 'accelerating' ? 'Accelerating'
    : predictions.velocity_trend === 'decelerating' ? 'Decelerating'
    : 'Stable'

  const netRate = predictions.daily_clearance_rate - predictions.daily_incoming_rate
  const isClearing = netRate > 0

  const wowColor = predictions.week_over_week_change > 0 ? 'text-red-400' : predictions.week_over_week_change < 0 ? 'text-green-400' : 'text-gray-400'
  const wowPrefix = predictions.week_over_week_change > 0 ? '+' : ''

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-orange-500" />
          Predictive Analytics
        </h2>
        <div className={`flex items-center gap-1 text-xs ${velocityColor}`}>
          <VelocityIcon className="w-3.5 h-3.5" />
          {velocityLabel}
        </div>
      </div>

      {/* Current state */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-600/10 to-blue-500/10 border border-purple-500/15 mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Pending</p>
        <p className="text-3xl font-bold text-white">{predictions.current_pending}</p>
        <div className={`text-xs mt-1 ${wowColor}`}>
          {wowPrefix}{predictions.week_over_week_change}% week-over-week
        </div>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-gray-400">Incoming</span>
          </div>
          <p className="text-lg font-bold text-white">{predictions.daily_incoming_rate}</p>
          <p className="text-[10px] text-gray-500">per day</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Average new items per day
          </div>
        </div>
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-gray-400">Clearance</span>
          </div>
          <p className="text-lg font-bold text-white">{predictions.daily_clearance_rate}</p>
          <p className="text-[10px] text-gray-500">per day</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Average items cleared per day
          </div>
        </div>
      </div>

      {/* Projections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-gray-300">End of Week Projection</span>
          </div>
          <span className={`text-sm font-bold ${predictions.projected_end_of_week > predictions.current_pending ? 'text-red-400' : 'text-green-400'}`}>
            {predictions.projected_end_of_week}
          </span>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Projected pending count by end of this week
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Est. Clearance</span>
          </div>
          <span className={`text-sm font-bold ${isClearing ? 'text-green-400' : 'text-red-400'}`}>
            {predictions.estimated_clearance_days !== null
              ? `${predictions.estimated_clearance_days} days`
              : 'Not clearing'}
          </span>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            {predictions.estimated_clearance_days !== null
              ? 'Days to clear all pending at current rate'
              : 'Incoming rate exceeds clearance rate'}
          </div>
        </div>

        {/* Net rate indicator */}
        <div className={`p-3 rounded-lg border text-center text-xs ${
          isClearing
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          Net rate: {isClearing ? 'Clearing' : 'Accumulating'} {Math.abs(netRate).toFixed(1)} items/day
        </div>
      </div>
    </div>
  )
}
