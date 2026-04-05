'use client'

import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, TrendingUp } from 'lucide-react'

interface SuggestedBDE {
  id: string
  name: string
  email: string
  currentWorkload: number
  maxCapacity: number
  utilizationPercentage: number
}

interface ManualAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  leadName: string
  suggestedBDEs: SuggestedBDE[]
  onAssign: (leadId: string, bdeId: string, reason: string) => Promise<void>
}

export default function ManualAssignmentDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  suggestedBDEs,
  onAssign,
}: ManualAssignmentDialogProps) {
  const [selectedBDE, setSelectedBDE] = useState<string>('')
  const [reason, setReason] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (open && suggestedBDEs.length > 0) {
      // Auto-select first suggested BDE
      setSelectedBDE(suggestedBDEs[0].id)
    }
  }, [open, suggestedBDEs])

  const handleAssign = async () => {
    if (!selectedBDE || !reason.trim()) return

    setAssigning(true)
    try {
      await onAssign(leadId, selectedBDE, reason)
      onOpenChange(false)
      setSelectedBDE('')
      setReason('')
    } catch (error) {
      console.error('Assignment failed:', error)
    } finally {
      setAssigning(false)
    }
  }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manual Lead Assignment</DialogTitle>
          <DialogDescription>
            Assign lead <strong>{leadName}</strong> to a Business Development Executive
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* BDE Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">Select BDE</Label>
            {suggestedBDEs.length > 0 ? (
              <RadioGroup value={selectedBDE} onValueChange={setSelectedBDE}>
                <div className="space-y-3">
                  {suggestedBDEs.map(bde => (
                    <div
                      key={bde.id}
                      className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedBDE === bde.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedBDE(bde.id)}
                    >
                      <RadioGroupItem value={bde.id} id={bde.id} />
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials(bde.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{bde.name}</p>
                            <p className="text-xs text-muted-foreground">{bde.email}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <TrendingUp className={`h-4 w-4 ${getWorkloadColor(bde.utilizationPercentage)}`} />
                              <span className={`font-semibold ${getWorkloadColor(bde.utilizationPercentage)}`}>
                                {bde.utilizationPercentage}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {bde.currentWorkload}/{bde.maxCapacity} leads
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted rounded-lg">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No matching BDEs available</p>
                <p className="text-sm mt-1">Check loan type and pincode coverage</p>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason" className="text-base font-semibold mb-2 block">
              Reason for Manual Assignment <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., VIP customer requiring senior BDE, Geographic proximity, Previous relationship..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This will be logged in the audit trail for transparency
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedBDE || !reason.trim() || assigning}
          >
            {assigning ? 'Assigning...' : 'Assign Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
