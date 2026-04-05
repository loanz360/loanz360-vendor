'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Snowflake,
  Thermometer,
  Info,
  Clock,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────────

interface LeadScoreFactor {
  label: string
  value: number // -10 to +10 impact
  description?: string
}

interface LeadScoreIndicatorProps {
  score: number // 0-100
  factors?: LeadScoreFactor[]
  trend?: 'up' | 'down' | 'stable'
  lastUpdated?: string
  variant?: 'compact' | 'detailed' | 'badge'
}

// ── Score Configuration ──────────────────────────────────────────────────────────

interface ScoreConfig {
  label: string
  color: string
  bgGradient: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  glowColor: string
}

function getScoreConfig(score: number): ScoreConfig {
  if (score >= 71) {
    return {
      label: 'Hot',
      color: '#f97316',
      bgGradient: 'from-orange-500/20 to-red-500/10',
      badgeBg: 'bg-gradient-to-r from-orange-500/20 to-red-500/15',
      badgeText: 'text-orange-400',
      badgeBorder: 'border-orange-500/30',
      icon: Flame,
      glowColor: 'rgba(249, 115, 22, 0.3)',
    }
  }
  if (score >= 51) {
    return {
      label: 'Warm',
      color: '#f59e0b',
      bgGradient: 'from-amber-500/15 to-orange-500/10',
      badgeBg: 'bg-orange-500/15',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/30',
      icon: Thermometer,
      glowColor: 'rgba(245, 158, 11, 0.25)',
    }
  }
  if (score >= 31) {
    return {
      label: 'Cool',
      color: '#eab308',
      bgGradient: 'from-yellow-500/15 to-amber-500/10',
      badgeBg: 'bg-yellow-500/15',
      badgeText: 'text-yellow-400',
      badgeBorder: 'border-yellow-500/30',
      icon: Thermometer,
      glowColor: 'rgba(234, 179, 8, 0.2)',
    }
  }
  return {
    label: 'Cold',
    color: '#3b82f6',
    bgGradient: 'from-blue-500/15 to-cyan-500/10',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/30',
    icon: Snowflake,
    glowColor: 'rgba(59, 130, 246, 0.25)',
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function getFactorBarColor(value: number): string {
  if (value > 0) return 'bg-green-400'
  if (value < 0) return 'bg-red-400'
  return 'bg-gray-500'
}

function getTrendIcon(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return TrendingUp
    case 'down':
      return TrendingDown
    case 'stable':
      return Minus
  }
}

function getTrendConfig(trend: 'up' | 'down' | 'stable') {
  switch (trend) {
    case 'up':
      return { color: 'text-green-400', label: 'Trending up' }
    case 'down':
      return { color: 'text-red-400', label: 'Trending down' }
    case 'stable':
      return { color: 'text-gray-400', label: 'Stable' }
  }
}

// ── useAnimatedScore Hook ────────────────────────────────────────────────────────

function useAnimatedScore(targetScore: number): number {
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    const clamped = clampScore(targetScore)
    let current = 0
    const totalFrames = 40
    const step = clamped / totalFrames
    const interval = setInterval(() => {
      current += step
      if (current >= clamped) {
        current = clamped
        clearInterval(interval)
      }
      setAnimatedScore(Math.round(current))
    }, 16)
    return () => clearInterval(interval)
  }, [targetScore])

  return animatedScore
}

// ── Factor Tooltip ───────────────────────────────────────────────────────────────

