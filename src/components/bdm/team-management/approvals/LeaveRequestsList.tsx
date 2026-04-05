'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Clock, FileText, Check, X } from 'lucide-react'

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

interface LeaveRequestsListProps {
  requests: LeaveRequest[]
  onApprove: (id: string, remarks?: string) => void
  onReject: (id: string, remarks?: string) => void
}

export default function LeaveRequestsList({ requests, onApprove, onReject }: LeaveRequestsListProps) {
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null)
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [remarks, setRemarks] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const formatLeaveType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
      case 'approved':
        return <Badge variant="default" className="bg-green-600">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const handleActionClick = (request: LeaveRequest, actionType: 'approve' | 'reject') => {
    setSelectedRequest(request)
    setAction(actionType)
    setRemarks('')
    setDialogOpen(true)
  }

  const handleConfirmAction = () => {
    if (!selectedRequest || !action) return

    if (action === 'approve') {
      onApprove(selectedRequest.id, remarks)
    } else {
      onReject(selectedRequest.id, remarks)
    }

    setDialogOpen(false)
    setSelectedRequest(null)
    setAction(null)
    setRemarks('')
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const processedRequests = requests.filter(r => r.status !== 'pending')

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pending Approval ({pendingRequests.length})</h3>
          <div className="space-y-4">
            {pendingRequests.map(request => (
              <Card key={request.id} className="border-l-4 border-l-yellow-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(request.bdeName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{request.bdeName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatLeaveType(request.leaveType)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Leave Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-medium">{formatDate(request.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">To:</span>
                      <span className="font-medium">{formatDate(request.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{request.days} day{request.days > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Applied: {formatDate(request.submittedAt)}</span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      Reason
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                      {request.reason}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleActionClick(request, 'approve')}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleActionClick(request, 'reject')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Processed Requests ({processedRequests.length})</h3>
          <div className="space-y-3">
            {processedRequests.map(request => (
              <Card key={request.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(request.bdeName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{request.bdeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.days} days)
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center space-y-2">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No leave requests</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {action === 'approve' ? 'Approving' : 'Rejecting'} leave request from{' '}
                  <strong>{selectedRequest.bdeName}</strong> for {selectedRequest.days} day
                  {selectedRequest.days > 1 ? 's' : ''}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">
                Remarks {action === 'reject' && '(Required)'}
              </label>
              <Textarea
                placeholder={
                  action === 'approve'
                    ? 'Add optional remarks...'
                    : 'Please provide reason for rejection...'
                }
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={action === 'approve' ? 'default' : 'destructive'}
              onClick={handleConfirmAction}
              disabled={action === 'reject' && !remarks.trim()}
            >
              {action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
