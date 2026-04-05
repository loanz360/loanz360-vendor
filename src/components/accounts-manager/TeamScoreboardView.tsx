'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpDown, Users, Zap, Target, BarChart3, Activity } from 'lucide-react'
import AEScorecard from './AEScorecard'

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

interface TeamAverage {
  volume: number
  speed_hours: number
  accuracy: number
  consistency: number
  overall_score: number
}

interface Props {
  scorecards: ScorecardData[]
  teamAverage: TeamAverage | null
  month: string
  isLoading?: boolean
  onMonthChange?: (month: number, year: number) => void
}

type SortKey = 'overall' | 'volume' | 'speed' | 'accuracy'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function TeamScoreboardView({ scorecards, teamAverage, month, isLoading, onMonthChange }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('overall')

  const [year, monthNum] = month.split('-').map(Number)

  const handlePrevMonth = () => {
    const prev = monthNum === 1 ? { m: 12, y: year - 1 } : { m: monthNum - 1, y: year }
    onMonthChange?.(prev.m, prev.y)
  }

  const handleNextMonth = () => {
    const next = monthNum === 12 ? { m: 1, y: year + 1 } : { m: monthNum + 1, y: year }
    onMonthChange?.(next.m, next.y)
  }

  const sortedCards = useMemo(() => {
    const cards = [...scorecards]
    switch (sortBy) {
      case 'volume':
        cards.sort((a, b) => b.volume.value - a.volume.value)
        break
      case 'speed':
        cards.sort((a, b) => a.speed.avg_hours - b.speed.avg_hours) // lower is better
        break
      case 'accuracy':
        cards.sort((a, b) => b.accuracy.rate - a.accuracy.rate)
        break
      case 'overall':
      default:
        cards.sort((a, b) => b.overall_score - a.overall_score)
        break
    }
    return cards
  }, [scorecards, sortBy])

  const topRank = scorecards.length > 0 ? Math.min(...scorecards.map(s => s.rank)) : 0
  const bottomRank = scorecards.length > 0 ? Math.max(...scorecards.map(s => s.rank)) : 0

  const sortOptions: { key: SortKey; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overall', label: 'Overall', icon: Activity },
    { key: 'volume', label: 'Volume', icon: BarChart3 },
    { key: 'speed', label: 'Speed', icon: Zap },
    { key: 'accuracy', label: 'Accuracy', icon: Target },
  ]

  return (
    <div className="space-y-5">
      {/* Month Selector & Sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold font-poppins text-white min-w-[180px] text-center">
            {MONTH_NAMES[monthNum - 1]} {year}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 ml-1.5" />
          {sortOptions.map(opt => {
            const Icon = opt.icon
            return (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  sortBy === opt.key
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-3 h-3" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Team Average Stats Bar */}
      {teamAverage && (
        <div className="frosted-card p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold font-poppins text-white">Team Benchmarks</h3>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded ml-auto">
              {scorecards.length} members
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Avg Volume', value: teamAverage.volume, suffix: '', color: 'text-blue-400' },
              { label: 'Avg Speed', value: `${teamAverage.speed_hours}h`, suffix: '', color: 'text-purple-400' },
              { label: 'Avg Accuracy', value: `${teamAverage.accuracy}%`, suffix: '', color: 'text-emerald-400' },
              { label: 'Avg Consistency', value: teamAverage.consistency, suffix: '/100', color: 'text-amber-400' },
              { label: 'Team Score', value: teamAverage.overall_score, suffix: '/100', color: 'text-orange-400' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider">{stat.label}</p>
                <p className={`text-lg font-bold font-poppins ${stat.color}`}>
                  {stat.value}<span className="text-xs text-gray-600">{stat.suffix}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="frosted-card p-5 rounded-lg animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-700" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-700 rounded w-32 mb-1" />
                  <div className="h-3 bg-gray-800 rounded w-20" />
                </div>
              </div>
              <div className="h-16 bg-gray-800 rounded mb-3" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-20 bg-gray-800 rounded" />
                <div className="h-20 bg-gray-800 rounded" />
                <div className="h-20 bg-gray-800 rounded" />
                <div className="h-20 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scorecards Grid */}
      {!isLoading && sortedCards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedCards.map(card => (
            <AEScorecard
              key={card.member_id}
              scorecard={card}
              isTopPerformer={card.rank === topRank && scorecards.length > 1}
              needsAttention={card.rank === bottomRank && scorecards.length > 1}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sortedCards.length === 0 && (
        <div className="frosted-card p-12 rounded-lg text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-white font-semibold font-poppins mb-1">No Scorecards Available</h3>
          <p className="text-gray-500 text-sm">
            No accounts executive data found for {MONTH_NAMES[monthNum - 1]} {year}.
          </p>
        </div>
      )}
    </div>
  )
}
