'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award } from 'lucide-react'

interface BDELeaderboardProps {
  data: Array<{
    bdeId: string
    bdeName: string
    conversions: number
    revenue: number
    conversionRate: number
    rank: number
  }>
}

export default function BDELeaderboard({ data }: BDELeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />
      default:
        return (
          <div className="h-5 w-5 flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">{rank}</span>
          </div>
        )
    }
  }

  const getRankBadgeVariant = (rank: number): 'default' | 'secondary' | 'outline' => {
    if (rank === 1) return 'default'
    if (rank <= 3) return 'secondary'
    return 'outline'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>BDE Leaderboard</CardTitle>
        <CardDescription>Top performers this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((bde, index) => (
            <div
              key={bde.bdeId}
              className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                bde.rank <= 3 ? 'bg-muted/50' : ''
              }`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8">
                {getRankIcon(bde.rank)}
              </div>

              {/* Avatar */}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getInitials(bde.bdeName)}
                </AvatarFallback>
              </Avatar>

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{bde.bdeName}</p>
                  {bde.rank <= 3 && (
                    <Badge variant={getRankBadgeVariant(bde.rank)} className="text-xs">
                      Rank #{bde.rank}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span>{bde.conversions} conversions</span>
                  <span>•</span>
                  <span>₹{(bde.revenue / 10000000).toFixed(2)}Cr</span>
                  <span>•</span>
                  <span>{bde.conversionRate.toFixed(1)}% rate</span>
                </div>
              </div>

              {/* Conversion Rate Badge */}
              <div className="flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold">{bde.conversionRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Conv. Rate</div>
                </div>
              </div>
            </div>
          ))}

          {data.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No performance data available yet</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
