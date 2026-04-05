'use client'

import { toast } from 'sonner'

/**
 * GDPR Compliance Dashboard
 * Central interface for managing all 8 GDPR data subject rights
 */

import { useState, useEffect } from 'react'
import { gdprService, type DataSubjectRequest, type DSARType, type DSARStatus } from '@/lib/compliance/gdpr-service'

const REQUEST_TYPE_LABELS: Record<DSARType, string> = {
  access: 'Right to Access (DSAR)',
  erasure: 'Right to Erasure ("Forgotten")',
  rectification: 'Right to Rectification',
  portability: 'Right to Data Portability',
  restrict: 'Right to Restrict Processing',
  object: 'Right to Object',
  automated: 'Automated Decision-Making',
  breach: 'Data Breach Notification'
}

const STATUS_COLORS: Record<DSARStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  identity_verification: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
}

export default function GDPRDashboard() {
  const [requests, setRequests] = useState<DataSubjectRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{
    status?: DSARStatus
    request_type?: DSARType
    overdue_only?: boolean
  }>({})
  const [showNewRequestForm, setShowNewRequestForm] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    overdue: 0,
    completed_30_days: 0,
    avg_response_time: 0
  })

  useEffect(() => {
    loadRequests()
  }, [filter])

  const loadRequests = async () => {
    setLoading(true)
    const data = await gdprService.getDSARRequests(filter)
    setRequests(data)
    calculateStats(data)
    setLoading(false)
  }

  const calculateStats = (data: DataSubjectRequest[]) => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    setStats({
      total: data.length,
      pending: data.filter(r => r.status === 'pending' || r.status === 'identity_verification' || r.status === 'processing').length,
      overdue: data.filter(r => new Date(r.due_date) < now && r.status !== 'completed').length,
      completed_30_days: data.filter(r => r.status === 'completed' && new Date(r.created_at) >= thirtyDaysAgo).length,
      avg_response_time: 0 // TODO: Calculate from completed requests
    })
  }

  const handleSubmitRequest = async (formData: {
    request_type: DSARType
    requester_email: string
    requester_name: string
  }) => {
    const result = await gdprService.submitDSAR(formData)
    if (result.success) {
      setShowNewRequestForm(false)
      loadRequests()
      toast.success(`Request submitted successfully. Request ID: ${result.request_id}`)
    } else {
      toast.error(`Error: ${result.error}`)
    }
  }

  const getDaysUntilDue = (dueDate: string) => {
    const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">GDPR Compliance Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage all 8 GDPR data subject rights and compliance workflows
          </p>
        </div>
        <button
          onClick={() => setShowNewRequestForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + New DSAR
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 font-medium">Total Requests</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 font-medium">Pending</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 font-medium">Overdue</div>
          <div className="text-3xl font-bold text-red-600 mt-1">{stats.overdue}</div>
          {stats.overdue > 0 && (
            <div className="text-xs text-red-600 mt-1 font-semibold">⚠️ GDPR VIOLATION RISK</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-sm text-gray-600 font-medium">Completed (30d)</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.completed_30_days}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="text-sm text-gray-600 font-medium">Avg Response</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{stats.avg_response_time}d</div>
          <div className="text-xs text-gray-500 mt-1">Target: &lt;30 days</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: (e.target.value as DSARStatus) || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="identity_verification">Identity Verification</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
            <select
              value={filter.request_type || ''}
              onChange={(e) => setFilter({ ...filter, request_type: (e.target.value as DSARType) || undefined })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="access">Right to Access</option>
              <option value="erasure">Right to Erasure</option>
              <option value="rectification">Right to Rectification</option>
              <option value="portability">Right to Portability</option>
              <option value="restrict">Right to Restrict</option>
              <option value="object">Right to Object</option>
              <option value="automated">Automated Decisions</option>
              <option value="breach">Data Breach</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.overdue_only || false}
                onChange={(e) => setFilter({ ...filter, overdue_only: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Show Overdue Only</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilter({})}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium w-full"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Request ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Requester
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Identity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Loading requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No requests found
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const daysUntilDue = getDaysUntilDue(request.due_date)
                const isOverdue = daysUntilDue < 0

                return (
                  <tr key={request.id} className={isOverdue ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {request.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {REQUEST_TYPE_LABELS[request.request_type]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{request.requester_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{request.requester_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[request.status]}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {new Date(request.due_date).toLocaleDateString()}
                      </div>
                      <div className={`text-xs ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `${daysUntilDue} days left`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {request.identity_verified ? (
                        <span className="text-green-600 text-lg">✓</span>
                      ) : (
                        <span className="text-yellow-600 text-lg">⏳</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-blue-600 hover:text-blue-800 font-medium">
                        View Details →
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* New Request Form Modal */}
      {showNewRequestForm && (
        <NewRequestModal
          onClose={() => setShowNewRequestForm(false)}
          onSubmit={handleSubmitRequest}
        />
      )}

      {/* GDPR Info Section */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📋 GDPR Compliance Requirements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <strong>Response Timeline:</strong>
            <p>Must respond to all DSAR within 30 days (extendable to 60 days for complex requests)</p>
          </div>
          <div>
            <strong>Identity Verification:</strong>
            <p>Must verify requester identity before disclosing personal data</p>
          </div>
          <div>
            <strong>Data Breach Notification:</strong>
            <p>Notify DPA within 72 hours of becoming aware of a breach</p>
          </div>
          <div>
            <strong>Penalties:</strong>
            <p>Up to €20M or 4% of global annual turnover (whichever is higher)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== NEW REQUEST MODAL ====================

interface NewRequestModalProps {
  onClose: () => void
  onSubmit: (data: { request_type: DSARType; requester_email: string; requester_name: string }) => void
}

function NewRequestModal({ onClose, onSubmit }: NewRequestModalProps) {
  const [formData, setFormData] = useState({
    request_type: 'access' as DSARType,
    requester_email: '',
    requester_name: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Submit New Data Subject Access Request
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.request_type}
              onChange={(e) => setFormData({ ...formData, request_type: e.target.value as DSARType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="access">Right to Access (DSAR) - Export all personal data</option>
              <option value="erasure">Right to Erasure - Delete personal data ("Right to be Forgotten")</option>
              <option value="rectification">Right to Rectification - Correct inaccurate data</option>
              <option value="portability">Right to Data Portability - Export in machine-readable format</option>
              <option value="restrict">Right to Restrict Processing - Temporarily restrict processing</option>
              <option value="object">Right to Object - Object to certain processing activities</option>
              <option value="automated">Automated Decision-Making - Request human review</option>
              <option value="breach">Data Breach Notification - Notify about breach</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requester Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.requester_email}
              onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="requester@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requester Name
            </label>
            <input
              type="text"
              value={formData.requester_name}
              onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 text-xl">⚠️</span>
              <div className="text-sm text-yellow-800">
                <strong>Identity Verification Required:</strong>
                <p className="mt-1">
                  A verification code will be sent to the requester's email. Identity must be verified before processing the request.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
