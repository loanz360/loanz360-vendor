'use client'

/**
 * Login Trend Chart Component
 * Displays successful vs failed login trends over time
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import type { LoginTrend } from '@/lib/analytics/admin-analytics'

interface LoginTrendChartProps {
  data: LoginTrend[]
  loading?: boolean
}

export default function LoginTrendChart({ data, loading = false }: LoginTrendChartProps) {
  if (loading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-gray-500">Loading chart...</div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-gray-500">No data available</div>
      </div>
    )
  }

  const formattedData = data.map((item) => ({
    ...item,
    date: format(new Date(item.date), 'MMM dd'),
  }))

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="successfulLogins"
            stroke="#10b981"
            strokeWidth={2}
            name="Successful Logins"
          />
          <Line
            type="monotone"
            dataKey="failedLogins"
            stroke="#ef4444"
            strokeWidth={2}
            name="Failed Logins"
          />
          <Line
            type="monotone"
            dataKey="uniqueAdmins"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Unique Admins"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
