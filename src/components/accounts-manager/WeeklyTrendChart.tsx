'use client'

import React from 'react'
import { BarChart3 } from 'lucide-react'

interface TrendDay {
  date: string
  day: string
  verified: number
  rejected: number
}

interface Props {
  weeklyTrend: TrendDay[]
}

export default function WeeklyTrendChart({ weeklyTrend }: Props) {
  const maxValue = Math.max(...weeklyTrend.map(d => d.verified + d.rejected), 1)

  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-orange-500" />
        7-Day Trend
      </h2>
      <div className="flex items-end gap-2 h-40">
        {weeklyTrend.map((day) => {
          const verifiedHeight = (day.verified / maxValue) * 100
          const rejectedHeight = (day.rejected / maxValue) * 100
          // Use IST (UTC+5:30) to match server-side date generation
          const now = new Date()
          const istDate = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
          const isToday = day.date === istDate.toISOString().split('T')[0]
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center justify-end h-32 relative group">
                {/* Tooltip */}
                <div className="absolute -top-8 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                  {day.verified} verified, {day.rejected} rejected
                </div>
                {/* Stacked bars */}
                <div className="w-full max-w-[32px] flex flex-col items-center justify-end h-full">
                  {day.rejected > 0 && (
                    <div
                      className="w-full bg-red-500/60 rounded-t-sm transition-all"
                      style={{ height: `${rejectedHeight}%`, minHeight: day.rejected > 0 ? 4 : 0 }}
                    />
                  )}
                  {day.verified > 0 && (
                    <div
                      className={`w-full bg-green-500/60 ${day.rejected === 0 ? 'rounded-t-sm' : ''} rounded-b-sm transition-all`}
                      style={{ height: `${verifiedHeight}%`, minHeight: day.verified > 0 ? 4 : 0 }}
                    />
                  )}
                  {day.verified === 0 && day.rejected === 0 && (
                    <div className="w-full bg-gray-700/30 rounded-sm" style={{ height: '4px' }} />
                  )}
                </div>
              </div>
              <span className={`text-xs ${isToday ? 'text-orange-400 font-bold' : 'text-gray-500'}`}>
                {day.day}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-500/60" /> Verified
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-red-500/60" /> Rejected
        </div>
      </div>
    </div>
  )
}
