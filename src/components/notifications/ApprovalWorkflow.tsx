'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  MessageSquare,
  Send,
  Loader2,
  Eye,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested'

interface ApprovalStep {
  id: string
  order: number
  approver_role: string
  approver_id?: string
  approver_name?: string
  status: ApprovalStatus
  comments?: string
  approved_at?: string
  rejected_at?: string
}

interface NotificationDraft {
  id: string
  title: string
  message: string
  notification_type: string
  priority: string
  target_type: string
  target_category: string
  target_subrole?: string
  send_email: boolean
  send_sms: boolean
  send_in_app: boolean
  send_push: boolean
  scheduled_for?: string
  created_by_id: string
  created_by_name: string
  created_at: string
  updated_at: string
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent'
  approval_steps: ApprovalStep[]
  current_step: number
  estimated_recipients: number
}

interface ApprovalWorkflowProps {
  draftId?: string
  onApproved?: (draft: NotificationDraft) => void
  onRejected?: (draft: NotificationDraft) => void
  viewMode?: 'admin' | 'approver' | 'creator'
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_STYLES: Record<ApprovalStatus | string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: <Clock className="w-4 h-4" /> },
  approved: { bg: 'bg-green-500/10', text: 'text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
  revision_requested: { bg: 'bg-orange-500/10', text: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4" /> },
  draft: { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: <Edit className="w-4 h-4" /> },
  pending_approval: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: <Clock className="w-4 h-4" /> },
  sent: { bg: 'bg-green-500/10', text: 'text-green-400', icon: <Send className="w-4 h-4" /> }
}

const APPROVAL_ROLES = [
  { value: 'TEAM_LEAD', label: 'Team Lead', level: 1 },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head', level: 2 },
  { value: 'HR_MANAGER', label: 'HR Manager', level: 2 },
  { value: 'COMPLIANCE_OFFICER', label: 'Compliance Officer', level: 3 },
  { value: 'SUPER_ADMIN', label: 'Super Admin', level: 4 }
]

// ============================================================================
// COMPONENT
// ============================================================================

