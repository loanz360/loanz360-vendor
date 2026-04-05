'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertCircle } from 'lucide-react'

interface BulkReassignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedLeadIds: string[]
  leadCount: number
  onReassign: (leadIds: string[], reason: string) => Promise<void>
}

export default function BulkReassignmentDialog({
  open,
  onOpenChange,
  selectedLeadIds,
  leadCount,
  onReassign,
}: BulkReassignmentDialogProps) {
  const [reason, setReason] = useState('')
  const [reassigning, setReassigning] = useState(false)

  const handleReassign = async () => {
    if (!reason.trim()) return

    setReassigning(true)
    try {
      await onReassign(selectedLeadIds, reason)
      onOpenChange(false)
      setReason('')
    } catch (error) {
      console.error('Bulk reassignment failed:', error)
    } finally {
      setReassigning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Lead Assignment</DialogTitle>
          <DialogDescription>
            Automatically assign {leadCount} selected lead{leadCount > 1 ? 's' : ''} using round-robin algorithm
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-900">Bulk Assignment</p>
              <p className="text-yellow-700 mt-1">
                Selected leads will be automatically assigned to available BDEs based on:
              </p>
              <ul className="list-disc list-inside mt-2 text-yellow-700 space-y-1">
                <li>Loan type match</li>
                <li>Geographic coverage (pincode)</li>
                <li>Current workload capacity</li>
                <li>Round-robin fairness</li>
              </ul>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Leads Selected</p>
              <p className="text-2xl font-bold">{leadCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Assignment Type</p>
              <Badge>Auto Round-Robin</Badge>
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="bulk-reason" className="font-semibold mb-2 block">
              Reason for Bulk Assignment <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="bulk-reason"
              placeholder="e.g., End of day bulk processing, Rebalancing workload, New campaign leads..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This reason will be logged for all {leadCount} assignment{leadCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reassigning}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={!reason.trim() || reassigning}>
            {reassigning ? `Assigning ${leadCount} leads...` : `Assign ${leadCount} Lead${leadCount > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
