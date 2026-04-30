'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts'

interface PartnerDistributionChartProps {
  data: {
    ba_count: number
    bp_count: number
    cp_count: number
  }
}

const COLORS = {
  BA: '#3B82F6', // Blue
  BP: '#10B981', // Green
  CP: '#A855F7'  // Purple
}

export default function PartnerDistributionChart({ data }: PartnerDistributionChartProps) {
  const chartData = [
    { name: 'Business Associate (BA)', value: data.ba_count, color: COLORS.BA },
    { name: 'Business Partner (BP)', value: data.bp_count, color: COLORS.BP },
    { name: 'Channel Partner (CP)', value: data.cp_count, color: COLORS.CP }
  ].filter(item => item.value > 0) // Only show non-zero values

  const total = data.ba_count + data.bp_count + data.cp_count

  if (total === 0) {
    return (
      <div className="content-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Partner Type Distribution
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No partners recruited yet
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload }: unknown) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const percentage = ((data.value / total) * 100).toFixed(1)
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-gray-300 text-sm">
            Count: <span className="font-semibold">{data.value}</span>
          </p>
          <p className="text-gray-300 text-sm">
            Percentage: <span className="font-semibold">{percentage}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="content-card p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Partner Type Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: unknown) => (
              <span style={{ color: '#9CA3AF', fontSize: '14px' }}>
                {value} ({entry.payload.value})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
