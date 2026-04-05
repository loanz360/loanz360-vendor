'use client'

import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Approval Rate Trend Chart
interface ApprovalRateTrendProps {
  data: Array<{
    date: string
    approvalRate: number
    totalApplications: number
  }>
  bankName: string
}

export function ApprovalRateTrendChart({ data, bankName }: ApprovalRateTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No trend data available
      </div>
    )
  }

  const maxRate = Math.max(...data.map(d => d.approvalRate))
  const minRate = Math.min(...data.map(d => d.approvalRate))
  const range = maxRate - minRate || 100

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Approval Rate Trend - {bankName}</h4>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">High: <span className="font-semibold text-green-600">{maxRate.toFixed(1)}%</span></span>
          <span className="text-gray-600">Low: <span className="font-semibold text-red-600">{minRate.toFixed(1)}%</span></span>
        </div>
      </div>

      <div className="relative h-64 border border-gray-200 rounded-lg p-4 bg-gradient-to-b from-white to-gray-50">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-600">
          <span>{maxRate.toFixed(0)}%</span>
          <span>{((maxRate + minRate) / 2).toFixed(0)}%</span>
          <span>{minRate.toFixed(0)}%</span>
        </div>

        {/* Chart area */}
        <div className="ml-12 h-full flex items-end gap-2">
          {data.map((point, index) => {
            const heightPercentage = ((point.approvalRate - minRate) / range) * 100
            const prevRate = index > 0 ? data[index - 1].approvalRate : point.approvalRate
            const trend = point.approvalRate > prevRate ? 'up' : point.approvalRate < prevRate ? 'down' : 'neutral'

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2 group relative">
                {/* Tooltip */}
                <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap z-10 pointer-events-none">
                  <p className="font-semibold">{point.date}</p>
                  <p>Approval: {point.approvalRate.toFixed(1)}%</p>
                  <p>Apps: {point.totalApplications}</p>
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
                </div>

                {/* Bar */}
                <div className="w-full flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-1">
                    {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-600" />}
                    {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-600" />}
                    {trend === 'neutral' && <Minus className="w-3 h-3 text-gray-400" />}
                  </div>
                  <div
                    className={`w-full rounded-t-lg transition-all hover:opacity-80 ${
                      point.approvalRate >= 70 ? 'bg-gradient-to-t from-green-500 to-green-400' :
                      point.approvalRate >= 50 ? 'bg-gradient-to-t from-yellow-500 to-yellow-400' :
                      'bg-gradient-to-t from-red-500 to-red-400'
                    }`}
                    style={{ height: `${heightPercentage}%` }}
                  />
                </div>

                {/* X-axis label */}
                <span className="text-xs text-gray-600 transform -rotate-45 origin-top-left mt-2">
                  {point.date}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Volume Distribution Chart
interface VolumeDistributionProps {
  data: Array<{
    bankName: string
    totalApplications: number
    percentage: number
    color: string
  }>
}

export function VolumeDistributionChart({ data }: VolumeDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No volume data available
      </div>
    )
  }

  const total = data.reduce((sum, item) => sum + item.totalApplications, 0)

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Volume Distribution by Bank</h4>

      {/* Donut Chart */}
      <div className="flex items-center justify-center">
        <div className="relative w-64 h-64">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {data.reduce((acc, item, index) => {
              const percentage = item.percentage
              const startAngle = acc.cumulative
              const angle = (percentage / 100) * 360
              const endAngle = startAngle + angle

              const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
              const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
              const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
              const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)

              const largeArc = angle > 180 ? 1 : 0

              const path = `
                M 50 50
                L ${startX} ${startY}
                A 40 40 0 ${largeArc} 1 ${endX} ${endY}
                Z
              `

              acc.cumulative = endAngle
              acc.elements.push(
                <path
                  key={index}
                  d={path}
                  fill={item.color}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                  strokeWidth="0.5"
                  stroke="white"
                />
              )

              return acc
            }, { cumulative: 0, elements: [] as JSX.Element[] }).elements}

            {/* Center circle to make it a donut */}
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-600">Total Apps</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{item.bankName}</p>
              <p className="text-xs text-gray-600">
                {item.totalApplications} apps ({item.percentage.toFixed(1)}%)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// TAT Heatmap
interface TATHeatmapProps {
  data: Array<{
    bankName: string
    weeklyTATs: number[] // 4 weeks
  }>
}

export function TATHeatmap({ data }: TATHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No TAT data available
      </div>
    )
  }

  const maxTAT = Math.max(...data.flatMap(d => d.weeklyTATs))
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

  const getTATColor = (tat: number) => {
    const intensity = (tat / maxTAT) * 100
    if (intensity <= 25) return 'bg-green-100 text-green-900'
    if (intensity <= 50) return 'bg-yellow-100 text-yellow-900'
    if (intensity <= 75) return 'bg-orange-100 text-orange-900'
    return 'bg-red-100 text-red-900'
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">TAT Heatmap (Weekly)</h4>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-sm font-medium text-gray-700 border border-gray-200">
                Bank
              </th>
              {weeks.map((week, index) => (
                <th key={index} className="p-2 text-center text-sm font-medium text-gray-700 border border-gray-200">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((bank, bankIndex) => (
              <tr key={bankIndex}>
                <td className="p-2 text-sm font-medium text-gray-900 border border-gray-200">
                  {bank.bankName}
                </td>
                {bank.weeklyTATs.map((tat, weekIndex) => (
                  <td
                    key={weekIndex}
                    className={`p-4 text-center border border-gray-200 ${getTATColor(tat)} transition-all hover:scale-105 cursor-pointer`}
                  >
                    <p className="text-sm font-bold">{tat.toFixed(1)}d</p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded" />
          Fast (&lt;25%)
        </span>
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 rounded" />
          Average (25-50%)
        </span>
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-100 rounded" />
          Slow (50-75%)
        </span>
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 rounded" />
          Very Slow (&gt;75%)
        </span>
      </div>
    </div>
  )
}

// Status Distribution Chart
interface StatusDistributionProps {
  data: {
    approved: number
    pending: number
    rejected: number
    total: number
  }
  bankName: string
}

export function StatusDistributionChart({ data, bankName }: StatusDistributionProps) {
  const statuses = [
    { label: 'Approved', value: data.approved, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Pending', value: data.pending, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
    { label: 'Rejected', value: data.rejected, color: 'bg-red-500', textColor: 'text-red-700' },
  ]

  const maxValue = Math.max(...statuses.map(s => s.value))

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Status Distribution - {bankName}</h4>

      <div className="space-y-3">
        {statuses.map((status, index) => {
          const percentage = data.total > 0 ? (status.value / data.total) * 100 : 0
          const barWidth = maxValue > 0 ? (status.value / maxValue) * 100 : 0

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">{status.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${status.textColor}`}>{status.value}</span>
                  <span className="text-gray-500">({percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full ${status.color} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 20 && (
                    <span className="text-white text-xs font-semibold">{percentage.toFixed(0)}%</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total Applications</span>
          <span className="text-lg font-bold text-gray-900">{data.total}</span>
        </div>
      </div>
    </div>
  )
}

// Comparison Radar Chart (simplified version)
interface RadarChartProps {
  data: Array<{
    bankName: string
    metrics: {
      approvalRate: number
      volume: number
      tat: number
      sla: number
      revenue: number
    }
  }>
}

export function RadarChart({ data }: RadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No comparison data available
      </div>
    )
  }

  const metrics = ['Approval Rate', 'Volume', 'TAT', 'SLA', 'Revenue']
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444']

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">Multi-Bank Comparison</h4>

      <div className="grid grid-cols-5 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">{metric}</p>
            <div className="space-y-1">
              {data.map((bank, bankIndex) => {
                const value = Object.values(bank.metrics)[index]
                const normalized = (value / 100) * 100 // Normalize to 0-100

                return (
                  <div key={bankIndex} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors[bankIndex % colors.length] }}
                    />
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${normalized}%`,
                          backgroundColor: colors[bankIndex % colors.length]
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        {data.map((bank, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-sm font-medium text-gray-700">{bank.bankName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
