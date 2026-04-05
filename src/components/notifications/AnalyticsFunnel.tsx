'use client'

import { useState } from 'react'
import {
  Send,
  CheckCircle,
  Eye,
  MousePointerClick,
  Trophy,
  TrendingDown,
  BarChart3,
  Calendar
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

interface FunnelData {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
}

interface AnalyticsFunnelProps {
  data: FunnelData
  title?: string
  period?: string
  className?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STAGES = [
  { key: 'sent', label: 'Sent', color: 'bg-blue-500', textColor: 'text-blue-400', borderColor: 'border-blue-500/30', icon: Send },
  { key: 'delivered', label: 'Delivered', color: 'bg-green-500', textColor: 'text-green-400', borderColor: 'border-green-500/30', icon: CheckCircle },
  { key: 'opened', label: 'Opened', color: 'bg-orange-500', textColor: 'text-orange-400', borderColor: 'border-orange-500/30', icon: Eye },
  { key: 'clicked', label: 'Clicked', color: 'bg-purple-500', textColor: 'text-purple-400', borderColor: 'border-purple-500/30', icon: MousePointerClick },
  { key: 'converted', label: 'Converted', color: 'bg-yellow-500', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30', icon: Trophy },
] as const

// ============================================================================
// HELPERS
// ============================================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString()
}

function calcPercentage(value: number, total: number): string {
  if (total === 0) return '0'
  return ((value / total) * 100).toFixed(1).replace(/\.0$/, '')
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AnalyticsFunnel({
  data,
  title = 'Notification Delivery Funnel',
  period = 'Last 30 days',
  className = '',
}: AnalyticsFunnelProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null)

  const maxCount = data.sent || 1
  const conversionRate = data.sent > 0
    ? ((data.converted / data.sent) * 100).toFixed(2)
    : '0'

  return (
    <div className={`bg-gray-900 border border-white/10 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              {period}
            </div>
          </div>
        </div>

        {/* Conversion rate badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-gray-300">Conversion Rate</span>
          <span className="text-xl font-bold text-yellow-400">{conversionRate}%</span>
        </div>
      </div>

      {/* Funnel visualization */}
      <div className="space-y-1">
        {STAGES.map((stage, index) => {
          const count = data[stage.key as keyof FunnelData]
          const widthPercent = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8
          const prevCount = index > 0 ? data[STAGES[index - 1].key as keyof FunnelData] : null
          const dropOff = prevCount !== null && prevCount > 0
            ? (((prevCount - count) / prevCount) * 100).toFixed(1)
            : null
          const isHovered = hoveredStage === stage.key
          const StageIcon = stage.icon

          return (
            <div key={stage.key}>
              {/* Drop-off indicator between stages */}
              {dropOff !== null && (
                <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-gray-500">
                  <TrendingDown className="w-3 h-3" />
                  <span>-{dropOff}% drop-off</span>
                </div>
              )}

              {/* Funnel bar */}
              <div
                className="relative mx-auto cursor-pointer group"
                style={{ width: `${widthPercent}%`, minWidth: '200px', maxWidth: '100%' }}
                onMouseEnter={() => setHoveredStage(stage.key)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                <div
                  className={`
                    relative flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-200
                    ${stage.color}/15 ${stage.borderColor}
                    ${isHovered ? 'ring-1 ring-white/20 scale-[1.01]' : ''}
                  `}
                  style={{
                    background: `linear-gradient(90deg, ${
                      stage.key === 'sent' ? 'rgba(59,130,246,0.15)' :
                      stage.key === 'delivered' ? 'rgba(34,197,94,0.15)' :
                      stage.key === 'opened' ? 'rgba(249,115,22,0.15)' :
                      stage.key === 'clicked' ? 'rgba(168,85,247,0.15)' :
                      'rgba(234,179,8,0.15)'
                    } 0%, transparent 100%)`,
                  }}
                >
                  {/* Left side: icon + label */}
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${stage.color}/20`}>
                      <StageIcon className={`w-4 h-4 ${stage.textColor}`} />
                    </div>
                    <span className="text-sm font-medium text-white">{stage.label}</span>
                  </div>

                  {/* Right side: count + percentage */}
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${stage.textColor}`}>
                      {formatNumber(count)}
                    </span>
                    <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                      {calcPercentage(count, maxCount)}%
                    </span>
                  </div>

                  {/* Hover tooltip */}
                  {isHovered && (
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg shadow-xl whitespace-nowrap">
                      <div className="text-xs text-gray-300">
                        <span className="font-semibold text-white">{count.toLocaleString()}</span>
                        {' '}notifications {stage.label.toLowerCase()}
                        {prevCount !== null && (
                          <span className="text-gray-500">
                            {' '}({calcPercentage(count, prevCount)}% of {STAGES[index - 1].label.toLowerCase()})
                          </span>
                        )}
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 border-b border-r border-white/10 rotate-45" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/5">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Delivery Rate</p>
          <p className="text-sm font-semibold text-green-400">
            {calcPercentage(data.delivered, data.sent)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Open Rate</p>
          <p className="text-sm font-semibold text-orange-400">
            {calcPercentage(data.opened, data.delivered)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Click Rate</p>
          <p className="text-sm font-semibold text-purple-400">
            {calcPercentage(data.clicked, data.opened)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-0.5">Click to Convert</p>
          <p className="text-sm font-semibold text-yellow-400">
            {calcPercentage(data.converted, data.clicked)}%
          </p>
        </div>
      </div>
    </div>
  )
}
