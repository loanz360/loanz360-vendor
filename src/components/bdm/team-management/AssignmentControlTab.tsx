'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PendingLeadsQueue from './assignment-control/PendingLeadsQueue'
import WorkloadDistribution from './assignment-control/WorkloadDistribution'
import AssignmentControls from './assignment-control/AssignmentControls'
import ManualAssignmentDialog from './assignment-control/ManualAssignmentDialog'
import BulkReassignmentDialog from './assignment-control/BulkReassignmentDialog'
import RecommendationsPanel from './assignment-control/RecommendationsPanel'

interface PendingLead {
  id: string
  customer_name: string
  loan_type: string
  requested_amount: number
  pincode: string
  lead_source: string
  created_at: string
  leadAge: any
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assignability: any
  suggestedBDEs: any[]
}

export default function AssignmentControlTab() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([])
  const [teamWorkload, setTeamWorkload] = useState<any[]>([])
  const [workloadSummary, setWorkloadSummary] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [engineStatus, setEngineStatus] = useState<any>(null)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [manualAssignDialogOpen, setManualAssignDialogOpen] = useState(false)
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<PendingLead | null>(null)
  const { toast } = useToast()

  // Fetch all data
  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Fetch pending leads
      const pendingRes = await fetch('/api/bdm/team-management/assignment/pending')
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json()
        setPendingLeads(pendingData.pendingLeads || [])
      }

      // Fetch workload
      const workloadRes = await fetch('/api/bdm/team-management/assignment/workload')
      if (workloadRes.ok) {
        const workloadData = await workloadRes.json()
        setTeamWorkload(workloadData.teamWorkload || [])
        setWorkloadSummary(workloadData.summary)
        setRecommendations(workloadData.recommendations || [])
      }

      // Fetch engine status
      const engineRes = await fetch('/api/bdm/team-management/assignment/engine')
      if (engineRes.ok) {
        const engineData = await engineRes.json()
        setEngineStatus(engineData)
      }

      if (isRefresh) {
        toast({
          title: 'Data refreshed',
          description: 'Latest assignment data loaded successfully',
        })
      }
    } catch (error: unknown) {
      console.error('Error fetching assignment data:', error)
      toast({
        title: 'Error',
        description: (error instanceof Error ? error.message : String(error)) || 'Failed to load assignment data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Auto-assign leads
  const handleAutoAssign = async () => {
    try {
      const response = await fetch('/api/bdm/team-management/assignment/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      })

      if (!response.ok) throw new Error('Auto-assignment failed')

      const result = await response.json()

      toast({
        title: 'Auto-assignment complete',
        description: `Assigned ${result.assignedCount} leads, skipped ${result.skippedCount}`,
      })

      // Refresh data
      fetchData(true)
    } catch (error: unknown) {
      throw error
    }
  }

  // Manual assign lead
  const handleManualAssign = (leadId: string) => {
    const lead = pendingLeads.find(l => l.id === leadId)
    if (lead) {
      setSelectedLead(lead)
      setManualAssignDialogOpen(true)
    }
  }

  // Perform manual assignment
  const performManualAssignment = async (leadId: string, bdeId: string, reason: string) => {
    try {
      const response = await fetch('/api/bdm/team-management/assignment/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual_assign',
          leadId,
          bdeId,
          reason,
        }),
      })

      if (!response.ok) throw new Error('Manual assignment failed')

      const result = await response.json()

      toast({
        title: 'Lead assigned',
        description: result.message,
      })

      // Refresh data
      fetchData(true)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  // Bulk select
  const handleBulkSelect = (selectedIds: string[]) => {
    setSelectedLeads(selectedIds)
    if (selectedIds.length > 0) {
      setBulkAssignDialogOpen(true)
    }
  }

  // Perform bulk assignment
  const performBulkAssignment = async (leadIds: string[], reason: string) => {
    try {
      const response = await fetch('/api/bdm/team-management/assignment/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds,
          reason,
        }),
      })

      if (!response.ok) throw new Error('Bulk assignment failed')

      const result = await response.json()

      toast({
        title: 'Bulk assignment complete',
        description: `Assigned ${result.assignedCount} leads`,
      })

      setSelectedLeads([])
      fetchData(true)
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading assignment control...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Assignment Control</h2>
          <p className="text-sm text-muted-foreground">
            Manage lead distribution and team workload
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Assignment Controls */}
      <AssignmentControls
        onAutoAssign={handleAutoAssign}
        onPauseBDE={(bdeId) => console.log('Pause BDE:', bdeId)}
        onResumeBDE={(bdeId) => console.log('Resume BDE:', bdeId)}
        engineStatus={engineStatus}
      />

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Queue ({pendingLeads.length})
          </TabsTrigger>
          <TabsTrigger value="workload">
            Team Workload
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            Recommendations ({recommendations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingLeadsQueue
            leads={pendingLeads}
            onManualAssign={handleManualAssign}
            onBulkSelect={handleBulkSelect}
          />
        </TabsContent>

        <TabsContent value="workload">
          {workloadSummary && (
            <WorkloadDistribution
              teamWorkload={teamWorkload}
              summary={workloadSummary}
            />
          )}
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsPanel
            recommendations={recommendations}
            onActionClick={(rec) => console.log('Action:', rec)}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {selectedLead && (
        <ManualAssignmentDialog
          open={manualAssignDialogOpen}
          onOpenChange={setManualAssignDialogOpen}
          leadId={selectedLead.id}
          leadName={selectedLead.customer_name}
          suggestedBDEs={selectedLead.suggestedBDEs}
          onAssign={performManualAssignment}
        />
      )}

      <BulkReassignmentDialog
        open={bulkAssignDialogOpen}
        onOpenChange={setBulkAssignDialogOpen}
        selectedLeadIds={selectedLeads}
        leadCount={selectedLeads.length}
        onReassign={performBulkAssignment}
      />
    </div>
  )
}
