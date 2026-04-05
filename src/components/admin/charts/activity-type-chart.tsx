'use client'

/**
 * Activity Type Chart Component
 * Displays breakdown of activities by type
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ActivityTypeChartProps {
  data: Record<string, number>
  loading?: boolean
}

export default function ActivityTypeChart({ data, loading = false }: ActivityTypeChartProps) {
  if (loading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    )
  }

  const chartData = Object.entries(data)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count: value,
    }))
    .sort((a, b) => b.count - a.count)

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-gray-500">No data available</div>
      </div>
    )
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#3b82f6" name="Activity Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
