'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Folder,
  User,
  Mail,
  Calendar,
  ExternalLink,
  Globe,
  Users,
  Lock,
  MessageSquare,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ShareRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'

interface ShareRequest {
  id: string
  file_id?: string
  folder_id?: string
  share_type: 'public' | 'internal' | 'external'
  shared_with_emails?: string[]
  requested_by: string
  requested_by_name?: string
  reason?: string
  expires_at?: string
  status: ShareRequestStatus
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created_at: string
  file_name?: string
  folder_name?: string
}

interface StatusCounts {
  pending: number
  approved: number
  rejected: number
  expired: number
}

export function ShareApprovalManager() {
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<ShareRequest[]>([])
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('pending')
  const [selectedRequest, setSelectedRequest] = useState<ShareRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateString)
  }

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const params = new URLSearchParams()
      if (selectedStatus && selectedStatus !== 'all') {
        params.set('status', selectedStatus)
      }
      params.set('all', 'true')

      const response = await fetch(`/api/workdrive/shares/approval?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch requests')

      const data = await response.json()
      setRequests(data.requests || [])
      setStatusCounts(data.statusCounts || { pending: 0, approved: 0, rejected: 0, expired: 0 })
      setIsAdmin(data.isAdmin || false)
    } catch (err) {
      console.error('Error fetching requests:', err)
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [supabase, selectedStatus])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!selectedRequest) return

    setProcessing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch('/api/workdrive/shares/approval', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          action,
          reviewNotes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action} request`)
      }

      setSelectedRequest(null)
      setReviewNotes('')
      await fetchRequests()
    } catch (err) {
      console.error(`Error ${action}ing request:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${action} request`)
    } finally {
      setProcessing(false)
    }
  }

  const getShareTypeIcon = (shareType: string) => {
    switch (shareType) {
      case 'public':
        return <Globe className="h-4 w-4 text-orange-500" />
      case 'external':
        return <ExternalLink className="h-4 w-4 text-yellow-500" />
      case 'internal':
        return <Users className="h-4 w-4 text-blue-500" />
      default:
        return <Lock className="h-4 w-4" />
    }
  }

  const getShareTypeBadge = (shareType: string) => {
    const colors: Record<string, string> = {
      public: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      external: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      internal: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    }

    return (
      <Badge className={colors[shareType] || ''}>
        {getShareTypeIcon(shareType)}
        <span className="ml-1 capitalize">{shareType}</span>
      </Badge>
    )
  }

  const getStatusBadge = (status: ShareRequestStatus) => {
    const config: Record<ShareRequestStatus, { icon: React.ReactNode; className: string }> = {
      pending: {
        icon: <Clock className="h-3 w-3" />,
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      },
      approved: {
        icon: <CheckCircle className="h-3 w-3" />,
        className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      },
      rejected: {
        icon: <XCircle className="h-3 w-3" />,
        className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      },
      expired: {
        icon: <AlertTriangle className="h-3 w-3" />,
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      },
    }

    const { icon, className } = config[status]

    return (
      <Badge className={className}>
        {icon}
        <span className="ml-1 capitalize">{status}</span>
      </Badge>
    )
  }

  const renderRequestCard = (request: ShareRequest) => (
    <Card
      key={request.id}
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
        request.status === 'pending' ? 'border-yellow-500/50' : ''
      }`}
      onClick={() => {
        setSelectedRequest(request)
        setReviewNotes('')
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
              {request.file_id ? (
                <FileText className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Folder className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">
                {request.file_name || request.folder_name || 'Unknown Resource'}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <User className="h-3 w-3" />
                <span>{request.requested_by_name}</span>
                <span className="mx-1">·</span>
                <span>{getRelativeTime(request.created_at)}</span>
              </div>
              {request.shared_with_emails && request.shared_with_emails.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Mail className="h-3 w-3" />
                  <span>{request.shared_with_emails.slice(0, 2).join(', ')}</span>
                  {request.shared_with_emails.length > 2 && (
                    <span>+{request.shared_with_emails.length - 2} more</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getShareTypeBadge(request.share_type)}
            {getStatusBadge(request.status)}
          </div>
        </div>
        {request.reason && (
          <div className="mt-3 p-2 bg-muted rounded text-sm">
            <MessageSquare className="h-3 w-3 inline mr-1" />
            {request.reason}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            Share Approval Manager
          </h2>
          <p className="text-muted-foreground">
            Review and manage share requests for sensitive files
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${
            selectedStatus === 'pending' ? 'ring-2 ring-yellow-500' : ''
          }`}
          onClick={() => setSelectedStatus('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            selectedStatus === 'approved' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() => setSelectedStatus('approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{statusCounts.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            selectedStatus === 'rejected' ? 'ring-2 ring-red-500' : ''
          }`}
          onClick={() => setSelectedStatus('rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{statusCounts.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            selectedStatus === 'all' ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => setSelectedStatus('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {statusCounts.pending + statusCounts.approved + statusCounts.rejected + statusCounts.expired}
                </p>
              </div>
              <Filter className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedStatus === 'all' ? 'All Requests' : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Requests`}
          </CardTitle>
          <CardDescription>
            {requests.length} request{requests.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Shield className="h-12 w-12 mb-2 opacity-50" />
              <p>No {selectedStatus !== 'all' ? selectedStatus : ''} requests</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {requests.map(renderRequestCard)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Request Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRequest?.file_id ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Folder className="h-5 w-5" />
              )}
              Share Request Details
            </DialogTitle>
            <DialogDescription>
              Review and take action on this share request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Resource Info */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {selectedRequest.file_name || selectedRequest.folder_name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRequest.file_id ? 'File' : 'Folder'}
                </p>
              </div>

              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Share Type</p>
                  <div className="mt-1">{getShareTypeBadge(selectedRequest.share_type)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested By</p>
                  <p className="font-medium">{selectedRequest.requested_by_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested</p>
                  <p className="font-medium">{formatDate(selectedRequest.created_at)}</p>
                </div>
              </div>

              {/* Recipients */}
              {selectedRequest.shared_with_emails && selectedRequest.shared_with_emails.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Share Recipients</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRequest.shared_with_emails.map((email) => (
                      <Badge key={email} variant="outline">
                        <Mail className="h-3 w-3 mr-1" />
                        {email}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Reason */}
              {selectedRequest.reason && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reason for Request</p>
                  <p className="text-sm p-2 bg-muted rounded">{selectedRequest.reason}</p>
                </div>
              )}

              {/* Expiry */}
              {selectedRequest.expires_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Expires: {formatDate(selectedRequest.expires_at)}</span>
                </div>
              )}

              {/* Review Notes (for pending requests) */}
              {selectedRequest.status === 'pending' && isAdmin && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Review Notes (Optional)</p>
                  <Textarea
                    placeholder="Add notes about your decision..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Previous Review Info */}
              {selectedRequest.review_notes && selectedRequest.status !== 'pending' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Review Notes</p>
                  <p className="text-sm p-2 bg-muted rounded">{selectedRequest.review_notes}</p>
                  {selectedRequest.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed on {formatDate(selectedRequest.reviewed_at)}
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedRequest?.status === 'pending' && isAdmin ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleAction('reject')}
                  disabled={processing}
                  className="text-red-600 hover:text-red-700"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleAction('approve')}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ShareApprovalManager
