'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  HelpCircle,
  Ban,
  Loader2,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
} from 'lucide-react'

type StatusType =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'verified'
  | 'expired'
  | 'warning'
  | 'error'
  | 'success'
  | 'failed'
  | 'suspended'
  | 'terminated'
  | 'on_hold'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'not_submitted'
  | 'loading'

interface StatusConfig {
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  icon: React.ElementType
  pulse?: boolean
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  active: {
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    icon: CheckCircle2,
    pulse: true,
  },
  inactive: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    icon: XCircle,
  },
  pending: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    icon: Clock,
    pulse: true,
  },
  verified: {
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    icon: ShieldCheck,
  },
  expired: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: AlertTriangle,
  },
  warning: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  error: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: XCircle,
  },
  success: {
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    icon: CheckCircle2,
  },
  failed: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: ShieldX,
  },
  suspended: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: Ban,
  },
  terminated: {
    color: 'bg-red-600',
    bgColor: 'bg-red-600/10',
    textColor: 'text-red-500',
    borderColor: 'border-red-600/30',
    icon: XCircle,
  },
  on_hold: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    icon: Clock,
  },
  draft: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    icon: HelpCircle,
  },
  submitted: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    icon: CheckCircle2,
  },
  under_review: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    icon: ShieldAlert,
    pulse: true,
  },
  approved: {
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-400',
    borderColor: 'border-green-500/30',
    icon: CheckCircle2,
  },
  rejected: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    icon: XCircle,
  },
  not_submitted: {
    color: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    icon: HelpCircle,
  },
  loading: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    icon: Loader2,
    pulse: true,
  },
}

interface StatusIndicatorProps {
  status: StatusType
  label?: string
  showIcon?: boolean
  showDot?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  variant?: 'default' | 'badge' | 'pill' | 'minimal'
}

export default function StatusIndicator({
  status,
  label,
  showIcon = true,
  showDot = true,
  size = 'md',
  className,
  variant = 'default',
}: StatusIndicatorProps) {
  const config = statusConfigs[status] || statusConfigs.inactive

  const StatusIcon = config.icon

  const sizeClasses = {
    sm: {
      dot: 'w-1.5 h-1.5',
      icon: 'w-3 h-3',
      text: 'text-xs',
      padding: 'px-2 py-0.5',
      gap: 'gap-1',
    },
    md: {
      dot: 'w-2 h-2',
      icon: 'w-4 h-4',
      text: 'text-sm',
      padding: 'px-2.5 py-1',
      gap: 'gap-1.5',
    },
    lg: {
      dot: 'w-2.5 h-2.5',
      icon: 'w-5 h-5',
      text: 'text-base',
      padding: 'px-3 py-1.5',
      gap: 'gap-2',
    },
  }

  const sizes = sizeClasses[size]

  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center', sizes.gap, className)}>
        {showDot && (
          <div
            className={cn(
              'rounded-full',
              config.color,
              sizes.dot,
              config.pulse && 'animate-pulse'
            )}
          />
        )}
        {showIcon && !showDot && (
          <StatusIcon
            className={cn(
              config.textColor,
              sizes.icon,
              status === 'loading' && 'animate-spin'
            )}
          />
        )}
        {label && (
          <span className={cn('font-medium', config.textColor, sizes.text)}>
            {label}
          </span>
        )}
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md border',
          config.bgColor,
          config.borderColor,
          sizes.padding,
          sizes.gap,
          className
        )}
      >
        {showDot && (
          <span
            className={cn(
              'rounded-full',
              config.color,
              sizes.dot,
              config.pulse && 'animate-pulse'
            )}
          />
        )}
        {showIcon && !showDot && (
          <StatusIcon
            className={cn(
              config.textColor,
              sizes.icon,
              status === 'loading' && 'animate-spin'
            )}
          />
        )}
        {label && (
          <span className={cn('font-medium', config.textColor, sizes.text)}>
            {label}
          </span>
        )}
      </span>
    )
  }

  if (variant === 'pill') {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border',
          config.bgColor,
          config.borderColor,
          sizes.padding,
          sizes.gap,
          className
        )}
      >
        {showDot && (
          <span
            className={cn(
              'rounded-full',
              config.color,
              sizes.dot,
              config.pulse && 'animate-pulse'
            )}
          />
        )}
        {showIcon && !showDot && (
          <StatusIcon
            className={cn(
              config.textColor,
              sizes.icon,
              status === 'loading' && 'animate-spin'
            )}
          />
        )}
        {label && (
          <span className={cn('font-medium', config.textColor, sizes.text)}>
            {label}
          </span>
        )}
      </span>
    )
  }

  // Default variant
  return (
    <div className={cn('flex items-center', sizes.gap, className)}>
      {showDot && (
        <div
          className={cn(
            'rounded-full',
            config.color,
            sizes.dot,
            config.pulse && 'animate-pulse'
          )}
        />
      )}
      {showIcon && (
        <StatusIcon
          className={cn(
            config.textColor,
            sizes.icon,
            status === 'loading' && 'animate-spin'
          )}
        />
      )}
      {label && (
        <span className={cn('font-medium', config.textColor, sizes.text)}>
          {label}
        </span>
      )}
    </div>
  )
}

