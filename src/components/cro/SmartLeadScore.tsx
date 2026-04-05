'use client'

import React, { useEffect, useState } from 'react'
import {
  Zap, Phone, DollarSign, FileCheck, Clock, Brain,
  MessageSquare, ArrowRight, TrendingUp, RefreshCw
} from 'lucide-react'

interface SmartLeadScoreProps {
  score: number
  breakdown?: {
    engagement: number
    financialFit: number
    documentReadiness: number
    urgency: number
    aiSentiment: number
  }
  lastUpdated?: string
  compact?: boolean
}

function getScoreConfig(score: number) {
  if (score > 80) {
    return {
      label: 'Very Hot',
      color: '#22c55e',
      ringClass: 'text-green-400',
      bgClass: 'from-green-500/20 to-green-600/5',
      badgeClass: 'bg-green-500/20 text-green-400 border-green-500/30',
    }
  }
  if (score > 60) {
    return {
      label: 'Hot',
      color: '#4ade80',
      ringClass: 'text-green-500',
      bgClass: 'from-green-500/15 to-emerald-600/5',
      badgeClass: 'bg-green-500/15 text-green-500 border-green-500/25',
    }
  }
  if (score > 30) {
    return {
      label: 'Warm',
      color: '#facc15',
      ringClass: 'text-yellow-400',
      bgClass: 'from-yellow-500/20 to-yellow-600/5',
      badgeClass: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    }
  }
  return {
    label: 'Cold',
    color: '#ef4444',
    ringClass: 'text-red-400',
    bgClass: 'from-red-500/20 to-red-600/5',
    badgeClass: 'bg-red-500/20 text-red-400 border-red-500/30',
  }
}

function getNextBestAction(score: number) {
  if (score > 80) {
    return {
      text: 'Convert to deal - Ready!',
      icon: Zap,
      actionClass: 'bg-green-500/15 text-green-400 border-green-500/25',
    }
  }
  if (score > 60) {
    return {
      text: 'Request documents',
      icon: FileCheck,
      actionClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    }
  }
  if (score > 30) {
    return {
      text: 'Schedule a follow-up call',
      icon: Phone,
      actionClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    }
  }
  return {
    text: 'Send introduction message',
    icon: MessageSquare,
    actionClass: 'bg-red-500/15 text-red-400 border-red-500/25',
  }
}

const BREAKDOWN_FACTORS = [
  { key: 'engagement' as const, label: 'Engagement', sublabel: 'Call freq & response rate', icon: Phone },
  { key: 'financialFit' as const, label: 'Financial Fit', sublabel: 'Income vs loan amount', icon: DollarSign },
  { key: 'documentReadiness' as const, label: 'Doc Readiness', sublabel: 'Documents collected', icon: FileCheck },
  { key: 'urgency' as const, label: 'Urgency', sublabel: 'Time sensitivity', icon: Clock },
  { key: 'aiSentiment' as const, label: 'AI Sentiment', sublabel: 'Call sentiment analysis', icon: Brain },
]

function getFactorBarColor(value: number): string {
  if (value > 80) return 'bg-green-400'
  if (value > 60) return 'bg-green-500'
  if (value > 30) return 'bg-yellow-400'
  return 'bg-red-400'
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

export default function SmartLeadScore({
  score,
  breakdown,
  lastUpdated,
  compact = false,
}: SmartLeadScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const config = getScoreConfig(score)
  const action = getNextBestAction(score)
  const ActionIcon = action.icon

  // Animate score on mount
  useEffect(() => {
    const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
    let current = 0
    const step = clampedScore / 40 // 40 frames
    const interval = setInterval(() => {
      current += step
      if (current >= clampedScore) {
        current = clampedScore
        clearInterval(interval)
      }
      setAnimatedScore(Math.round(current))
    }, 16)
    return () => clearInterval(interval)
  }, [score])

  const circumference = 2 * Math.PI * 54 // radius 54
  const strokeDashoffset = circumference - (circumference * animatedScore) / 100

  // --- Compact mode for list views ---
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {/* Mini score ring */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15"
              fill="none"
              stroke="#374151"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15"
              fill="none"
              stroke={config.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(animatedScore / 100) * 94.25} 94.25`}
              style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
            style={{ color: config.color }}
          >
            {animatedScore}
          </span>
        </div>
        <div className="min-w-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.badgeClass}`}>
            {config.label}
          </span>
        </div>
      </div>
    )
  }

  // --- Full mode ---
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.bgClass} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FF6700]" />
          <h3 className="text-sm font-semibold text-white">AI Lead Score</h3>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <RefreshCw className="w-3 h-3" />
            {formatTimeAgo(lastUpdated)}
          </div>
        )}
      </div>

      {/* Score Gauge */}
      <div className="px-4 pt-5 pb-4 flex flex-col items-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke="#1f2937"
              strokeWidth="8"
            />
            {/* Score ring */}
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke={config.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.8s ease-out',
                filter: `drop-shadow(0 0 6px ${config.color}40)`,
              }}
            />
          </svg>
          {/* Center score */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: config.color }}
            >
              {animatedScore}
            </span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">/ 100</span>
          </div>
        </div>

        {/* Label badge */}
        <span className={`mt-3 text-xs font-medium px-3 py-1 rounded-full border ${config.badgeClass}`}>
          {config.label} Lead
        </span>
      </div>

      {/* Score Breakdown */}
      {breakdown && (
        <div className="px-4 pb-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Score Breakdown
          </h4>
          <div className="space-y-3">
            {BREAKDOWN_FACTORS.map(factor => {
              const value = breakdown[factor.key]
              const FactorIcon = factor.icon

              return (
                <div key={factor.key} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                    <FactorIcon className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-300">{factor.label}</span>
                      <span className="text-xs text-gray-500 tabular-nums">{value}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getFactorBarColor(value)}`}
                        style={{
                          width: `${value}%`,
                          transition: 'width 0.6s ease-out',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-600 mt-0.5 block">{factor.sublabel}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Next Best Action */}
      <div className="border-t border-white/10 px-4 py-3">
        <h4 className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
          Next Best Action
        </h4>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${action.actionClass}`}>
          <ActionIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium flex-1">{action.text}</span>
          <ArrowRight className="w-4 h-4 flex-shrink-0 opacity-60" />
        </div>
      </div>
    </div>
  )
}
