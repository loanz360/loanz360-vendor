'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Play, Pause, Zap, CheckCircle } from 'lucide-react'

interface AssignmentControlsProps {
  onAutoAssign: () => void
  onPauseBDE: (bdeId: string) => void
  onResumeBDE: (bdeId: string) => void
  engineStatus: {
    pendingLeads: { total: number; byLoanType: Record<string, number> }
    bdeCapacity: { byLoanType: Record<string, { available: number; total: number; bdes: number }> }
    engineStatus: string
    lastRun: string | null
  } | null
}

export default function AssignmentControls({
  onAutoAssign,
  onPauseBDE,
  onResumeBDE,
  engineStatus,
}: AssignmentControlsProps) {
  const [assigning, setAssigning] = useState(false)
  const { toast } = useToast()

  const handleAutoAssign = async () => {
    setAssigning(true)
    try {
      await onAutoAssign()
      toast({
        title: 'Auto-assignment started',
        description: 'Leads are being assigned to available BDEs',
      })
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to start auto-assignment',
        variant: 'destructive',
      })
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Auto-Assignment Engine */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Auto-Assignment Engine</CardTitle>
            {engineStatus && (
              <Badge variant={engineStatus.engineStatus === 'ready' ? 'default' : 'secondary'}>
                {engineStatus.engineStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Engine Stats */}
            {engineStatus && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Leads</p>
                  <p className="text-2xl font-bold">{engineStatus.pendingLeads.total}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(engineStatus.pendingLeads.byLoanType).map(([type, count]) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Available Capacity</p>
                  {Object.entries(engineStatus.bdeCapacity.byLoanType).map(([type, capacity]) => (
                    <div key={type} className="mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{type}</span>
                        <span>
                          {capacity.available}/{capacity.total} ({capacity.bdes} BDEs)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAutoAssign}
                disabled={assigning || engineStatus?.pendingLeads.total === 0}
                className="flex-1"
              >
                {assigning ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Auto-Assign All Pending Leads
                  </>
                )}
              </Button>

              {engineStatus?.lastRun && (
                <div className="text-xs text-muted-foreground">
                  Last run: {new Date(engineStatus.lastRun).toLocaleString()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="text-sm text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Auto-assignment uses round-robin algorithm based on loan type + geography
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium mb-1">Manual Assignment</div>
                <div className="text-xs text-muted-foreground">
                  Assign leads to specific BDEs
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium mb-1">Bulk Reassignment</div>
                <div className="text-xs text-muted-foreground">
                  Reassign multiple leads at once
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium mb-1">Workload Rebalancing</div>
                <div className="text-xs text-muted-foreground">
                  Balance load across team
                </div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
