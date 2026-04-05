'use client'

import React from 'react'
import { Target, Gauge, Clock, CheckCircle, TrendingUp, Zap } from 'lucide-react'

interface Props {
  kpis: {
    daily_avg_verifications: number
    monthly_target: number
    monthly_actual: number
    team_utilization_rate: number
    efficiency_score: number
    avg_verification_time_hours: number
    first_pass_approval_rate: number
  }
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full h-2.5 rounded-full bg-gray-800/60 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const size = 72
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-800" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
        </svg>
        <span className="absolute text-sm font-bold text-white">{score}</span>
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

export default function DepartmentKPIDashboard({ kpis }: Props) {
  const targetPct = kpis.monthly_target > 0 ? ((kpis.monthly_actual / kpis.monthly_target) * 100).toFixed(1) : '0'
  const isOnTrack = kpis.monthly_actual >= kpis.monthly_target * 0.8

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-5 font-poppins text-white flex items-center gap-2">
        <Target className="w-5 h-5 text-orange-500" />
        Department KPIs
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Daily Avg */}
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Daily Avg</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.daily_avg_verifications}</p>
          <p className="text-[10px] text-gray-500">verifications/day</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Average daily verification count
          </div>
        </div>

        {/* Avg Time */}
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Avg Time</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.avg_verification_time_hours}h</p>
          <p className="text-[10px] text-gray-500">per verification</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Average hours per verification
          </div>
        </div>

        {/* First Pass Rate */}
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">First Pass</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.first_pass_approval_rate}%</p>
          <p className="text-[10px] text-gray-500">approval rate</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Approved on first verification attempt
          </div>
        </div>

        {/* Utilization */}
        <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800 group relative">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Utilization</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.team_utilization_rate}%</p>
          <p className="text-[10px] text-gray-500">team capacity</p>
          <div className="absolute -top-8 left-0 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
            Team capacity utilization rate
          </div>
        </div>
      </div>

      {/* Monthly Target Progress */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-orange-600/10 to-orange-500/5 border border-orange-500/15 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-300">Monthly Target Progress</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${isOnTrack ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {isOnTrack ? 'On Track' : 'Behind'}
          </span>
        </div>
        <ProgressBar value={kpis.monthly_actual} max={kpis.monthly_target} color={isOnTrack ? 'bg-green-500' : 'bg-orange-500'} />
        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{kpis.monthly_actual} completed</span>
          <span>{targetPct}% of {kpis.monthly_target} target</span>
        </div>
      </div>

      {/* Efficiency Score Ring */}
      <div className="flex justify-center">
        <ScoreRing score={kpis.efficiency_score} label="Efficiency Score" />
      </div>
    </div>
  )
}
