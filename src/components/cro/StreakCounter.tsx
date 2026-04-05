'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Flame,
  Trophy,
  Target,
  Zap,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────────

interface StreakCounterProps {
  currentStreak: number // consecutive active days
  longestStreak: number
  todayComplete: boolean // has met daily target
  weeklyGoal: number
  weeklyProgress: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getStreakTier(streak: number) {
  if (streak >= 30) {
    return {
      label: 'Legendary',
      color: '#FF6700',
      glowColor: 'rgba(255, 103, 0, 0.3)',
      ringColor: 'text-orange-500',
      badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      flameCount: 3,
    }
  }
  if (streak >= 14) {
    return {
      label: 'On Fire',
      color: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.25)',
      ringColor: 'text-orange-400',
      badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
      flameCount: 2,
    }
  }
  if (streak >= 7) {
    return {
      label: 'Hot Streak',
      color: '#facc15',
      glowColor: 'rgba(250, 204, 21, 0.2)',
      ringColor: 'text-yellow-400',
      badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
      flameCount: 2,
    }
  }
  if (streak >= 3) {
    return {
      label: 'Warming Up',
      color: '#4ade80',
      glowColor: 'rgba(74, 222, 128, 0.15)',
      ringColor: 'text-green-400',
      badgeClass: 'bg-green-500/15 text-green-400 border-green-500/25',
      flameCount: 1,
    }
  }
  return {
    label: 'Getting Started',
    color: '#6b7280',
    glowColor: 'rgba(107, 114, 128, 0.1)',
    ringColor: 'text-gray-400',
    badgeClass: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    flameCount: 0,
  }
}

function getMotivationalText(streak: number, todayComplete: boolean): string {
  if (!todayComplete) return 'Complete your daily target to keep the streak alive!'
  if (streak >= 30) return 'Unstoppable! You are a legend.'
  if (streak >= 14) return 'Incredible consistency. Keep it going!'
  if (streak >= 7) return 'One full week and counting. Amazing!'
  if (streak >= 3) return 'Building momentum. Great work!'
  if (streak >= 1) return 'Off to a great start!'
  return 'Start your streak today!'
}

// ── Progress Ring (SVG) ──────────────────────────────────────────────────────────

function ProgressRing({
  value,
  max,
  color,
  size = 120,
  strokeWidth = 8,
  children,
}: {
  value: number
  max: number
  color: string
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    const target = Math.min(value, max)
    let current = 0
    const step = target / 30
    const interval = setInterval(() => {
      current += step
      if (current >= target) {
        current = target
        clearInterval(interval)
      }
      setAnimatedValue(current)
    }, 20)
    return () => clearInterval(interval)
  }, [value, max])

  const progress = max > 0 ? Math.min(animatedValue / max, 1) : 0
  const dashOffset = circumference - circumference * progress

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out',
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ── Flame Animation ──────────────────────────────────────────────────────────────

function AnimatedFlames({ count, color }: { count: number; color: string }) {
  if (count === 0) return null

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, i % 2 === 0 ? 5 : -5, 0],
          }}
          transition={{
            duration: 0.8 + i * 0.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.15,
          }}
        >
          <Flame
            className="w-5 h-5"
            style={{ color, filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </motion.div>
      ))}
    </div>
  )
}

// ── Celebration Particles ────────────────────────────────────────────────────────

function CelebrationEffect() {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        angle: (360 / 12) * i,
        delay: Math.random() * 0.3,
        size: 4 + Math.random() * 4,
        color: ['#FF6700', '#facc15', '#4ade80', '#f97316', '#22c55e'][i % 5],
      })),
    []
  )

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180
        const distance = 50 + Math.random() * 20
        const endX = Math.cos(rad) * distance
        const endY = Math.sin(rad) * distance

        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: '50%',
              top: '50%',
            }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: endX,
              y: endY,
              scale: [0, 1.5, 0],
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              delay: p.delay,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────────

export default function StreakCounter({
  currentStreak,
  longestStreak,
  todayComplete,
  weeklyGoal,
  weeklyProgress,
}: StreakCounterProps) {
  const tier = getStreakTier(currentStreak)
  const motivationalText = getMotivationalText(currentStreak, todayComplete)
  const weeklyPercent =
    weeklyGoal > 0 ? Math.round((weeklyProgress / weeklyGoal) * 100) : 0
  const goalMet = weeklyProgress >= weeklyGoal

  const [showCelebration, setShowCelebration] = useState(false)

  // Trigger celebration when goal is first met
  useEffect(() => {
    if (goalMet) {
      setShowCelebration(true)
      const timeout = setTimeout(() => setShowCelebration(false), 1500)
      return () => clearTimeout(timeout)
    }
  }, [goalMet])

  return (
    <div className="bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0A0A0A] border border-gray-800/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">
              Activity Streak
            </h3>
            <p className="text-[11px] text-gray-500">Stay consistent</p>
          </div>
        </div>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${tier.badgeClass}`}
        >
          {tier.label}
        </span>
      </div>

      {/* Streak Ring + Flames */}
      <div className="px-4 pt-5 pb-4 flex flex-col items-center relative">
        {/* Celebration particles */}
        <AnimatePresence>
          {showCelebration && <CelebrationEffect />}
        </AnimatePresence>

        <ProgressRing
          value={currentStreak}
          max={Math.max(currentStreak, longestStreak, 30)}
          color={tier.color}
          size={120}
          strokeWidth={8}
        >
          <AnimatedFlames count={tier.flameCount} color={tier.color} />
          <span
            className="text-3xl font-bold tabular-nums mt-0.5"
            style={{ color: tier.color }}
          >
            {currentStreak}
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            day{currentStreak !== 1 ? 's' : ''}
          </span>
        </ProgressRing>

        {/* Motivational text */}
        <p className="text-xs text-gray-400 mt-3 text-center max-w-[220px] leading-relaxed">
          {motivationalText}
        </p>

        {/* Today status */}
        <div className="mt-3">
          {todayComplete ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/25"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-medium text-green-400">
                Daily target met
              </span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-medium text-yellow-400">
                Keep going today
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Current streak stat */}
          <div className="bg-black/40 border border-gray-800/30 rounded-lg px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                Current
              </span>
            </div>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: tier.color }}
            >
              {currentStreak}
            </span>
            <span className="text-[10px] text-gray-600 ml-0.5">days</span>
          </div>

          {/* Longest streak stat */}
          <div className="bg-black/40 border border-gray-800/30 rounded-lg px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                Record
              </span>
            </div>
            <span className="text-lg font-bold text-gray-100 tabular-nums">
              {longestStreak}
            </span>
            <span className="text-[10px] text-gray-600 ml-0.5">days</span>
          </div>
        </div>
      </div>

      {/* Weekly Goal Progress */}
      <div className="border-t border-gray-800/50 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-300">
              Weekly Goal
            </span>
          </div>
          <span className="text-xs text-gray-500 tabular-nums">
            {weeklyProgress}/{weeklyGoal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: goalMet ? '#22c55e' : '#FF6700',
              boxShadow: goalMet
                ? '0 0 8px rgba(34, 197, 94, 0.4)'
                : '0 0 8px rgba(255, 103, 0, 0.3)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(weeklyPercent, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Percentage label */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-gray-600">
            {weeklyPercent}% complete
          </span>
          {goalMet && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-medium text-green-400">
                Goal reached!
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
