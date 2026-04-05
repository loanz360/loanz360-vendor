'use client'

interface IntegrationHealthBadgeProps {
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastChecked?: string // ISO date string
  responseTime?: number // ms
  showTooltip?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig = {
  healthy: {
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-300 dark:border-green-500/40',
    bg: 'bg-green-50 dark:bg-green-500/10',
    label: 'Healthy',
    pulse: true,
  },
  degraded: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-300 dark:border-yellow-500/40',
    bg: 'bg-yellow-50 dark:bg-yellow-500/10',
    label: 'Degraded',
    pulse: false,
  },
  down: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-300 dark:border-red-500/40',
    bg: 'bg-red-50 dark:bg-red-500/10',
    label: 'Down',
    pulse: false,
  },
  unknown: {
    dot: 'bg-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-300 dark:border-gray-500/40',
    bg: 'bg-gray-50 dark:bg-gray-500/10',
    label: 'Unknown',
    pulse: false,
  },
}

const sizeConfig = {
  sm: { dot: 'h-1.5 w-1.5', text: 'text-xs', padding: 'px-1.5 py-0.5', gap: 'gap-1' },
  md: { dot: 'h-2 w-2', text: 'text-sm', padding: 'px-2 py-1', gap: 'gap-1.5' },
  lg: { dot: 'h-2.5 w-2.5', text: 'text-base', padding: 'px-3 py-1.5', gap: 'gap-2' },
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then

  if (Number.isNaN(diffMs)) return 'Invalid date'
  if (diffMs < 0) return 'Just now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return seconds <= 5 ? 'Just now' : `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function IntegrationHealthBadge({
  status,
  lastChecked,
  responseTime,
  showTooltip = false,
  size = 'md',
  className = '',
}: IntegrationHealthBadgeProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]

  const hasTooltipContent = showTooltip && (lastChecked || responseTime !== undefined)

  return (
    <span
      className={`group relative inline-flex items-center ${sizes.gap} ${sizes.padding} ${config.bg} ${config.border} border rounded-full ${sizes.text} font-medium ${config.text} ${className}`}
      role="status"
      aria-label={`Integration status: ${config.label}${lastChecked ? `, last checked ${formatRelativeTime(lastChecked)}` : ''}${responseTime !== undefined ? `, response time ${responseTime}ms` : ''}`}
    >
      {/* Status dot */}
      <span className="relative inline-flex">
        {config.pulse && (
          <span
            className={`absolute inset-0 rounded-full ${config.dot} opacity-40 animate-ping`}
            aria-hidden="true"
          />
        )}
        <span
          className={`relative inline-block rounded-full ${sizes.dot} ${config.dot}`}
          aria-hidden="true"
        />
      </span>

      {/* Label */}
      {config.label}

      {/* CSS-only tooltip via group-hover */}
      {hasTooltipContent && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50"
          aria-hidden="true"
        >
          <span className="whitespace-nowrap rounded-md bg-gray-900 dark:bg-gray-800 px-2.5 py-1.5 text-xs text-white shadow-lg">
            {lastChecked && (
              <span className="block">
                Checked: {formatRelativeTime(lastChecked)}
              </span>
            )}
            {responseTime !== undefined && (
              <span className="block">
                Response: {responseTime}ms
              </span>
            )}
          </span>
          {/* Tooltip arrow */}
          <span className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-gray-900 dark:border-t-gray-800" />
        </span>
      )}
    </span>
  )
}

export default IntegrationHealthBadge
