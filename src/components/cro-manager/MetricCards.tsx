'use client'

import { LucideIcon } from 'lucide-react'

interface MetricCard {
  title: string
  value: string | number
  icon: LucideIcon
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
}

interface MetricCardsProps {
  metrics: MetricCard[]
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon
        return (
          <div
            key={idx}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-orange-500/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Icon className="w-5 h-5 text-orange-500" />
              </div>
              {metric.change && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    metric.changeType === 'up'
                      ? 'text-green-400 bg-green-500/10'
                      : metric.changeType === 'down'
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-gray-400 bg-gray-500/10'
                  }`}
                >
                  {metric.change}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{metric.value}</p>
            <p className="text-sm text-gray-400 mt-1">{metric.title}</p>
          </div>
        )
      })}
    </div>
  )
}
