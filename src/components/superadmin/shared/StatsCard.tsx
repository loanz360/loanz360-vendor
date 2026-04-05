'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  iconColor?: string
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  subtitle?: string
  className?: string
  onClick?: () => void
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-orange-400',
  trend,
  subtitle,
  className,
  onClick,
}: StatsCardProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={cn(
        'bg-[#2E2E2E] rounded-xl p-5 border border-gray-800/50',
        'transition-all duration-200',
        onClick && 'hover:border-orange-500/30 hover:bg-[#333] cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/50',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-white font-poppins">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-xs font-medium',
              trend.isPositive !== false ? 'text-green-400' : 'text-red-400'
            )}>
              {trend.isPositive !== false ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              {trend.label && <span className="text-gray-500">{trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2.5 rounded-lg bg-gray-800/50 flex-shrink-0', iconColor)}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
        )}
      </div>
    </Component>
  )
}

export function StatsCardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {children}
    </div>
  )
}

export default StatsCard
