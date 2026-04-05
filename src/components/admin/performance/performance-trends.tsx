'use client'

/**
 * Performance Trends Component
 * Charts showing performance over time
 */

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import {
  type PerformanceTrend,
  type MetricType,
  type PeriodType,
  METRIC_TYPES,
  PERIOD_TYPES,
  getMetricDisplayName,
  formatMetricValue,
} from '@/lib/performance/performance-analytics'

interface PerformanceTrendsProps {
  adminId: string
  defaultMetric?: MetricType
  defaultPeriod?: PeriodType
}

export default function PerformanceTrends({
  adminId,
  defaultMetric = 'productivity_score',
  defaultPeriod = '30d',
}: PerformanceTrendsProps) {
  const [metric, setMetric] = useState<MetricType>(defaultMetric)
  const [period, setPeriod] = useState<PeriodType>(defaultPeriod)
  const [trends, setTrends] = useState<PerformanceTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrends()
  }, [adminId, metric, period])

  const fetchTrends = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/admin-management/performance/trends?adminId=${adminId}&metric=${metric}&period=${period}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch trends')
      }

      setTrends(data.trends || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends')
    } finally {
      setLoading(false)
    }
  }

  const chartData = trends.map((t) => ({
    date: format(new Date(t.date), 'MMM dd'),
    value: t.value,
    teamAverage: t.team_average,
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900">Performance Trends</h3>
        <div className="flex gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {Object.entries(METRIC_TYPES).map(([key, value]) => (
              <option key={value} value={value}>
                {getMetricDisplayName(value)}
              </option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-gray-500">Loading chart...</div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-gray-500">No data available</div>
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => formatMetricValue(metric, value)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Your Performance"
                dot={{ fill: '#3b82f6' }}
              />
              <Line
                type="monotone"
                dataKey="teamAverage"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Team Average"
                dot={{ fill: '#9ca3af' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
