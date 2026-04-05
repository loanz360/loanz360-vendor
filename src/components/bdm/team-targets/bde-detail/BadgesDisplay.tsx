'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'

interface BadgesDisplayProps {
  badges: Array<{
    id: string
    name: string
    icon: string
    color: string
    rarity: string
    category: string
    earnedAt: string
    context: any
  }>
}

export default function BadgesDisplay({ badges }: BadgesDisplayProps) {
  const getRarityColor = (rarity: string) => {
    const colors = {
      legendary: 'bg-yellow-900/30 border-yellow-500/50 text-yellow-400',
      epic: 'bg-purple-900/30 border-purple-500/50 text-purple-400',
      rare: 'bg-blue-900/30 border-blue-500/50 text-blue-400',
      common: 'bg-gray-800 border-gray-600 text-gray-300',
    }
    return colors[rarity as keyof typeof colors] || colors.common
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      performance: '🎯',
      consistency: '⭐',
      quality: '✨',
      milestone: '🏆',
      team: '🤝',
    }
    return icons[category as keyof typeof icons] || '🏅'
  }

  // Group badges by rarity
  const groupedBadges = badges.reduce(
    (acc, badge) => {
      const rarity = badge.rarity || 'common'
      if (!acc[rarity]) acc[rarity] = []
      acc[rarity].push(badge)
      return acc
    },
    {} as Record<string, typeof badges>
  )

  const rarityOrder = ['legendary', 'epic', 'rare', 'common']

  return (
    <div className="space-y-6">
      {rarityOrder.map((rarity) => {
        const badgesInRarity = groupedBadges[rarity]
        if (!badgesInRarity || badgesInRarity.length === 0) return null

        return (
          <div key={rarity}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">{rarity} Badges</h3>
              <span className="text-xs text-gray-500">({badgesInRarity.length})</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {badgesInRarity.map((badge) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-lg border-2 ${getRarityColor(badge.rarity)} transition-all hover:scale-105 cursor-pointer`}
                  title={`Earned: ${new Date(badge.earnedAt).toLocaleDateString()}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-3xl">{badge.icon}</span>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryIcon(badge.category)}
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">{badge.name}</h4>
                  <p className="text-xs text-gray-400">
                    Earned {new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  {badge.context && badge.context.metric_value && (
                    <p className="text-xs text-gray-500 mt-1">Value: {badge.context.metric_value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {badges.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p>No badges earned this month yet</p>
          <p className="text-sm mt-2">Keep performing to unlock achievements!</p>
        </div>
      )}
    </div>
  )
}
