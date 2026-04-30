'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, TrendingUp, Award, Flame } from 'lucide-react'

interface DailyAchievementsProps {
  dateRange?: string
}

export function DailyAchievementsComponent({ dateRange = 'this_month' }: DailyAchievementsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-achievements', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/bdm/team-targets/daily-achievements?startDate=${dateRange}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const achievements = data?.data?.achievements || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium">Days Active</span>
          </div>
          <p className="text-2xl font-bold">{achievements.length}</p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium">Longest Streak</span>
          </div>
          <p className="text-2xl font-bold">
            {Math.max(...achievements.map((a: unknown) => a.longest_streak || 0), 0)}
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium">Total MTD</span>
          </div>
          <p className="text-2xl font-bold">
            {achievements.reduce((sum: number, a: unknown) => sum + (a.mtd_conversions || 0), 0)}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-bold text-lg mb-4">Recent Achievements</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : achievements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No achievements yet</p>
        ) : (
          <div className="space-y-3">
            {achievements.slice(0, 10).map((achievement: unknown) => (
              <div key={achievement.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">{achievement.bde?.full_name || 'BDE'}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(achievement.achievement_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">
                    <strong className="text-blue-600">{achievement.leads_contacted}</strong> leads
                  </span>
                  <span className="text-gray-600">
                    <strong className="text-green-600">{achievement.conversions}</strong> conversions
                  </span>
                  {achievement.current_streak > 0 && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Flame className="w-4 h-4" />
                      {achievement.current_streak} day streak
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