export default function ApprovalWorkflow({
  draftId,
  onApproved,
  onRejected,
  viewMode = 'admin'
}: ApprovalWorkflowProps) {
  const [drafts, setDrafts] = useState<NotificationDraft[]>([])
  const [selectedDraft, setSelectedDraft] = useState<NotificationDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetchDrafts()
  }, [filter])

  useEffect(() => {
    if (draftId) {
      fetchDraft(draftId)
    }
  }, [draftId])

  const fetchDrafts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ status: filter })
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/notifications/drafts?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch drafts')
      }

      setDrafts(data.drafts || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDraft = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/drafts/${id}`)
      const data = await response.json()

      if (response.ok) {
        setSelectedDraft(data.draft)
      }
    } catch (err) {
      console.error('Error fetching draft:', err)
    }
  }

  const handleApprove = async () => {
    if (!selectedDraft) return

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/notifications/drafts/${selectedDraft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve')
      }

      setSelectedDraft(data.draft)
      onApproved?.(data.draft)
      setComments('')
      fetchDrafts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedDraft || !comments.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/notifications/drafts/${selectedDraft.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject')
      }

      setSelectedDraft(data.draft)
      onRejected?.(data.draft)
      setComments('')
      fetchDrafts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestRevision = async () => {
    if (!selectedDraft || !comments.trim()) {
      setError('Please provide revision instructions')
      return
    }

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/notifications/drafts/${selectedDraft.id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request revision')
      }

      setSelectedDraft(data.draft)
      setComments('')
      fetchDrafts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendNotification = async () => {
    if (!selectedDraft || selectedDraft.status !== 'approved') return

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: selectedDraft.id,
          ...selectedDraft
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notification')
      }

      setSelectedDraft({ ...selectedDraft, status: 'sent' })
      fetchDrafts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusStyle = (status: string) => {
    return STATUS_STYLES[status] || STATUS_STYLES.draft
  }

  const canApprove = (draft: NotificationDraft) => {
    if (viewMode === 'creator') return false
    if (draft.status !== 'pending_approval') return false

    const currentStep = draft.approval_steps[draft.current_step]
    if (!currentStep || currentStep.status !== 'pending') return false

    // In real implementation, check if current user is the approver
    return true
  }

  const getNotificationTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      announcement: '📢', alert: '⚠️', update: '🔄',
      reminder: '⏰', celebration: '🎉', promotion: '🎁',
      policy: '📋', training: '📚', survey: '📊', custom: '📝'
    }
    return icons[type] || '📬'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-white">Approval Workflow</h2>
            <p className="text-gray-400 text-sm">Review and approve notification requests</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-sm transition-colors capitalize ${
                  filter === f
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={fetchDrafts}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search drafts..."
          className="w-full bg-white/5 text-white pl-10 pr-4 py-2 rounded-lg border border-white/10 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drafts List */}
        <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No drafts found</p>
            </div>
          ) : (
            drafts.map(draft => {
              const style = getStatusStyle(draft.status)
              return (
                <button
                  key={draft.id}
                  onClick={() => setSelectedDraft(draft)}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    selectedDraft?.id === draft.id
                      ? 'bg-orange-500/10 border-orange-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getNotificationTypeIcon(draft.notification_type)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${style.bg} ${style.text} flex items-center gap-1`}>
                        {style.icon}
                        {draft.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(draft.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-white font-medium truncate">{draft.title}</h4>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{draft.message}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-gray-500 text-xs">by {draft.created_by_name}</span>
                    <span className="text-gray-500 text-xs">
                      {draft.estimated_recipients.toLocaleString()} recipients
                    </span>
                  </div>

                  {/* Approval Progress */}
                  <div className="mt-3 flex items-center gap-1">
                    {draft.approval_steps.map((step, i) => {
                      const stepStyle = getStatusStyle(step.status)
                      return (
                        <div
                          key={step.id}
                          className={`flex-1 h-1.5 rounded-full ${
                            step.status === 'approved' ? 'bg-green-500' :
                            step.status === 'rejected' ? 'bg-red-500' :
                            step.status === 'pending' && i === draft.current_step ? 'bg-yellow-500' :
                            'bg-gray-600'
                          }`}
                        />
                      )
                    })}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Draft Details */}
        <div className="lg:col-span-2">
          {selectedDraft ? (
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">{getNotificationTypeIcon(selectedDraft.notification_type)}</span>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusStyle(selectedDraft.status).bg} ${getStatusStyle(selectedDraft.status).text} flex items-center gap-2`}>
                        {getStatusStyle(selectedDraft.status).icon}
                        {selectedDraft.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white">{selectedDraft.title}</h3>
                    <p className="text-gray-400 mt-2">{selectedDraft.message}</p>
                  </div>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div>
                    <p className="text-gray-500 text-xs">Created By</p>
                    <p className="text-white text-sm">{selectedDraft.created_by_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Target</p>
                    <p className="text-white text-sm capitalize">
                      {selectedDraft.target_type === 'all' ? 'All Users' : selectedDraft.target_category}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Recipients</p>
                    <p className="text-white text-sm">{selectedDraft.estimated_recipients.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Channels</p>
                    <p className="text-white text-sm">
                      {[
                        selectedDraft.send_in_app && 'In-App',
                        selectedDraft.send_email && 'Email',
                        selectedDraft.send_sms && 'SMS',
                        selectedDraft.send_push && 'Push'
                      ].filter(Boolean).join(', ') || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Approval Steps */}
              <div className="p-6 border-b border-white/10">
                <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Approval Chain
                </h4>

                <div className="space-y-4">
                  {selectedDraft.approval_steps.map((step, index) => {
                    const stepStyle = getStatusStyle(step.status)
                    const isCurrentStep = index === selectedDraft.current_step

                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border ${
                          isCurrentStep && step.status === 'pending'
                            ? 'bg-yellow-500/5 border-yellow-500/30'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stepStyle.bg}`}>
                          <span className={stepStyle.text}>{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-white font-medium">{step.approver_role.replace(/_/g, ' ')}</p>
                              {step.approver_name && (
                                <p className="text-gray-400 text-sm">{step.approver_name}</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${stepStyle.bg} ${stepStyle.text} flex items-center gap-1`}>
                              {stepStyle.icon}
                              {step.status}
                            </span>
                          </div>
                          {step.comments && (
                            <p className="text-gray-300 text-sm mt-2 bg-black/30 p-2 rounded">
                              "{step.comments}"
                            </p>
                          )}
                          {(step.approved_at || step.rejected_at) && (
                            <p className="text-gray-500 text-xs mt-2">
                              {step.approved_at
                                ? `Approved on ${new Date(step.approved_at).toLocaleString()}`
                                : `Rejected on ${new Date(step.rejected_at!).toLocaleString()}`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Section */}
              {canApprove(selectedDraft) && (
                <div className="p-6">
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-2">
                      Comments {selectedDraft.status === 'pending_approval' ? '(required for rejection)' : ''}
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add comments or feedback..."
                      rows={3}
                      className="w-full bg-black/50 text-white px-4 py-2 rounded-lg border border-white/10 focus:border-blue-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={handleRequestRevision}
                      disabled={actionLoading || !comments.trim()}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Request Revision
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !comments.trim()}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              )}

              {/* Send Button (for approved drafts) */}
              {selectedDraft.status === 'approved' && viewMode === 'admin' && (
                <div className="p-6 bg-green-500/5 border-t border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 font-medium">Ready to Send</p>
                      <p className="text-gray-400 text-sm">This notification has been fully approved</p>
                    </div>
                    <button
                      onClick={handleSendNotification}
                      disabled={actionLoading}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send Notification
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-12 text-center h-full flex items-center justify-center">
              <div>
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a draft to review</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedDraft && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Notification Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{getNotificationTypeIcon(selectedDraft.notification_type)}</span>
                <div>
                  <h4 className="text-white font-bold text-lg">{selectedDraft.title}</h4>
                  <p className="text-gray-300 mt-2">{selectedDraft.message}</p>
                  <p className="text-gray-500 text-xs mt-4">
                    Will be sent to {selectedDraft.estimated_recipients.toLocaleString()} recipients
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
