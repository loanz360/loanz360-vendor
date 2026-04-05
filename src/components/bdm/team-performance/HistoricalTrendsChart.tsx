'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonthlyData, BDETrend } from '@/types/bdm-team-performance'
import { TrendingUp, TrendingDown, Activity, DollarSign, Target } from 'lucide-react'
import { useState } from 'react'

interface HistoricalTrendsChartProps {
  teamTrends: MonthlyData[]
  bdeTrends: BDETrend[]
}

type MetricType = 'conversions' | 'revenue' | 'conversionRate'

export default function HistoricalTrendsChart({ teamTrends, bdeTrends }: HistoricalTrendsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('conversions')
  const [showBDEs, setShowBDEs] = useState(false)

  if (!teamTrends || teamTrends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Historical Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No historical data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Reverse data so oldest is on left
  const reversedTrends = [...teamTrends].reverse()

  // Calculate chart dimensions and scaling
  const chartHeight = 300
  const chartPadding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = 800
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom

  // Get values based on selected metric
  const getMetricValue = (data: MonthlyData): number => {
    switch (selectedMetric) {
      case 'conversions':
        return data.conversions
      case 'revenue':
        return data.revenue / 100000 // Convert to lakhs
      case 'conversionRate':
        return data.conversionRate
      default:
        return 0
    }
  }

  const getTargetValue = (data: MonthlyData): number => {
    switch (selectedMetric) {
      case 'conversions':
        return data.conversionTarget || 0
      case 'revenue':
        return (data.revenueTarget || 0) / 100000 // Convert to lakhs
      case 'conversionRate':
        return data.conversionTarget && data.revenueTarget
          ? (data.conversionTarget / (data.conversionTarget + 50)) * 100 // Estimated
          : 0
      default:
        return 0
    }
  }

  const values = reversedTrends.map(getMetricValue)
  const targetValues = reversedTrends.map(getTargetValue)

  const maxValue = Math.max(...values, ...targetValues)
  const minValue = Math.min(...values, ...targetValues)
  const valueRange = maxValue - minValue || 1

  // Calculate points for line chart
  const getX = (index: number) => chartPadding.left + (index / (reversedTrends.length - 1)) * plotWidth
  const getY = (value: number) => chartPadding.top + plotHeight - ((value - minValue) / valueRange) * plotHeight

  // Build SVG path for actual values
  const actualPath = reversedTrends
    .map((data, index) => {
      const x = getX(index)
      const y = getY(getMetricValue(data))
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(' ')

  // Build SVG path for target line
  const targetPath = reversedTrends
    .map((data, index) => {
      const x = getX(index)
      const y = getY(getTargetValue(data))
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
    })
    .join(' ')

  // Calculate trend direction
  const firstValue = values[0]
  const lastValue = values[values.length - 1]
  const trendDirection = lastValue > firstValue ? 'up' : lastValue < firstValue ? 'down' : 'flat'
  const trendPercentage = firstValue > 0 ? (((lastValue - firstValue) / firstValue) * 100).toFixed(1) : '0'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Historical Trends
          </CardTitle>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' ? (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-semibold">+{trendPercentage}%</span>
              </div>
            ) : trendDirection === 'down' ? (
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm font-semibold">{trendPercentage}%</span>
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-600">Flat</div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metric Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedMetric('conversions')}
            className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
              selectedMetric === 'conversions'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversions
            </div>
          </button>
          <button
            onClick={() => setSelectedMetric('revenue')}
            className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
              selectedMetric === 'revenue'
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue (₹L)
            </div>
          </button>
          <button
            onClick={() => setSelectedMetric('conversionRate')}
            className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all ${
              selectedMetric === 'conversionRate'
                ? 'bg-purple-500 text-white border-purple-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Conv. Rate (%)
            </div>
          </button>
        </div>

        {/* Chart */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-6 overflow-x-auto">
          <svg width={chartWidth} height={chartHeight} className="mx-auto">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => {
              const y = chartPadding.top + plotHeight * (1 - percent)
              const value = minValue + valueRange * percent
              return (
                <g key={percent}>
                  <line
                    x1={chartPadding.left}
                    y1={y}
                    x2={chartWidth - chartPadding.right}
                    y2={y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text x={chartPadding.left - 10} y={y + 5} textAnchor="end" className="text-xs fill-gray-600">
                    {selectedMetric === 'revenue'
                      ? `₹${value.toFixed(1)}L`
                      : selectedMetric === 'conversionRate'
                      ? `${value.toFixed(1)}%`
                      : Math.round(value)}
                  </text>
                </g>
              )
            })}

            {/* Target line (dashed) */}
            <path
              d={targetPath}
              stroke="#9ca3af"
              strokeWidth="2"
              strokeDasharray="6 4"
              fill="none"
            />

            {/* Actual line */}
            <path
              d={actualPath}
              stroke={selectedMetric === 'conversions' ? '#3b82f6' : selectedMetric === 'revenue' ? '#10b981' : '#8b5cf6'}
              strokeWidth="3"
              fill="none"
            />

            {/* Data points */}
            {reversedTrends.map((data, index) => {
              const x = getX(index)
              const y = getY(getMetricValue(data))
              const targetY = getY(getTargetValue(data))

              return (
                <g key={index}>
                  {/* Target point */}
                  <circle cx={x} cy={targetY} r="4" fill="#9ca3af" />

                  {/* Actual point */}
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={selectedMetric === 'conversions' ? '#3b82f6' : selectedMetric === 'revenue' ? '#10b981' : '#8b5cf6'}
                    className="cursor-pointer hover:r-7 transition-all"
                  >
                    <title>{`${data.monthName} ${data.year}: ${
                      selectedMetric === 'revenue'
                        ? `₹${getMetricValue(data).toFixed(2)}L`
                        : selectedMetric === 'conversionRate'
                        ? `${getMetricValue(data).toFixed(1)}%`
                        : Math.round(getMetricValue(data))
                    }`}</title>
                  </circle>

                  {/* X-axis labels */}
                  <text
                    x={x}
                    y={chartHeight - chartPadding.bottom + 20}
                    textAnchor="middle"
                    className="text-xs fill-gray-600"
                  >
                    {data.monthName.slice(0, 3)}
                  </text>
                  <text
                    x={x}
                    y={chartHeight - chartPadding.bottom + 35}
                    textAnchor="middle"
                    className="text-xs fill-gray-500"
                  >
                    '{String(data.year).slice(-2)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-4 h-0.5 ${
              selectedMetric === 'conversions' ? 'bg-blue-500' : selectedMetric === 'revenue' ? 'bg-green-500' : 'bg-purple-500'
            }`} />
            <span className="text-gray-700 font-medium">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-400" style={{ borderTop: '2px dashed #9ca3af' }} />
            <span className="text-gray-700 font-medium">Target</span>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Latest Value</div>
            <div className="text-2xl font-bold text-gray-900">
              {selectedMetric === 'revenue'
                ? `₹${lastValue.toFixed(2)}L`
                : selectedMetric === 'conversionRate'
                ? `${lastValue.toFixed(1)}%`
                : Math.round(lastValue)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Average</div>
            <div className="text-2xl font-bold text-blue-600">
              {selectedMetric === 'revenue'
                ? `₹${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)}L`
                : selectedMetric === 'conversionRate'
                ? `${(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}%`
                : Math.round(values.reduce((a, b) => a + b, 0) / values.length)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Highest</div>
            <div className="text-2xl font-bold text-green-600">
              {selectedMetric === 'revenue'
                ? `₹${maxValue.toFixed(2)}L`
                : selectedMetric === 'conversionRate'
                ? `${maxValue.toFixed(1)}%`
                : Math.round(maxValue)}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border-2">
            <div className="text-xs text-gray-600 mb-1">Trend</div>
            <div className={`text-2xl font-bold ${trendDirection === 'up' ? 'text-green-600' : trendDirection === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
              {trendDirection === 'up' ? '+' : ''}{trendPercentage}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
