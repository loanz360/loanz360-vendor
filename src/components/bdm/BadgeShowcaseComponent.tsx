'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Lock, Award, Star } from 'lucide-react'

interface BadgeShowcaseProps {
  bdeUserId?: string
}

export function BadgeShowcaseComponent({ bdeUserId }: BadgeShowcaseProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['earned-badges', bdeUserId],
    queryFn: async () => {
      const params = bdeUserId ? `?bdeUserId=${bdeUserId}` : ''
      const res = await fetch(`/api/bdm/team-targets/badges/earned${params}`)
      if (!res.ok) throw new Error('Failed to fetch badges')
      return res.json()
    },
  })

  const earnedBadges = data?.data?.earned || []

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 to-orange-500'
      case 'epic': return 'from-purple-400 to-purple-600'
      case 'rare': return 'from-blue-400 to-blue-600'
      default: return 'from-gray-300 to-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <Award className="w-6 h-6 text-yellow-600 mb-2" />
          <p className="text-sm text-gray-600">Total Earned</p>
          <p className="text-2xl font-bold">{earnedBadges.length}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <Trophy className="w-6 h-6 text-purple-600 mb-2" />
          <p className="text-sm text-gray-600">Legendary</p>
          <p className="text-2xl font-bold">
            {earnedBadges.filter((b: unknown) => b.badge?.rarity === 'legendary').length}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <Star className="w-6 h-6 text-blue-600 mb-2" />
          <p className="text-sm text-gray-600">Epic</p>
          <p className="text-2xl font-bold">
            {earnedBadges.filter((b: unknown) => b.badge?.rarity === 'epic').length}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <Award className="w-6 h-6 text-green-600 mb-2" />
          <p className="text-sm text-gray-600">Rare</p>
          <p className="text-2xl font-bold">
            {earnedBadges.filter((b: unknown) => b.badge?.rarity === 'rare').length}
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-bold text-lg mb-4">Earned Badges</h3>
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : earnedBadges.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No badges earned yet</p>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {earnedBadges.map((earned: unknown) => (
              <div
                key={earned.id}
                className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className={`w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br ${getRarityColor(earned.badge?.rarity)} flex items-center justify-center`}>
                  <Trophy className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-semibold text-sm text-center mb-1">{earned.badge?.name}</h4>
                <p className="text-xs text-gray-600 text-center mb-2">{earned.badge?.description}</p>
                <p className="text-xs text-center text-gray-500">
                  {new Date(earned.earned_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
