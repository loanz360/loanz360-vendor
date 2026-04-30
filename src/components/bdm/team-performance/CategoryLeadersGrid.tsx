'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { CategoryLeader } from '@/types/bdm-team-performance'
import { Trophy, DollarSign, Target, Zap, Activity, Award } from 'lucide-react'

interface CategoryLeadersGridProps {
  leaders: CategoryLeader[]
  onBDEClick?: (bdeId: string) => void
}

export default function CategoryLeadersGrid({ leaders, onBDEClick }: CategoryLeadersGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {leaders.map((leader) => {
        const Icon = getIconComponent(leader.icon)

        return (
          <Card
            key={leader.category}
            className="border-2 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => leader.bdeId && onBDEClick?.(leader.bdeId)}
          >
            <CardContent className="p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${getGradientColor(leader.icon)}`}>
                  <Icon className={`h-6 w-6 ${leader.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-gray-600">{leader.category}</h3>
                  <p className="text-xs text-gray-500">{leader.description}</p>
                </div>
              </div>

              {/* Leader Info */}
              {leader.bdeId ? (
                <div className="space-y-3">
                  {/* BDE Name */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-md flex-shrink-0">
                      {leader.bdeName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {leader.bdeName}
                      </div>
                      <div className="text-xs text-gray-500">Leader</div>
                    </div>
                  </div>

                  {/* Value Display */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {leader.formattedValue}
                    </div>
                    <div className={`text-xs font-semibold ${leader.color}`}>
                      {leader.category.toUpperCase()}
                    </div>
                  </div>

                  {/* Trophy Icon */}
                  <div className="flex justify-center">
                    <Trophy className="h-8 w-8 text-yellow-500" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No data yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function getIconComponent(iconName: string) {
  const icons: Record<string, unknown> = {
    Trophy,
    DollarSign,
    Target,
    Zap,
    Activity,
    Award,
  }
  return icons[iconName] || Trophy
}

function getGradientColor(iconName: string) {
  switch (iconName) {
    case 'Trophy':
      return 'from-yellow-100 to-yellow-200'
    case 'DollarSign':
      return 'from-green-100 to-green-200'
    case 'Target':
      return 'from-blue-100 to-blue-200'
    case 'Zap':
      return 'from-purple-100 to-purple-200'
    case 'Activity':
      return 'from-orange-100 to-orange-200'
    case 'Award':
      return 'from-pink-100 to-pink-200'
    default:
      return 'from-gray-100 to-gray-200'
  }
}
