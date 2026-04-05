'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricComparison {
  label: string
  current: number
  previous: number
  format?: 'number' | 'currency' | 'percentage' | 'duration'
}

interface PerformanceComparisonCardProps {
  title: string
  subtitle?: string
  metrics: MetricComparison[]
}

function formatValue(value: number, format?: string): string {
  switch (format) {
    case 'currency':
      return `₹${value.toLocaleString('en-IN')}`
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'duration':
      return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
    default:
      return value.toLocaleString('en-IN')
  }
}

function getChangePercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export default function PerformanceComparisonCard({ title, subtitle, metrics }: PerformanceComparisonCardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const change = getChangePercent(metric.current, metric.previous)
          const isPositive = change > 0
          const isNeutral = change === 0

          return (
            <div key={metric.label} className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-400">{metric.label}</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {formatValue(metric.current, metric.format)}
                </p>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isNeutral ? (
                    <Minus className="h-3 w-3" />
                  ) : isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(change).toFixed(1)}%
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  vs {formatValue(metric.previous, metric.format)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