// Verification Status specifically for documents/KYC
interface VerificationStatusProps {
  status: 'not_submitted' | 'pending' | 'verified' | 'failed' | 'expired' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function VerificationStatus({
  status,
  size = 'md',
  showLabel = true,
  className,
}: VerificationStatusProps) {
  const labels: Record<string, string> = {
    not_submitted: 'Not Submitted',
    pending: 'Pending Verification',
    verified: 'Verified',
    failed: 'Verification Failed',
    expired: 'Expired',
    rejected: 'Rejected',
  }

  return (
    <StatusIndicator
      status={status}
      label={showLabel ? labels[status] : undefined}
      size={size}
      variant="badge"
      showIcon={true}
      showDot={false}
      className={className}
    />
  )
}

// Account Status for partner profiles
interface AccountStatusProps {
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_hold' | 'pending'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function AccountStatus({
  status,
  size = 'md',
  showLabel = true,
  className,
}: AccountStatusProps) {
  const labels: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    terminated: 'Terminated',
    on_hold: 'On Hold',
    pending: 'Pending',
  }

  return (
    <StatusIndicator
      status={status}
      label={showLabel ? labels[status] : undefined}
      size={size}
      variant="pill"
      showIcon={true}
      showDot={true}
      className={className}
    />
  )
}

// Onboarding Status
interface OnboardingStatusProps {
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export function OnboardingStatus({
  status,
  size = 'md',
  showLabel = true,
  className,
}: OnboardingStatusProps) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return (
    <StatusIndicator
      status={status}
      label={showLabel ? labels[status] : undefined}
      size={size}
      variant="badge"
      showIcon={true}
      showDot={false}
      className={className}
    />
  )
}

// Progress indicator for profile completion
interface ProfileCompletionProps {
  percentage: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileCompletion({
  percentage,
  showLabel = true,
  size = 'md',
  className,
}: ProfileCompletionProps) {
  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTextColor = () => {
    if (percentage >= 80) return 'text-green-400'
    if (percentage >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const sizeClasses = {
    sm: { height: 'h-1.5', text: 'text-xs' },
    md: { height: 'h-2', text: 'text-sm' },
    lg: { height: 'h-3', text: 'text-base' },
  }

  const sizes = sizeClasses[size]

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Profile Completion</span>
          <span className={cn('font-medium', getTextColor(), sizes.text)}>
            {percentage}%
          </span>
        </div>
      )}
      <div className={cn('w-full bg-gray-700 rounded-full overflow-hidden', sizes.height)}>
        <div
          className={cn('rounded-full transition-all duration-500', getColor(), sizes.height)}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  )
}
