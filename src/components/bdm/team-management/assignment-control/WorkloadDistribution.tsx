'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AlertCircle, TrendingUp, Users, Zap } from 'lucide-react'

interface BDEWorkload {
  bdeId: string
  bdeName: string
  loanType: string
  workload: {
    current: number
    max: number
    percentage: number
    status: 'available' | 'moderate' | 'near_capacity' | 'at_capacity' | 'overloaded'
  }
  stageDistribution: Record<string, number>
  alerts: string[]
}

interface WorkloadSummary {
  totalBDEs: number
  activeBDEs: number
  pausedBDEs: number
  totalCapacity: number
  totalUtilized: number
  availableCapacity: number
  utilizationRate: number
  averageWorkload: number
}

interface WorkloadDistributionProps {
  teamWorkload: BDEWorkload[]
  summary: WorkloadSummary
}

export default function WorkloadDistribution({
  teamWorkload,
  summary,
}: WorkloadDistributionProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'moderate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'near_capacity':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'at_capacity':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'overloaded':
        return 'bg-red-200 text-red-900 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-600'
    if (percentage >= 90) return 'bg-orange-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const formatStatusLabel = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active BDEs</p>
                <p className="text-2xl font-bold">{summary.activeBDEs}/{summary.totalBDEs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Capacity</p>
                <p className="text-2xl font-bold">{summary.availableCapacity}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utilization Rate</p>
                <p className="text-2xl font-bold">{summary.utilizationRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Workload</p>
                <p className="text-2xl font-bold">{summary.averageWorkload}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Workload Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Team Workload Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamWorkload.map(bde => (
              <div key={bde.bdeId} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  {/* BDE Info */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(bde.bdeName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{bde.bdeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {bde.loanType.replace(/_/g, ' ').toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <Badge className={getStatusColor(bde.workload.status)}>
                    {formatStatusLabel(bde.workload.status)}
                  </Badge>
                </div>

                {/* Workload Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Workload</span>
                    <span className="font-semibold">
                      {bde.workload.current}/{bde.workload.max} ({bde.workload.percentage}%)
                    </span>
                  </div>
                  <div className="relative">
                    <Progress value={bde.workload.percentage} className="h-3" />
                    <div
                      className={`absolute top-0 left-0 h-3 rounded-full ${getProgressColor(bde.workload.percentage)}`}
                      style={{ width: `${Math.min(bde.workload.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stage Distribution */}
                {Object.keys(bde.stageDistribution).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium mb-2">Stage Distribution</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(bde.stageDistribution).map(([stage, count]) => (
                        <Badge key={stage} variant="secondary" className="text-xs">
                          {stage}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {bde.alerts.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-2">
                      {bde.alerts.map((alert, idx) => (
                        <div key={idx} className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                          {alert}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {teamWorkload.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No team members found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
