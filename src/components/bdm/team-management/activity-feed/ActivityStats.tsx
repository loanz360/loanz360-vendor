'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Activity, User, TrendingUp } from 'lucide-react'

interface ActivityStatsProps {
  stats: {
    totalActivities: number
    mostActiveBDE: {
      name: string
      count: number
    }
    activityBreakdown: Record<string, number>
  }
}

export default function ActivityStats({ stats }: ActivityStatsProps) {
  const topActivityType = Object.entries(stats.activityBreakdown).sort(
    ([, a], [, b]) => b - a
  )[0]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Activities</p>
              <p className="text-2xl font-bold">{stats.totalActivities}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Most Active BDE</p>
              <p className="text-lg font-semibold truncate">{stats.mostActiveBDE.name}</p>
              <p className="text-xs text-muted-foreground">{stats.mostActiveBDE.count} activities</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Activity</p>
              <p className="text-lg font-semibold">
                {topActivityType ? formatActivityType(topActivityType[0]) : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">
                {topActivityType ? `${topActivityType[1]} times` : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatActivityType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
