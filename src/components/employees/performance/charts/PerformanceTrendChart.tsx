'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface PerformanceTrendChartProps {
  data: Array<{
    date: string
    leads_generated: number
    leads_converted: number
    business_volume: number
  }>
}

export default function PerformanceTrendChart({ data }: PerformanceTrendChartProps) {
  // Format data for display
  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    'Leads Generated': item.leads_generated,
    'Leads Converted': item.leads_converted,
    'Business Volume (₹L)': Math.round(item.business_volume / 100000) // Convert to lakhs
  }))

  return (
    <div className="content-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        30-Day Performance Trend
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff'
            }}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '14px', color: '#9CA3AF' }}
          />
          <Line
            type="monotone"
            dataKey="Leads Generated"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ fill: '#3B82F6', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Leads Converted"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ fill: '#10B981', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Business Volume (₹L)"
            stroke="#A855F7"
            strokeWidth={2}
            dot={{ fill: '#A855F7', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
