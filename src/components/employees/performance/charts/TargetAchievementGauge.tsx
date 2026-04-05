'use client'

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis
} from 'recharts'

interface TargetAchievementGaugeProps {
  title: string
  current: number
  target: number
  unit?: string
  color?: string
}

export default function TargetAchievementGauge({
  title,
  current,
  target,
  unit = '',
  color = '#3B82F6'
}: TargetAchievementGaugeProps) {
  const achievementPercentage = target > 0 ? Math.min(Math.round((current / target) * 100), 150) : 0

  const data = [
    {
      name: title,
      value: achievementPercentage,
      fill: achievementPercentage >= 100 ? '#10B981' : achievementPercentage >= 75 ? color : '#F59E0B'
    }
  ]

  const getStatusColor = () => {
    if (achievementPercentage >= 100) return 'text-green-400'
    if (achievementPercentage >= 75) return 'text-blue-400'
    if (achievementPercentage >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusText = () => {
    if (achievementPercentage >= 100) return 'Target Achieved! 🎉'
    if (achievementPercentage >= 75) return 'On Track'
    if (achievementPercentage >= 50) return 'Needs Attention'
    return 'Below Target'
  }

  return (
    <div className="content-card p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>

      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="100%"
            barSize={20}
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 150]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: '#374151' }}
              dataKey="value"
              cornerRadius={10}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ top: '40%' }}>
          <div className={`text-4xl font-bold ${getStatusColor()}`}>
            {achievementPercentage}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {getStatusText()}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500">Current</p>
          <p className="text-lg font-semibold text-white">
            {current.toLocaleString('en-IN')} {unit}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Target</p>
          <p className="text-lg font-semibold text-white">
            {target.toLocaleString('en-IN')} {unit}
          </p>
        </div>
      </div>
    </div>
  )
}
