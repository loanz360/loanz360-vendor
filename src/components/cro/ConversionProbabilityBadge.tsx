'use client'

import React from 'react'
import { TrendingUp } from 'lucide-react'

interface ConversionProbabilityBadgeProps {
  probability: number // 0-100
  size?: 'sm' | 'md'
}

function getProbabilityConfig(probability: number) {
  if (probability > 80) {
    return {
      gradient: 'from-green-500 to-emerald-600',
      glow: 'shadow-green-500/25',
      textColor: 'text-white',
    }
  }
  if (probability > 60) {
    return {
      gradient: 'from-emerald-500 to-green-600',
      glow: 'shadow-emerald-500/20',
      textColor: 'text-white',
    }
  }
  if (probability > 40) {
    return {
      gradient: 'from-yellow-500 to-orange-500',
      glow: 'shadow-yellow-500/20',
      textColor: 'text-white',
    }
  }
  if (probability > 20) {
    return {
      gradient: 'from-orange-500 to-red-500',
      glow: 'shadow-orange-500/20',
      textColor: 'text-white',
    }
  }
  return {
    gradient: 'from-red-500 to-red-600',
    glow: 'shadow-red-500/20',
    textColor: 'text-white',
  }
}

export default function ConversionProbabilityBadge({
  probability,
  size = 'md',
}: ConversionProbabilityBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(probability)))
  const config = getProbabilityConfig(clamped)

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5'

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        bg-gradient-to-r ${config.gradient} ${config.textColor}
        shadow-md ${config.glow}
        ${sizeClasses}
      `}
    >
      <TrendingUp className={`${iconSize} flex-shrink-0`} />
      <span className="tabular-nums">{clamped}% likely</span>
    </span>
  )
}
