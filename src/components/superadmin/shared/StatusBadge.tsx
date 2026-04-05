'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import { getStatusColor, formatLabel, type StatusVariant, getColorByVariant } from '@/lib/utils/superadmin-helpers'
import { CheckCircle2, XCircle, Clock, AlertTriangle, Info, MinusCircle } from 'lucide-react'

interface StatusBadgeProps {
  status: string | null | undefined
  variant?: StatusVariant
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
  showIcon?: boolean
  label?: string
  className?: string
}

const STATUS_ICONS: Record<StatusVariant, React.ReactNode> = {
  success: <CheckCircle2 className="w-3.5 h-3.5" />,
  warning: <Clock className="w-3.5 h-3.5" />,
  error: <XCircle className="w-3.5 h-3.5" />,
  info: <Info className="w-3.5 h-3.5" />,
  neutral: <MinusCircle className="w-3.5 h-3.5" />,
  orange: <AlertTriangle className="w-3.5 h-3.5" />,
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
} as const

export function StatusBadge({
  status,
  variant,
  size = 'md',
  showDot = false,
  showIcon = false,
  label,
  className,
}: StatusBadgeProps) {
  const colors = variant ? getColorByVariant(variant) : getStatusColor(status)
  const displayLabel = label || formatLabel(status)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        colors.badge,
        SIZE_CLASSES[size],
        className
      )}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', colors.dot)} aria-hidden="true" />
      )}
      {showIcon && (
        <span aria-hidden="true">
          {STATUS_ICONS[variant || 'neutral']}
        </span>
      )}
      {displayLabel}
    </span>
  )
}

export default StatusBadge
