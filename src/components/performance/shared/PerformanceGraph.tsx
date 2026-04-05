'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, BarChart3, Activity } from 'lucide-react'
import type { GraphDataPoint } from '@/lib/types/performance.types'

interface PerformanceGraphProps {
  data: GraphDataPoint[]
  title?: string
  description?: string
  type?: 'line' | 'area' | 'bar'
  dataKeys?: {
    primary: string
    secondary?: string
    tertiary?: string
  }
  colors?: {
    primary?: string
    secondary?: string
    tertiary?: string
  }
  showLegend?: boolean
  showGrid?: boolean
  height?: number
  className?: string
}

export function PerformanceGraph({
  data,
  title = 'Performance Trend',
  description,
  type = 'line',
  dataKeys = {
    primary: 'value',
    secondary: 'target',
    tertiary: 'average',
  },
  colors = {
    primary: '#3B82F6', // blue
    secondary: '#10B981', // green
    tertiary: '#F59E0B', // orange
  },
  showLegend = true,
  showGrid = true,
  height = 300,
  className,
}: PerformanceGraphProps) {
  // Format date for tooltip
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }

  // Format value for tooltip
  const formatValue = (value: number): string => {
    if (value >= 10000000) {
      return `₹${(value / 10000000).toFixed(2)}Cr`
    }
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(2)}L`
    }
    if (value >= 1000) {
      return value.toLocaleString('en-IN')
    }
    return value.toString()
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{formatDate(label)}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600">{entry.name}:</span>
              </span>
              <span className="font-semibold" style={{ color: entry.color }}>
                {formatValue(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Calculate trend
  const trend = useMemo(() => {
    if (data.length < 2) return { direction: 'stable', percentage: 0 }

    const firstValue = data[0][dataKeys.primary as keyof GraphDataPoint] as number
    const lastValue = data[data.length - 1][dataKeys.primary as keyof GraphDataPoint] as number

    const percentage = ((lastValue - firstValue) / firstValue) * 100
    const direction = percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'stable'

    return { direction, percentage: Math.abs(percentage) }
  }, [data, dataKeys.primary])

  // Get chart icon
  const getChartIcon = () => {
    if (type === 'bar') return <BarChart3 className="w-5 h-5 text-gray-600" />
    if (type === 'area') return <Activity className="w-5 h-5 text-gray-600" />
    return <TrendingUp className="w-5 h-5 text-gray-600" />
  }

  // Render appropriate chart type
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    }

    if (type === 'line') {
      return (
        <LineChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <YAxis tickFormatter={(value) => formatValue(value)} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}

          <Line
            type="monotone"
            dataKey={dataKeys.primary}
            stroke={colors.primary}
            strokeWidth={3}
            dot={{ fill: colors.primary, r: 4 }}
            activeDot={{ r: 6 }}
            name="Performance"
          />

          {dataKeys.secondary && (
            <Line
              type="monotone"
              dataKey={dataKeys.secondary}
              stroke={colors.secondary}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
            />
          )}

          {dataKeys.tertiary && (
            <Line
              type="monotone"
              dataKey={dataKeys.tertiary}
              stroke={colors.tertiary}
              strokeWidth={2}
              strokeDasharray="3 3"
              dot={false}
              name="Average"
            />
          )}
        </LineChart>
      )
    }

    if (type === 'area') {
      return (
        <AreaChart {...commonProps}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <YAxis tickFormatter={(value) => formatValue(value)} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}

          <Area
            type="monotone"
            dataKey={dataKeys.primary}
            stroke={colors.primary}
            fill={colors.primary}
            fillOpacity={0.2}
            strokeWidth={2}
            name="Performance"
          />

          {dataKeys.secondary && (
            <Area
              type="monotone"
              dataKey={dataKeys.secondary}
              stroke={colors.secondary}
              fill="none"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Target"
            />
          )}
        </AreaChart>
      )
    }

    // Bar chart
    return (
      <BarChart {...commonProps}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />}
        <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
        <YAxis tickFormatter={(value) => formatValue(value)} stroke="#9CA3AF" style={{ fontSize: '12px' }} />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && <Legend />}

        <Bar dataKey={dataKeys.primary} fill={colors.primary} radius={[8, 8, 0, 0]} name="Performance" />

        {dataKeys.secondary && (
          <Bar dataKey={dataKeys.secondary} fill={colors.secondary} radius={[8, 8, 0, 0]} name="Target" />
        )}
      </BarChart>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {getChartIcon()}
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>

          {/* Trend Indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Trend:</span>
            <div className={`flex items-center gap-1 font-semibold ${
              trend.direction === 'up' ? 'text-green-500' :
              trend.direction === 'down' ? 'text-red-500' :
              'text-gray-500'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
              {trend.direction === 'down' && <TrendingUp className="w-4 h-4 rotate-180" />}
              {trend.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No performance data available</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// Performance Graph Skeleton Loader
export function PerformanceGraphSkeleton({ height = 300 }: { height?: number }) {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-64 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full bg-gray-200 rounded" style={{ height }} />
      </CardContent>
    </Card>
  )
}
