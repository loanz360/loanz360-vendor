'use client'

import React from 'react'
import { Timer, Zap, Snail, BarChart3 } from 'lucide-react'

interface ProcessingTimeData {
  avg_hours: number
  median_hours: number
  fastest_hours: number
  slowest_hours: number
  sample_size: number
}

interface Props {
  processingTime: ProcessingTimeData
}

function formatDuration(hours: number): string {
  if (hours === 0) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

export default function AvgProcessingTime({ processingTime }: Props) {
  const metrics = [
    {
      label: 'Average',
      value: processingTime.avg_hours,
      icon: Timer,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Median',
      value: processingTime.median_hours,
      icon: BarChart3,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Fastest',
      value: processingTime.fastest_hours,
      icon: Zap,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Slowest',
      value: processingTime.slowest_hours,
      icon: Snail,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
  ]

  // SLA benchmark: target is 48 hours (2 days)
  const slaTarget = 48
  const isWithinSLA = processingTime.avg_hours <= slaTarget
  const slaPercentage = processingTime.avg_hours > 0
    ? Math.min(100, Math.round((slaTarget / processingTime.avg_hours) * 100))
    : 100

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Timer className="w-5 h-5 text-orange-500" />
        Processing Time
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className={`p-3 rounded-lg ${metric.bg} border border-gray-800`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${metric.color}`} />
                <span className="text-xs text-gray-400">{metric.label}</span>
              </div>
              <p className="text-lg font-bold text-white">{formatDuration(metric.value)}</p>
            </div>
          )
        })}
      </div>

      {/* SLA Benchmark */}
      <div className={`p-3 rounded-lg border ${isWithinSLA ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">SLA Target: {formatDuration(slaTarget)}</span>
          <span className={`text-xs font-medium ${isWithinSLA ? 'text-green-400' : 'text-red-400'}`}>
            {isWithinSLA ? 'Within SLA' : 'Exceeding SLA'}
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-800/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isWithinSLA ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${slaPercentage}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-600 mt-3 text-center">
        Based on {processingTime.sample_size} verified application{processingTime.sample_size !== 1 ? 's' : ''} this month
      </p>
    </div>
  )
}
