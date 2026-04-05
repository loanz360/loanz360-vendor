'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  User,
  MessageSquare,
  AlertCircle,
  Filter,
  Search,
  FileText
} from 'lucide-react'

interface LeaveApproval {
  id: string
  user_id: string
  leave_type_id: string
  from_date: string
  to_date: string
  total_days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  applied_at: string
  documents: string[] | null
  leave_types: {
    id: string
    name: string
    color: string
    max_days_per_request: number
  }
  users: {
    id: string
    full_name: string
    email: string
    sub_role: string
    department: string
  }
}

interface Summary {
  pending: number
  approved: number
  rejected: number
  total: number
}

export default function LeaveApprovalsView() {
  const { user } = useAuth()
  const [approvals, setApprovals] = useState<LeaveApproval[]>([])
  const [filteredApprovals, setFilteredApprovals] = useState<LeaveApproval[]>([])
  const [summary, setSummary] = useState<Summary>({ pending: 0, approved: 0, rejected: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<LeaveApproval | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)
  const [comments, setComments] = useState('')

  // Fetch approvals
  useEffect(() => {
    fetchApprovals()
  }, [statusFilter])

  useEffect(() => {
    applyFilters()
  }, [approvals, searchTerm, statusFilter, dateFrom, dateTo])

  const fetchApprovals = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      params.append('view', 'my_approvals')

      const response = await fetch(`/api/employees/leaves/approvals?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch approvals')
      }

      setApprovals(data.data || [])
      setSummary(data.summary || { pending: 0, approved: 0, rejected: 0, total: 0 })
    } catch (err: unknown) {
      console.error('Error fetching approvals:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = approvals

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        approval =>
          approval.users.full_name.toLowerCase().includes(term) ||
          approval.users.email.toLowerCase().includes(term) ||
          approval.leave_types.name.toLowerCase().includes(term)
      )
    }

    // Apply date range filter
    if (dateFrom) {
      filtered = filtered.filter(a => a.from_date >= dateFrom)
    }
    if (dateTo) {
      filtered = filtered.filter(a => a.to_date <= dateTo)
    }

    setFilteredApprovals(filtered)
  }

  const handleApprovalClick = (approval: LeaveApproval, action: 'approve' | 'reject') => {
    setSelectedRequest(approval)
    setApprovalAction(action)
    setComments('')
    setShowApprovalModal(true)
  }

  const handleApprovalSubmit = async () => {
    if (!selectedRequest || !approvalAction) return

    setIsProcessing(selectedRequest.id)
    setError(null)

    try {
      const response = await fetch('/api/employees/leaves/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action: approvalAction,
          comments: comments || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${approvalAction} leave request`)
      }

      // Success - refresh list
      await fetchApprovals()
      setShowApprovalModal(false)
      setSelectedRequest(null)
      setApprovalAction(null)
      setComments('')
    } catch (err: unknown) {
      console.error(`Error ${approvalAction}ing leave:`, err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsProcessing(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'approved':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'rejected':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400/60 text-sm">Pending</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{summary.pending}</p>
            </div>
            <Clock className="w-10 h-10 text-yellow-400/40" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400/60 text-sm">Approved</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{summary.approved}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-400/40" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400/60 text-sm">Rejected</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{summary.rejected}</p>
            </div>
            <XCircle className="w-10 h-10 text-red-400/40" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-400/60 text-sm">Total</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{summary.total}</p>
            </div>
            <FileText className="w-10 h-10 text-orange-400/40" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-black/40 border border-orange-500/20 rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by employee name, email, or leave type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-orange-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="px-3 py-2.5 bg-black/40 border border-orange-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
            <span className="text-white/40 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="px-3 py-2.5 bg-black/40 border border-orange-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2.5 bg-black/40 border border-orange-500/30 rounded-lg text-white focus:outline-none focus:border-orange-500"
          >
            <option value="pending">Pending Only</option>
            <option value="all">All Requests</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="bg-black/40 border border-orange-500/30 rounded-lg p-8 text-center">
          <Clock className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60">No leave requests to review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => (
            <div
              key={approval.id}
              className="bg-black/40 border border-orange-500/30 rounded-lg p-6 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Employee Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <User className="w-5 h-5 text-orange-400" />
                    <div>
                      <h3 className="text-white font-medium">{approval.users.full_name}</h3>
                      <p className="text-white/60 text-sm">{approval.users.email}</p>
                      <p className="text-orange-400 text-xs mt-0.5">
                        {approval.users.sub_role?.replace(/_/g, ' ').toUpperCase()} - {approval.users.department}
                      </p>
                    </div>
                  </div>

                  {/* Leave Details */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-white/40 text-xs mb-1">Leave Type</p>
                      <span
                        className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${approval.leave_types.color}20`,
                          color: approval.leave_types.color,
                          border: `1px solid ${approval.leave_types.color}40`
                        }}
                      >
                        {approval.leave_types.name}
                      </span>
                    </div>

                    <div>
                      <p className="text-white/40 text-xs mb-1">Duration</p>
                      <p className="text-white font-medium">
                        {formatDate(approval.from_date)} - {formatDate(approval.to_date)}
                      </p>
                      <p className="text-orange-400 text-sm">{approval.total_days} {approval.total_days === 1 ? 'day' : 'days'}</p>
                    </div>

                    <div>
                      <p className="text-white/40 text-xs mb-1">Applied On</p>
                      <p className="text-white text-sm">{formatDate(approval.applied_at)}</p>
                    </div>

                    <div>
                      <p className="text-white/40 text-xs mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(approval.status)}`}>
                        {approval.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mt-4">
                    <p className="text-white/40 text-xs mb-1">Reason</p>
                    <p className="text-white/80 text-sm">{approval.reason}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                {approval.status === 'pending' && (
                  <div className="flex lg:flex-col gap-3 lg:ml-6">
                    <button
                      onClick={() => handleApprovalClick(approval, 'approve')}
                      disabled={isProcessing === approval.id}
                      className="flex-1 lg:flex-none px-6 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-400 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprovalClick(approval, 'reject')}
                      disabled={isProcessing === approval.id}
                      className="flex-1 lg:flex-none px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-5 h-5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-orange-500/30 rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </h3>

            <div className="mb-4 p-4 bg-black/40 border border-orange-500/20 rounded-lg space-y-3">
              <div>
                <p className="text-white/60 text-sm mb-1">Employee</p>
                <p className="text-white font-medium">{selectedRequest.users.full_name}</p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Leave Type</p>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${selectedRequest.leave_types.color}20`,
                    color: selectedRequest.leave_types.color,
                    border: `1px solid ${selectedRequest.leave_types.color}40`
                  }}
                >
                  {selectedRequest.leave_types.name}
                </span>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Leave Period</p>
                <p className="text-white">
                  {formatDate(selectedRequest.from_date)} - {formatDate(selectedRequest.to_date)}
                  <span className="text-orange-400 ml-2">({selectedRequest.total_days} days)</span>
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-1">Reason</p>
                <p className="text-white/80 text-sm">{selectedRequest.reason}</p>
              </div>
              {/* Attachments */}
              {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                <div>
                  <p className="text-white/60 text-sm mb-2">Attachments</p>
                  <div className="space-y-2">
                    {selectedRequest.documents.map((doc, index) => {
                      const fileName = doc.split('/').pop() || `Document ${index + 1}`
                      return (
                        <a
                          key={index}
                          href={doc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg hover:border-orange-500/40 transition-colors"
                        >
                          <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="text-sm text-orange-300 truncate">{fileName}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-white/80 text-sm mb-2">
                Comments {approvalAction === 'reject' && <span className="text-red-400">(Required)</span>}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={approvalAction === 'approve' ? 'Add optional comments...' : 'Please provide a reason for rejection...'}
                className="w-full px-4 py-3 bg-black/40 border border-orange-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500 min-h-[100px]"
                maxLength={500}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                disabled={isProcessing !== null}
                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprovalSubmit}
                disabled={isProcessing !== null || (approvalAction === 'reject' && !comments.trim())}
                className={`flex-1 px-6 py-3 border rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  approvalAction === 'approve'
                    ? 'bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400'
                    : 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400'
                }`}
              >
                {isProcessing ? 'Processing...' : approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