function FactorTooltip({ description }: { description: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="p-0.5 rounded-full hover:bg-white/10 transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="Factor details"
      >
        <Info className="w-3 h-3 text-gray-500" />
      </button>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 pointer-events-none"
          >
            <div className="bg-gray-900 border border-white/15 rounded-lg px-3 py-2 shadow-2xl shadow-black/50">
              <p className="text-[11px] text-gray-300 leading-relaxed">
                {description}
              </p>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 bg-gray-900 border-r border-b border-white/15 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Compact Variant ──────────────────────────────────────────────────────────────
// For table rows: circular score badge with color + trend arrow

function CompactVariant({
  score,
  trend,
}: {
  score: number
  trend?: 'up' | 'down' | 'stable'
}) {
  const animatedScore = useAnimatedScore(score)
  const config = getScoreConfig(score)
  const TrendIcon = trend ? getTrendIcon(trend) : null
  const trendConfig = trend ? getTrendConfig(trend) : null

  const miniCircumference = 2 * Math.PI * 15
  const miniStrokeDashoffset =
    miniCircumference - (miniCircumference * animatedScore) / 100

  return (
    <div className="flex items-center gap-2">
      {/* Circular score badge */}
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="#1f2937"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={config.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={miniCircumference}
            strokeDashoffset={miniStrokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.6s ease-out',
              filter: `drop-shadow(0 0 3px ${config.glowColor})`,
            }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums"
          style={{ color: config.color }}
        >
          {animatedScore}
        </span>
      </div>

      {/* Trend arrow */}
      {TrendIcon && trendConfig && (
        <TrendIcon
          className={`w-3.5 h-3.5 flex-shrink-0 ${trendConfig.color}`}
          aria-label={trendConfig.label}
        />
      )}
    </div>
  )
}

// ── Badge Variant ────────────────────────────────────────────────────────────────
// For card headers: horizontal pill with score, color, label, icon

function BadgeVariant({
  score,
  trend,
}: {
  score: number
  trend?: 'up' | 'down' | 'stable'
}) {
  const clamped = clampScore(score)
  const config = getScoreConfig(clamped)
  const ScoreIcon = config.icon
  const TrendIcon = trend ? getTrendIcon(trend) : null
  const trendConfig = trend ? getTrendConfig(trend) : null

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
        font-medium text-xs
        ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}
      `}
    >
      <ScoreIcon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="tabular-nums font-bold">{clamped}</span>
      <span className="opacity-60">|</span>
      <span>{config.label}</span>
      {TrendIcon && trendConfig && (
        <TrendIcon
          className={`w-3 h-3 flex-shrink-0 ${trendConfig.color}`}
          aria-label={trendConfig.label}
        />
      )}
    </span>
  )
}

// ── Detailed Variant ─────────────────────────────────────────────────────────────
// For lead detail page: large gauge, factor breakdown, trend, timestamp

function DetailedVariant({
  score,
  factors,
  trend,
  lastUpdated,
}: {
  score: number
  factors?: LeadScoreFactor[]
  trend?: 'up' | 'down' | 'stable'
  lastUpdated?: string
}) {
  const animatedScore = useAnimatedScore(score)
  const config = getScoreConfig(score)
  const ScoreIcon = config.icon
  const TrendIcon = trend ? getTrendIcon(trend) : null
  const trendConfig = trend ? getTrendConfig(trend) : null

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (circumference * animatedScore) / 100

  // Find max absolute factor value for scaling the bars
  const maxAbsFactor = useMemo(() => {
    if (!factors || factors.length === 0) return 10
    return Math.max(...factors.map((f) => Math.abs(f.value)), 1)
  }, [factors])

  // Sort factors: highest positive impact first, then negative
  const sortedFactors = useMemo(() => {
    if (!factors) return []
    return [...factors].sort((a, b) => b.value - a.value)
  }, [factors])

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className={`bg-gradient-to-r ${config.bgGradient} px-4 py-3 flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <ScoreIcon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">
              AI Lead Score
            </h3>
            <p className="text-[11px] text-gray-500">
              Quality assessment
            </p>
          </div>
        </div>

        {/* Trend + timestamp */}
        <div className="flex items-center gap-3">
          {TrendIcon && trendConfig && (
            <div className="flex items-center gap-1">
              <TrendIcon className={`w-4 h-4 ${trendConfig.color}`} />
              <span className={`text-xs font-medium ${trendConfig.color}`}>
                {trendConfig.label}
              </span>
            </div>
          )}
          {lastUpdated && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(lastUpdated)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Large Circular Gauge */}
      <div className="px-4 pt-6 pb-4 flex flex-col items-center">
        <motion.div
          className="relative w-36 h-36"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#1f2937"
              strokeWidth="8"
            />
            {/* Animated score ring */}
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={config.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              style={{
                filter: `drop-shadow(0 0 8px ${config.glowColor})`,
              }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-4xl font-bold tabular-nums"
              style={{ color: config.color }}
            >
              {animatedScore}
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
              / 100
            </span>
          </div>
        </motion.div>

        {/* Label badge */}
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className={`
            mt-3 inline-flex items-center gap-1.5 text-xs font-semibold
            px-3 py-1 rounded-full border
            ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}
          `}
        >
          <ScoreIcon className="w-3.5 h-3.5" />
          {config.label} Lead
        </motion.span>
      </div>

      {/* Score Factor Breakdown */}
      {sortedFactors.length > 0 && (
        <div className="px-4 pb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Score Factors
          </h4>
          <div className="space-y-2.5">
            {sortedFactors.map((factor, index) => {
              const barWidthPercent =
                (Math.abs(factor.value) / maxAbsFactor) * 100
              const isPositive = factor.value > 0
              const isNeutral = factor.value === 0

              return (
                <motion.div
                  key={factor.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.6 + index * 0.08,
                    ease: 'easeOut',
                  }}
                  className="group"
                >
                  {/* Factor label row */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-300">
                        {factor.label}
                      </span>
                      {factor.description && (
                        <FactorTooltip description={factor.description} />
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        isPositive
                          ? 'text-green-400'
                          : isNeutral
                            ? 'text-gray-500'
                            : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {factor.value}
                    </span>
                  </div>

                  {/* Impact bar - centered layout for positive/negative */}
                  <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    {/* Center line marker */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600 z-10" />

                    {isNeutral ? (
                      // Neutral: small dot at center
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gray-500" />
                    ) : isPositive ? (
                      // Positive: bar extends right from center
                      <motion.div
                        className={`absolute top-0 bottom-0 left-1/2 rounded-r-full ${getFactorBarColor(factor.value)}`}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${barWidthPercent / 2}%`,
                        }}
                        transition={{
                          duration: 0.5,
                          delay: 0.7 + index * 0.08,
                          ease: 'easeOut',
                        }}
                        style={{
                          filter: `drop-shadow(0 0 3px ${isPositive ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'})`,
                        }}
                      />
                    ) : (
                      // Negative: bar extends left from center
                      <motion.div
                        className={`absolute top-0 bottom-0 rounded-l-full ${getFactorBarColor(factor.value)}`}
                        initial={{ width: 0, right: '50%' }}
                        animate={{
                          width: `${barWidthPercent / 2}%`,
                        }}
                        transition={{
                          duration: 0.5,
                          delay: 0.7 + index * 0.08,
                          ease: 'easeOut',
                        }}
                        style={{
                          right: '50%',
                          filter: `drop-shadow(0 0 3px rgba(248, 113, 113, 0.3))`,
                        }}
                      />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Impact scale legend */}
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-[10px] text-gray-600">
              -{maxAbsFactor} Negative
            </span>
            <span className="text-[10px] text-gray-600">Neutral</span>
            <span className="text-[10px] text-gray-600">
              +{maxAbsFactor} Positive
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────────

export default function LeadScoreIndicator({
  score,
  factors,
  trend,
  lastUpdated,
  variant = 'compact',
}: LeadScoreIndicatorProps) {
  const clamped = clampScore(score)

  switch (variant) {
    case 'compact':
      return <CompactVariant score={clamped} trend={trend} />

    case 'badge':
      return <BadgeVariant score={clamped} trend={trend} />

    case 'detailed':
      return (
        <DetailedVariant
          score={clamped}
          factors={factors}
          trend={trend}
          lastUpdated={lastUpdated}
        />
      )

    default:
      return <CompactVariant score={clamped} trend={trend} />
  }
}
