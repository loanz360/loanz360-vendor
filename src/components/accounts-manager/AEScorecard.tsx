'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle, Zap, Target, BarChart3, Activity } from 'lucide-react'

interface ScorecardData {
  member_id: string
  name: string
  email: string
  rank: number
  total_members: number
  volume: { value: number; max: number; score: number; trend: number }
  speed: { avg_hours: number; score: number; trend: number }
  accuracy: { rate: number; score: number; trend: number }
  consistency: { score: number; trend: number }
  overall_score: number
  overall_trend: number
  daily_counts: number[]
}

interface Props {
  scorecard: ScorecardData
  isTopPerformer?: boolean
  needsAttention?: boolean
}

function CircularProgress({ score, size = 48, strokeWidth = 4 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#374151"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}

function TrendArrow({ value, invert }: { value: number; invert?: boolean }) {
  const isPositive = invert ? value < 0 : value > 0
  const isNeutral = value === 0

  if (isNeutral) {
    return (
      <span className="flex items-center gap-0.5 text-gray-500 text-xs">
        <Minus className="w-3 h-3" />
        <span>0</span>
      </span>
    )
  }

  return (
    <span className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      <span>{value > 0 ? '+' : ''}{value}</span>
    </span>
  )
}

function MiniBarChart({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts)
  // Show up to 31 days
  const displayCounts = counts.slice(0, 31)

  return (
    <div className="flex items-end gap-px h-10 mt-2">
      {displayCounts.map((count, i) => (
        <div
          key={i}
          className="flex-1 min-w-[3px] rounded-t-sm transition-all duration-300"
          style={{
            height: `${Math.max(2, (count / max) * 100)}%`,
            backgroundColor: count === 0 ? '#1f2937' : '#f97316',
            opacity: count === 0 ? 0.3 : 0.5 + (count / max) * 0.5,
          }}
          title={`Day ${i + 1}: ${count} verifications`}
        />
      ))}
    </div>
  )
}

export default function AEScorecard({ scorecard, isTopPerformer, needsAttention }: Props) {
  const { name, rank, total_members, volume, speed, accuracy, consistency, overall_score, overall_trend, daily_counts } = scorecard

  const overallColor = overall_score >= 80 ? 'text-green-400' : overall_score >= 60 ? 'text-yellow-400' : 'text-red-400'
  const overallBg = overall_score >= 80 ? 'bg-green-500/10 border-green-500/20' : overall_score >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'

  const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'

  const metrics = [
    {
      label: 'Volume',
      icon: BarChart3,
      value: volume.value,
      subtitle: `of ${volume.max} max`,
      score: volume.score,
      trend: volume.trend,
      color: 'text-blue-400',
    },
    {
      label: 'Speed',
      icon: Zap,
      value: `${speed.avg_hours}h`,
      subtitle: 'avg time',
      score: speed.score,
      trend: speed.trend,
      invert: true,
      color: 'text-purple-400',
    },
    {
      label: 'Accuracy',
      icon: Target,
      value: `${accuracy.rate}%`,
      subtitle: 'no rejections',
      score: accuracy.score,
      trend: accuracy.trend,
      color: 'text-emerald-400',
    },
    {
      label: 'Consistency',
      icon: Activity,
      value: `${consistency.score}`,
      subtitle: 'score',
      score: consistency.score,
      trend: consistency.trend,
      color: 'text-amber-400',
    },
  ]

  return (
    <div className={`frosted-card p-5 rounded-lg relative transition-all duration-200 hover:ring-1 hover:ring-orange-500/30 ${isTopPerformer ? 'ring-1 ring-orange-500/40' : ''} ${needsAttention ? 'ring-1 ring-red-500/30' : ''}`}>
      {/* Badges */}
      {isTopPerformer && (
        <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
          <Trophy className="w-3 h-3" />
          Top Performer
        </div>
      )}
      {needsAttention && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
          <AlertTriangle className="w-3 h-3" />
          Needs Attention
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold font-poppins text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-semibold font-poppins text-sm">{name}</h3>
            <p className="text-gray-500 text-xs">Accounts Executive</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-gray-800 text-gray-300 text-xs font-bold px-2 py-1 rounded">
            #{rank}<sup className="text-[8px]">{rankSuffix}</sup>
            <span className="text-gray-500 font-normal"> / {total_members}</span>
          </div>
        </div>
      </div>

      {/* Overall Score */}
      <div className={`flex items-center justify-between p-3 rounded-lg border mb-4 ${overallBg}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <CircularProgress score={overall_score} size={52} strokeWidth={5} />
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${overallColor}`}>
              {overall_score}
            </span>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Overall Score</p>
            <p className={`text-lg font-bold font-poppins ${overallColor}`}>{overall_score}/100</p>
          </div>
        </div>
        <TrendArrow value={overall_trend} />
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="bg-gray-800/50 rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <Icon className={`w-3 h-3 ${metric.color}`} />
                  <span className="text-gray-400 text-[10px] font-medium uppercase">{metric.label}</span>
                </div>
                <TrendArrow value={metric.trend} invert={metric.invert} />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <CircularProgress score={metric.score} size={32} strokeWidth={3} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-300">
                    {metric.score}
                  </span>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{metric.value}</p>
                  <p className="text-gray-500 text-[9px]">{metric.subtitle}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Daily Verification Bar Chart */}
      <div className="bg-gray-800/30 rounded-lg px-3 py-2">
        <p className="text-gray-500 text-[10px] uppercase tracking-wider">Daily Verifications</p>
        <MiniBarChart counts={daily_counts} />
      </div>
    </div>
  )
}
