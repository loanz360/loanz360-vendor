'use client'

import React from 'react'
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from 'lucide-react'

export interface KPICardProps {
  label: string
  value: number | string
  formattedValue: string
  trend?: 'up' | 'down' | 'neutral'
  changePercentage?: number
  previousValue?: number | string
  color?: string
  icon?: React.ReactNode
  description?: string
  isLoading?: boolean
  onClick?: () => void
}

export function KPICard({
  label,
  value,
  formattedValue,
  trend = 'neutral',
  changePercentage = 0,
  previousValue,
  color = '#F97316', // Orange as default to match app theme
  icon,
  description,
  isLoading = false,
  onClick,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-2/3 mb-4"></div>
        <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-700 rounded w-1/3"></div>
      </div>
    )
  }

  const getTrendIcon = () => {
    if (trend === 'up') return <ArrowUp className="w-4 h-4" />
    if (trend === 'down') return <ArrowDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-400 bg-green-500/20'
    if (trend === 'down') return 'text-red-400 bg-red-500/20'
    return 'text-gray-400 bg-gray-500/20'
  }

  return (
    <div
      className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 p-6 transition-all duration-200 hover:border-gray-600 hover:shadow-lg ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      {/* Header with Icon */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-400 mb-1">{label}</h3>
          {description && (
            <p className="text-xs text-gray-500">{description}</p>
          )}
        </div>
        {icon && (
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-3">
        <p
          className="text-3xl font-bold text-white"
        >
          {formattedValue}
        </p>
      </div>

      {/* Trend Indicator */}
      {changePercentage !== 0 && (
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-xs font-medium">
              {Math.abs(changePercentage).toFixed(1)}%
            </span>
          </div>
          <span className="text-xs text-gray-500">vs previous period</span>
        </div>
      )}

      {/* Previous Value */}
      {previousValue && changePercentage === 0 && (
        <div className="text-xs text-gray-500">
          Previous: {typeof previousValue === 'number' ? previousValue.toLocaleString('en-IN') : previousValue}
        </div>
      )}
    </div>
  )
}

// Compact variant for smaller spaces
export function KPICardCompact({
  label,
  formattedValue,
  trend = 'neutral',
  changePercentage = 0,
  color = '#F97316',
}: Pick<KPICardProps, 'label' | 'formattedValue' | 'trend' | 'changePercentage' | 'color'>) {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3" />
    if (trend === 'down') return <TrendingDown className="w-3 h-3" />
    return null
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-400'
    if (trend === 'down') return 'text-red-400'
    return 'text-gray-400'
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-bold text-white">
          {formattedValue}
        </span>
        {changePercentage !== 0 && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-xs font-medium">
              {Math.abs(changePercentage).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// Grid container for KPI cards
export function KPICardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  )
}

// KPI Card with custom content
export function KPICardCustom({
  label,
  children,
  color = '#F97316',
  icon,
}: {
  label: string
  children: React.ReactNode
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">{label}</h3>
        {icon && (
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
