'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Briefcase,
  MapPin,
  Target,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
} from 'lucide-react'

interface BDEDetailsDialogProps {
  bde: {
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
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BDEDetailsDialog({ bde, open, onOpenChange }: BDEDetailsDialogProps) {
  const formatLoanType = (loanType: string) => {
    return loanType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const getWorkloadStatus = (percentage: number) => {
    if (percentage >= 100) return { label: 'At Capacity', color: 'text-red-600' }
    if (percentage >= 90) return { label: 'Near Capacity', color: 'text-orange-600' }
    if (percentage >= 70) return { label: 'Moderate', color: 'text-yellow-600' }
    return { label: 'Available', color: 'text-green-600' }
  }

  const workloadStatus = getWorkloadStatus(bde.workload.percentage)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{bde.bdeName}</DialogTitle>
          <DialogDescription>{bde.bdeEmail}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Status</h3>
            <div className="flex items-center gap-2">
              {bde.isActive ? (
                <Badge variant="default" className="bg-green-600">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
              <Badge variant="outline">{bde.assignmentStatus}</Badge>
            </div>
          </div>

          <Separator />

          {/* Assignment Details */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Assignment Details</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Loan Type</div>
                  <div className="text-sm text-muted-foreground">
                    {formatLoanType(bde.loanType)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">Territory Coverage</div>
                  <div className="flex flex-wrap gap-1">
                    {bde.territory.map(pincode => (
                      <Badge key={pincode} variant="secondary" className="text-xs">
                        {pincode}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Workload */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Current Workload</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assigned Leads</span>
                <span className="font-semibold">
                  {bde.workload.current} / {bde.workload.max}
                </span>
              </div>
              <Progress value={bde.workload.percentage} className="h-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Capacity</span>
                <span className={`font-semibold ${workloadStatus.color}`}>
                  {bde.workload.percentage}% - {workloadStatus.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available Slots</span>
                <span className="font-semibold">
                  {bde.workload.max - bde.workload.current}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Performance Metrics */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-xs">Conversions</span>
                </div>
                <div className="text-2xl font-bold">{bde.performance.conversions}</div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Revenue</span>
                </div>
                <div className="text-2xl font-bold">
                  ₹{(bde.performance.revenue / 10000000).toFixed(2)}Cr
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Conversion Rate</span>
                </div>
                <div className="text-2xl font-bold">
                  {bde.performance.conversionRate.toFixed(1)}%
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Average TAT</span>
                </div>
                <div className="text-2xl font-bold">{bde.performance.avgTAT} days</div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Recent Activity</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Last active: {bde.lastActivity}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
