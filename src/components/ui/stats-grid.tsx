'use client'

import React from 'react'
import { type LucideIcon } from 'lucide-react'

interface StatItem {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: LucideIcon
}

interface StatsGridProps {
  stats: StatItem[]
  columns?: 2 | 3 | 4
}

export default function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${colClass[columns]} gap-4`}>
      {stats.map((stat, i) => {
        const changeColor = stat.changeType === 'positive'
          ? 'text-green-400'
          : stat.changeType === 'negative'
          ? 'text-red-400'
          : 'text-gray-400'

        return (
          <div
            key={i}
            className="bg-[#171717] border border-gray-800 rounded-xl p-5 hover:border-[#FF6700]/20 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
              {stat.icon && (
                <div className="w-8 h-8 rounded-lg bg-[#FF6700]/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-[#FF6700]" />
                </div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            {stat.change && (
              <p className={`text-xs mt-1 ${changeColor}`}>{stat.change}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
