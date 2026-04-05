'use client'

/**
 * Team Performance Summary Component
 * Displays aggregated team performance metrics
 */

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { TeamSummary } from '@/lib/performance/performance-analytics'

interface TeamSummaryProps {
  period?: string
}

const SCORE_COLORS = {
  excellent: '#10b981',
  good: '#3b82f6',
  average: '#f59e0b',
  poor: '#ef4444',
}

export default function TeamSummary({ period = '7d' }: TeamSummaryProps) {
  const [summary, setSummary] = useState<TeamSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSummary()
  }, [period])

  const fetchSummary = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/admin-management/performance/team-summary?period=${period}`
      )
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch team summary')
      }

      setSummary(data.summary)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team summary')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="animate-pulse bg-gray-100 h-64 rounded-lg" />
        <div className="animate-pulse bg-gray-100 h-64 rounded-lg" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error || 'No data available'}
      </div>
    )
  }

  const distributionData = [
    { name: 'Excellent (≥80)', value: summary.scoreDistribution.excellent, color: SCORE_COLORS.excellent },
    { name: 'Good (60-79)', value: summary.scoreDistribution.good, color: SCORE_COLORS.good },
    { name: 'Average (40-59)', value: summary.scoreDistribution.average, color: SCORE_COLORS.average },
    { name: 'Poor (<40)', value: summary.scoreDistribution.poor, color: SCORE_COLORS.poor },
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Team Avg Score"
          value={summary.averageProductivityScore.toFixed(1)}
          subtitle={`${summary.activeAdmins} active admins`}
          color="blue"
        />
        <StatCard
          title="Completion Rate"
          value={`${summary.averageCompletionRate.toFixed(1)}%`}
          subtitle="Average completion"
          color="green"
        />
        <StatCard
          title="Quality Score"
          value={summary.averageQualityScore.toFixed(1)}
          subtitle="Team quality avg"
          color="purple"
        />
        <StatCard
          title="Total Actions"
          value={summary.totalActions.toLocaleString()}
          subtitle={`${summary.averageActiveHours.toFixed(1)} hrs avg`}
          color="orange"
        />
      </div>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Score Distribution</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.split(' ')[0]}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Breakdown</h3>
          <div className="space-y-4">
            <DistributionBar
              label="Excellent"
              count={summary.scoreDistribution.excellent}
              total={summary.activeAdmins}
              color="bg-green-500"
            />
            <DistributionBar
              label="Good"
              count={summary.scoreDistribution.good}
              total={summary.activeAdmins}
              color="bg-blue-500"
            />
            <DistributionBar
              label="Average"
              count={summary.scoreDistribution.average}
              total={summary.activeAdmins}
              color="bg-yellow-500"
            />
            <DistributionBar
              label="Needs Improvement"
              count={summary.scoreDistribution.poor}
              total={summary.activeAdmins}
              color="bg-red-500"
            />
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Top Score:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {summary.topPerformerScore}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Low Score:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {summary.lowPerformerScore}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    orange: 'bg-orange-50 text-orange-600 border-orange-200',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4`}>
      <div className="text-sm font-medium opacity-80 mb-1">{title}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-70">{subtitle}</div>
    </div>
  )
}

interface DistributionBarProps {
  label: string
  count: number
  total: number
  color: string
}

function DistributionBar({ label, count, total, color }: DistributionBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {count} ({percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
