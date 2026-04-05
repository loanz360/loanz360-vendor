'use client'

import React from 'react'

interface Props {
  score: number
  showScore?: boolean
}

function getPriorityConfig(score: number) {
  if (score >= 80) {
    return {
      label: 'Critical',
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      dot: 'bg-red-400',
      ring: 'ring-red-500/30',
      pulse: true,
    }
  }
  if (score >= 60) {
    return {
      label: 'High',
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      dot: 'bg-orange-400',
      ring: 'ring-orange-500/30',
      pulse: false,
    }
  }
  if (score >= 40) {
    return {
      label: 'Medium',
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
      dot: 'bg-yellow-400',
      ring: 'ring-yellow-500/30',
      pulse: false,
    }
  }
  return {
    label: 'Low',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/30',
    pulse: false,
  }
}

export default function PriorityBadge({ score, showScore = false }: Props) {
  const config = getPriorityConfig(score)

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ring-1 ${config.ring}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      {config.label}
      {showScore && (
        <span className="opacity-70 ml-0.5">{Math.round(score)}</span>
      )}
    </span>
  )
}
