'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  User,
  MapPin,
  Briefcase,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

interface BDECardProps {
  member: {
    bdeId: string
    bdeName: string
    bdeEmail: string
    loanType: string
    territory: string[]
    workload: {
      current: number
      max: number
      percentage: number
      status: string
    }
    performance: {
      conversions: number
      revenue: number
      conversionRate: number
      avgTAT: number
    }
    assignmentStatus: string
    isActive: boolean
    lastActivity: string
  }
  onViewDetails: () => void
}

export default function BDECard({ member, onViewDetails }: BDECardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const getWorkloadColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getStatusBadge = () => {
    if (!member.isActive) {
      return <Badge variant="secondary">Inactive</Badge>
    }

    switch (member.assignmentStatus) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>
      case 'on_leave':
        return <Badge variant="outline">On Leave</Badge>
      case 'notice_period':
        return <Badge variant="destructive">Notice Period</Badge>
      default:
        return <Badge variant="outline">{member.assignmentStatus}</Badge>
    }
  }

  const formatLoanType = (loanType: string) => {
    return loanType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(member.bdeName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{member.bdeName}</h3>
              <p className="text-xs text-muted-foreground">{member.bdeEmail}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loan Type & Territory */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>{formatLoanType(member.loanType)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{member.territory.length} pincodes</span>
          </div>
        </div>

        {/* Workload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Workload</span>
            <span className={`font-semibold ${getWorkloadColor(member.workload.percentage)}`}>
              {member.workload.current}/{member.workload.max} ({member.workload.percentage}%)
            </span>
          </div>
          <Progress value={member.workload.percentage} className="h-2" />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Conversions</div>
            <div className="text-lg font-bold">{member.performance.conversions}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="text-lg font-bold">
              ₹{(member.performance.revenue / 10000000).toFixed(1)}Cr
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Conv. Rate</div>
            <div className="text-lg font-bold">{member.performance.conversionRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Avg TAT</div>
            <div className="text-lg font-bold">{member.performance.avgTAT}d</div>
          </div>
        </div>

        {/* Last Activity */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
          <Clock className="h-3 w-3" />
          <span>Last active: {member.lastActivity}</span>
        </div>

        {/* Action Button */}
        <Button variant="outline" size="sm" className="w-full" onClick={onViewDetails}>
          View Details
        </Button>
      </CardContent>
    </Card>
  )
}
