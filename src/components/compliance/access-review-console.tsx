'use client'

import { toast } from 'sonner'

/**
 * Access Review Console Component
 * Review checklist, attestation, bulk approve/revoke
 */

import { useState, useEffect } from 'react'
import type { AccessReview } from '@/lib/compliance/compliance-types'
import { getReviewStatusColor } from '@/lib/compliance/compliance-service'

interface AdminReviewItem {
  admin_id: string
  admin_email: string
  admin_role: string
  current_permissions: string[]
  last_login: string
  is_reviewed: boolean
  decision: 'approved' | 'revoked' | 'modified' | null
  notes: string
}

export default function AccessReviewConsole() {
  const [reviews, setReviews] = useState<AccessReview[]>([])
  const [selectedReview, setSelectedReview] = useState<AccessReview | null>(null)
  const [adminReviews, setAdminReviews] = useState<AdminReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/compliance/access-reviews')
      const data = await response.json()

      if (data.success) {
        setReviews(data.reviews)
      }
    } catch (error) {
      console.error('Failed to fetch access reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  const initiateNewReview = async () => {
    try {
      const response = await fetch('/api/compliance/access-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewType: 'quarterly_certification',
          reviewerId: 'current-admin-id', // TODO: Get from session
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Access review initiated successfully!')
        fetchReviews()
      }
    } catch (error) {
      console.error('Failed to initiate review:', error)
    }
  }

  const loadReviewDetails = (review: AccessReview) => {
    setSelectedReview(review)
    // In a real implementation, fetch admin details from database
    // For now, create mock data based on admin_ids
    const mockAdmins: AdminReviewItem[] = review.admin_ids.map((id, idx) => ({
      admin_id: id,
      admin_email: `admin${idx + 1}@loanz360.com`,
      admin_role: idx % 3 === 0 ? 'Super Admin' : idx % 3 === 1 ? 'Admin' : 'CRO',
      current_permissions: ['leads:read', 'leads:write', 'analytics:read'],
      last_login: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_reviewed: false,
      decision: null,
      notes: '',
    }))
    setAdminReviews(mockAdmins)
  }

  const updateAdminDecision = (adminId: string, decision: 'approved' | 'revoked' | 'modified', notes?: string) => {
    setAdminReviews(adminReviews.map(admin =>
      admin.admin_id === adminId
        ? { ...admin, is_reviewed: true, decision, notes: notes || admin.notes }
        : admin
    ))
  }

  const bulkApprove = () => {
    setAdminReviews(adminReviews.map(admin =>
      !admin.is_reviewed
        ? { ...admin, is_reviewed: true, decision: 'approved' as const, notes: 'Bulk approved - no changes required' }
        : admin
    ))
  }

  const completeReview = async () => {
    if (!selectedReview) return

    const unreviewedCount = adminReviews.filter(a => !a.is_reviewed).length
    if (unreviewedCount > 0) {
      if (!confirm(`${unreviewedCount} admins not reviewed. Continue anyway?`)) {
        return
      }
    }

    try {
      setCompleting(true)

      // Build findings
      const findings = adminReviews
        .filter(a => a.decision === 'revoked' || a.decision === 'modified')
        .map(a => ({
          admin_id: a.admin_id,
          issue_type: a.decision === 'revoked' ? 'access_revoked' : 'access_modified',
          description: a.notes || `Access ${a.decision} for ${a.admin_email}`,
          action_taken: a.decision,
          severity: a.decision === 'revoked' ? 'high' : 'medium',
        }))

      const response = await fetch('/api/compliance/access-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: selectedReview.id,
          status: 'completed',
          findings,
          completionNotes: `Review completed. ${adminReviews.filter(a => a.decision === 'approved').length} approved, ${adminReviews.filter(a => a.decision === 'revoked').length} revoked, ${adminReviews.filter(a => a.decision === 'modified').length} modified.`,
          signOffBy: 'current-admin-id', // TODO: Get from session
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Review completed successfully!')
        setSelectedReview(null)
        setAdminReviews([])
        fetchReviews()
      }
    } catch (error) {
      console.error('Failed to complete review:', error)
      toast.error('Failed to complete review')
    } finally {
      setCompleting(false)
    }
  }

  const getProgress = () => {
    if (adminReviews.length === 0) return 0
    const reviewed = adminReviews.filter(a => a.is_reviewed).length
    return Math.round((reviewed / adminReviews.length) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Review Console</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quarterly access certification and role attestation
          </p>
        </div>
        <button
          onClick={initiateNewReview}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Review
        </button>
      </div>

      {!selectedReview ? (
        // Reviews List
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Access Reviews</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No access reviews found. Click "New Review" to initiate one.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {reviews.map((review) => (
                <div key={review.id} className="p-6 hover:bg-gray-50 cursor-pointer" onClick={() => loadReviewDetails(review)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getReviewStatusColor(review.status)}`}>
                          {review.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">
                          {review.review_type.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {review.review_period_start} to {review.review_period_end}
                      </h3>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Total Admins:</span> {review.total_admins}
                        </div>
                        <div>
                          <span className="font-medium">Reviewed:</span> {review.reviewed_count}
                        </div>
                        <div>
                          <span className="font-medium">Approved:</span> <span className="text-green-600">{review.approved_count}</span>
                        </div>
                        <div>
                          <span className="font-medium">Revoked:</span> <span className="text-red-600">{review.revoked_count}</span>
                        </div>
                      </div>

                      {review.findings_count > 0 && (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                          {review.findings_count} findings detected
                        </div>
                      )}

                      <div className="mt-2 text-xs text-gray-500">
                        Due: {review.due_date}
                        {review.status === 'overdue' && <span className="text-red-600 font-semibold ml-2">OVERDUE</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        {Math.round((review.reviewed_count / review.total_admins) * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">Complete</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Review Details
        <>
          {/* Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Review Progress</h2>
                <p className="text-sm text-gray-500">
                  {adminReviews.filter(a => a.is_reviewed).length} of {adminReviews.length} admins reviewed
                </p>
              </div>
              <button
                onClick={() => setSelectedReview(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Back to List
              </button>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all"
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <div className="mt-2 text-center text-2xl font-bold text-gray-900">
              {getProgress()}%
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={bulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Bulk Approve All
              </button>
              <button
                onClick={completeReview}
                disabled={completing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
              >
                {completing ? 'Completing...' : 'Complete Review'}
              </button>
            </div>
          </div>

          {/* Admin Checklist */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Admin Checklist</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {adminReviews.map((admin) => (
                <div key={admin.admin_id} className={`p-6 ${admin.is_reviewed ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {admin.is_reviewed && (
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            admin.decision === 'approved' ? 'bg-green-600 text-white' :
                            admin.decision === 'revoked' ? 'bg-red-600 text-white' :
                            'bg-yellow-600 text-white'
                          }`}>
                            {admin.decision?.toUpperCase()}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-gray-600 text-white rounded text-xs font-semibold">
                          {admin.admin_role}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{admin.admin_email}</h3>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Admin ID:</span> {admin.admin_id.substring(0, 8)}...
                        </div>
                        <div>
                          <span className="font-medium">Last Login:</span>{' '}
                          {new Date(admin.last_login).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Permissions:</span> {admin.current_permissions.join(', ')}
                      </div>

                      {admin.notes && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700 mt-2">
                          {admin.notes}
                        </div>
                      )}
                    </div>

                    {!admin.is_reviewed && (
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => updateAdminDecision(admin.admin_id, 'approved', 'Access approved - no changes required')}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Reason for modification:')
                            if (notes) updateAdminDecision(admin.admin_id, 'modified', notes)
                          }}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                        >
                          Modify
                        </button>
                        <button
                          onClick={() => {
                            const notes = prompt('Reason for revoking access:')
                            if (notes) updateAdminDecision(admin.admin_id, 'revoked', notes)
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
