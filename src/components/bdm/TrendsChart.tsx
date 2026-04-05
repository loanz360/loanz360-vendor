'use client'

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DataPoint {
  date: string
  formattedDate: string
  value: number
  formattedValue: string
  leadCount?: number
  conversions?: number
}

interface TrendsChartProps {
  dataPoints: DataPoint[]
  metric: 'conversion_rate' | 'lead_count' | 'pipeline_value' | 'avg_tat'
  summary: {
    min: number
    max: number
    avg: number
    trend: 'up' | 'down' | 'neutral'
  }
  isLoading?: boolean
}

export function TrendsChart({
  dataPoints,
  metric,
  summary,
  isLoading = false,
}: TrendsChartProps) {
  const chartData = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return { points: [], minValue: 0, maxValue: 100 }

    const values = dataPoints.map(d => d.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1

    // Create SVG path points
    const chartWidth = 800
    const chartHeight = 300
    const padding = 40

    const points = dataPoints.map((point, index) => {
      const x = padding + (index / (dataPoints.length - 1)) * (chartWidth - 2 * padding)
      const normalizedValue = (point.value - minValue) / range
      const y = chartHeight - padding - normalizedValue * (chartHeight - 2 * padding)
      return { x, y, ...point }
    })

    return { points, minValue, maxValue, chartWidth, chartHeight, padding }
  }, [dataPoints])

  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />
    )
  }

  if (!dataPoints || dataPoints.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No trend data available
      </div>
    )
  }

  const { points, minValue, maxValue, chartWidth, chartHeight, padding } = chartData

  // Create SVG path
  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ')

  // Create area path (for gradient fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`

  const getMetricLabel = () => {
    const labels = {
      conversion_rate: 'Conversion Rate (%)',
      lead_count: 'Lead Count',
      pipeline_value: 'Pipeline Value (₹)',
      avg_tat: 'Avg TAT (days)',
    }
    return labels[metric]
  }

  const getMetricColor = () => {
    const colors = {
      conversion_rate: '#8B5CF6',
      lead_count: '#3B82F6',
      pipeline_value: '#10B981',
      avg_tat: '#F59E0B',
    }
    return colors[metric]
  }

  const color = getMetricColor()

  return (
    <div className="space-y-4">
      {/* Header with Summary Stats */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{getMetricLabel()}</h3>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-600">Average</p>
            <p className="text-lg font-bold" style={{ color }}>
              {metric === 'conversion_rate' ? `${summary.avg.toFixed(1)}%` :
               metric === 'pipeline_value' ? `₹${(summary.avg / 100000).toFixed(2)}L` :
               metric === 'avg_tat' ? `${summary.avg.toFixed(1)} days` :
               summary.avg.toFixed(0)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Trend</p>
            <div className="flex items-center gap-1">
              {summary.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-600" />}
              {summary.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-600" />}
              {summary.trend === 'neutral' && <Minus className="w-5 h-5 text-gray-600" />}
              <span className={`text-sm font-medium ${
                summary.trend === 'up' ? 'text-green-600' :
                summary.trend === 'down' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {summary.trend === 'up' ? 'Improving' :
                 summary.trend === 'down' ? 'Declining' :
                 'Stable'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-lg border border-gray-200 p-4">
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="overflow-visible"
        >
          {/* Grid lines */}
          <g className="grid-lines">
            {[0, 25, 50, 75, 100].map((percent) => {
              const y = chartHeight - padding - (percent / 100) * (chartHeight - 2 * padding)
              return (
                <g key={percent}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={chartWidth - padding}
                    y2={y}
                    stroke="#E5E7EB"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 10}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill="#6B7280"
                  >
                    {(minValue + (maxValue - minValue) * (percent / 100)).toFixed(1)}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Area gradient */}
          <defs>
            <linearGradient id={`gradient-${metric}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#gradient-${metric})`}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke={color}
                strokeWidth="2"
                className="cursor-pointer hover:r-7 transition-all"
              />
              {/* Tooltip on hover */}
              <g className="opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <rect
                  x={point.x - 60}
                  y={point.y - 50}
                  width="120"
                  height="40"
                  fill="rgba(0,0,0,0.8)"
                  rx="4"
                />
                <text
                  x={point.x}
                  y={point.y - 32}
                  textAnchor="middle"
                  fontSize="12"
                  fill="white"
                  fontWeight="bold"
                >
                  {point.formattedValue}
                </text>
                <text
                  x={point.x}
                  y={point.y - 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#D1D5DB"
                >
                  {point.formattedDate}
                </text>
              </g>
            </g>
          ))}

          {/* X-axis labels */}
          <g className="x-axis-labels">
            {points.map((point, index) => {
              // Show every nth label to avoid crowding
              const showLabel = points.length <= 7 || index % Math.ceil(points.length / 7) === 0
              if (!showLabel) return null

              return (
                <text
                  key={index}
                  x={point.x}
                  y={chartHeight - padding + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6B7280"
                >
                  {point.formattedDate}
                </text>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{getMetricLabel()}</span>
          </div>
        </div>
        <div className="text-gray-500">
          Min: <span className="font-medium">{minValue.toFixed(1)}</span>
          {' | '}
          Max: <span className="font-medium">{maxValue.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

// Compact sparkline variant
export function TrendsSparkline({
  dataPoints,
  color = '#3B82F6',
  height = 60,
}: {
  dataPoints: DataPoint[]
  color?: string
  height?: number
}) {
  if (!dataPoints || dataPoints.length === 0) return null

  const values = dataPoints.map(d => d.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = maxValue - minValue || 1

  const width = 200
  const padding = 5

  const points = dataPoints.map((point, index) => {
    const x = padding + (index / (dataPoints.length - 1)) * (width - 2 * padding)
    const normalizedValue = (point.value - minValue) / range
    const y = height - padding - normalizedValue * (height - 2 * padding)
    return { x, y }
  })

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="2"
          fill={color}
        />
      ))}
    </svg>
  )
}
