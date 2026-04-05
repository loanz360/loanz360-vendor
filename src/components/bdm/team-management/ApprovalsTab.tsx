'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, ClipboardCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LeaveRequestsList from './approvals/LeaveRequestsList'
import RegularizationRequestsList from './approvals/RegularizationRequestsList'

interface LeaveRequest {
  id: string
  bdeId: string
  bdeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: string
  submittedAt: string
}

interface RegularizationRequest {
  id: string
  bdeId: string
  bdeName: string
  date: string
  requestedCheckIn: string
  requestedCheckOut: string
  actualCheckIn: string
  actualCheckOut: string
  reason: string
  status: string
  submittedAt: string
}

export default function ApprovalsTab() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [regularizationRequests, setRegularizationRequests] = useState<RegularizationRequest[]>([])
  const { toast } = useToast()

  // Fetch approvals data
  const fetchApprovals = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await fetch('/api/bdm/team-management/approvals')

      if (!response.ok) {
        throw new Error('Failed to fetch approvals')
      }

      const result = await response.json()
      setLeaveRequests(result.leaveRequests || [])
      setRegularizationRequests(result.regularizationRequests || [])

      if (isRefresh) {
        toast({
          title: 'Approvals refreshed',
          description: 'Latest data loaded successfully',
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching approvals:', error)
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load approvals',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Handle leave approval/rejection
  const handleLeaveAction = async (requestId: string, action: 'approve' | 'reject', remarks?: string) => {
    try {
      const response = await fetch(`/api/bdm/team-management/approvals/leaves/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process leave request')
      }

      const result = await response.json()

      toast({
        title: action === 'approve' ? 'Leave Approved' : 'Leave Rejected',
        description: result.message,
      })

      // Refresh data
      fetchApprovals(true)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // Handle regularization approval/rejection
  const handleRegularizationAction = async (requestId: string, action: 'approve' | 'reject', remarks?: string) => {
    try {
      const response = await fetch(`/api/bdm/team-management/approvals/regularization/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remarks }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process regularization request')
      }

      const result = await response.json()

      toast({
        title: action === 'approve' ? 'Regularization Approved' : 'Regularization Rejected',
        description: result.message,
      })

      // Refresh data
      fetchApprovals(true)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    fetchApprovals()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading approvals...</p>
        </div>
      </div>
    )
  }

  const pendingLeaves = leaveRequests.filter(r => r.status === 'pending').length
  const pendingRegularizations = regularizationRequests.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Approvals</h2>
          <p className="text-sm text-muted-foreground">
            {pendingLeaves + pendingRegularizations} pending requests
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchApprovals(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leaves" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaves" className="relative">
            Leave Requests
            {pendingLeaves > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingLeaves}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="regularization" className="relative">
            Attendance Regularization
            {pendingRegularizations > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingRegularizations}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaves">
          <LeaveRequestsList
            requests={leaveRequests}
            onApprove={(id, remarks) => handleLeaveAction(id, 'approve', remarks)}
            onReject={(id, remarks) => handleLeaveAction(id, 'reject', remarks)}
          />
        </TabsContent>

        <TabsContent value="regularization">
          <RegularizationRequestsList
            requests={regularizationRequests}
            onApprove={(id, remarks) => handleRegularizationAction(id, 'approve', remarks)}
            onReject={(id, remarks) => handleRegularizationAction(id, 'reject', remarks)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
