'use client'

import { toast } from 'sonner'

import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Clock, FileText, MessageSquare, TrendingDown, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'

interface ResignationData {
  employee: any
  resignation: any | null
  hasActiveResignation: boolean
}

export default function ResignationManagement() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ResignationData | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    last_working_day: '',
    resignation_reason: 'BETTER_OPPORTUNITY',
    detailed_reason: '',
    new_employer: ''
  })

  useEffect(() => {
    fetchResignationData()
  }, [])

  const fetchResignationData = async () => {
    try {
      const response = await fetch('/api/employees/resignation')
      if (response.ok) {
        const result = await response.json()
        setData(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch resignation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/employees/resignation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchResignationData()
        setShowForm(false)
        toast.success('Resignation submitted successfully. Your manager will be notified.')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Submission failed')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!confirm('Are you sure you want to withdraw your resignation?')) return

    try {
      const response = await fetch('/api/employees/resignation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'WITHDRAW',
          resignation_id: data?.resignation?.id,
          withdrawal_reason: 'Changed my mind'
        })
      })

      if (response.ok) {
        await fetchResignationData()
        toast.success('Resignation withdrawn successfully')
      } else {
        toast.error('Withdrawal failed')
      }
    } catch (error) {
      console.error('Withdraw error:', error)
      toast.error('Withdrawal failed')
    }
  }

  const handleCounterofferResponse = async (response: 'ACCEPTED' | 'REJECTED') => {
    if (!confirm(`Are you sure you want to ${response.toLowerCase()} the counteroffer?`)) return

    try {
      const res = await fetch('/api/employees/resignation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESPOND_TO_COUNTEROFFER',
          resignation_id: data?.resignation?.id,
          response
        })
      })

      if (res.ok) {
        await fetchResignationData()
        toast.info(`Counteroffer ${response.toLowerCase()} successfully`)
      } else {
        toast.error('Failed to respond')
      }
    } catch (error) {
      console.error('Response error:', error)
      toast.error('Failed to respond')
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'SUBMITTED': 'bg-blue-500/20 text-blue-300',
      'UNDER_REVIEW': 'bg-yellow-500/20 text-yellow-300',
      'APPROVED': 'bg-green-500/20 text-green-300',
      'REJECTED': 'bg-red-500/20 text-red-300',
      'COUNTEROFFER_MADE': 'bg-purple-500/20 text-purple-300',
      'WITHDRAWN': 'bg-gray-500/20 text-gray-300',
      'COMPLETED': 'bg-gray-500/20 text-gray-300'
    }
    return colors[status] || 'bg-gray-500/20 text-gray-300'
  }

  const calculateNoticeDays = () => {
    if (!formData.last_working_day) return 0
    const today = new Date()
    const lastDay = new Date(formData.last_working_day)
    return Math.ceil((lastDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-300">Failed to load data. Please refresh.</p>
      </div>
    )
  }

  // If no active resignation, show submit form
  if (!data.hasActiveResignation) {
    return (
      <div className="space-y-6">
        {/* Warning Card */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-orange-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-300 text-lg">Important Information</h3>
              <ul className="mt-2 space-y-1 text-sm text-orange-200">
                <li>• Standard notice period is 30 days</li>
                <li>• Your resignation will be reviewed by your manager and HR</li>
                <li>• You may receive a counteroffer</li>
                <li>• Exit clearance from all departments is required</li>
                <li>• Final settlement will be processed after clearance</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Resignation Form */}
        <div className="frosted-card p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-6">Submit Resignation</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Last Working Day */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Last Working Day <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                min={new Date(Date.now() + 86400000 * 15).toISOString().split('T')[0]}
                value={formData.last_working_day}
                onChange={(e) => setFormData({ ...formData, last_working_day: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              {formData.last_working_day && (
                <p className="text-sm text-gray-400 mt-2">
                  Notice period: {calculateNoticeDays()} days
                  {calculateNoticeDays() < 30 && (
                    <span className="text-orange-400"> (Minimum 30 days recommended)</span>
                  )}
                </p>
              )}
            </div>

            {/* Resignation Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reason for Leaving
              </label>
              <select
                value={formData.resignation_reason}
                onChange={(e) => setFormData({ ...formData, resignation_reason: e.target.value })}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              >
                <option value="BETTER_OPPORTUNITY">Better Opportunity</option>
                <option value="HIGHER_STUDIES">Higher Studies</option>
                <option value="RELOCATION">Relocation</option>
                <option value="PERSONAL">Personal Reasons</option>
                <option value="HEALTH">Health Reasons</option>
                <option value="RETIREMENT">Retirement</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Detailed Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                rows={4}
                value={formData.detailed_reason}
                onChange={(e) => setFormData({ ...formData, detailed_reason: e.target.value })}
                placeholder="Please provide additional context..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* New Employer (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Employer (Optional)
              </label>
              <input
                type="text"
                value={formData.new_employer}
                onChange={(e) => setFormData({ ...formData, new_employer: e.target.value })}
                placeholder="Company name (optional)"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition disabled:opacity-50 font-semibold"
            >
              {submitting ? 'Submitting...' : 'Submit Resignation'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // If has active resignation, show status
  const resignation = data.resignation

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="frosted-card p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Resignation Status</h2>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(resignation.status)}`}>
            {resignation.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-400">Resignation Date</p>
            <p className="text-lg font-semibold text-white mt-1">
              {new Date(resignation.resignation_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Last Working Day</p>
            <p className="text-lg font-semibold text-white mt-1">
              {new Date(resignation.last_working_day).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Notice Period</p>
            <p className="text-lg font-semibold text-white mt-1">
              {resignation.actual_notice_period_days} days
            </p>
          </div>
        </div>

        {resignation.detailed_reason && (
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Your Reason:</p>
            <p className="text-white">{resignation.detailed_reason}</p>
          </div>
        )}
      </div>

      {/* Counteroffer Card */}
      {resignation.counteroffer_made && resignation.status === 'COUNTEROFFER_MADE' && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <MessageSquare className="w-6 h-6 text-purple-400" />
            <div>
              <h3 className="font-semibold text-purple-300 text-lg">Counteroffer Received</h3>
              <p className="text-purple-200 text-sm mt-1">
                Management has made you a counteroffer. Please review and respond.
              </p>
            </div>
          </div>

          <div className="p-4 bg-purple-900/20 rounded-lg mb-4">
            <p className="text-white mb-2">{resignation.counteroffer_details}</p>
            {resignation.counteroffer_amount && (
              <p className="text-purple-300 font-semibold">
                Revised Salary: ₹{resignation.counteroffer_amount.toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleCounterofferResponse('ACCEPTED')}
              className="flex-1 px-6 py-3 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition font-semibold"
            >
              Accept Offer
            </button>
            <button
              onClick={() => handleCounterofferResponse('REJECTED')}
              className="flex-1 px-6 py-3 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition font-semibold"
            >
              Decline Offer
            </button>
          </div>
        </div>
      )}

      {/* Clearance Status */}
      {resignation.clearance && (
        <div className="frosted-card p-6 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Exit Clearance Status</h3>
          <div className="space-y-3">
            {[
              { dept: 'IT', status: resignation.clearance.it_clearance_status },
              { dept: 'Admin', status: resignation.clearance.admin_clearance_status },
              { dept: 'HR', status: resignation.clearance.hr_clearance_status },
              { dept: 'Finance', status: resignation.clearance.finance_clearance_status },
              { dept: 'Manager', status: resignation.clearance.manager_clearance_status }
            ].map((item) => (
              <div key={item.dept} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                <span className="text-white font-medium">{item.dept}</span>
                <span className={`px-3 py-1 rounded-full text-xs ${
                  item.status === 'COMPLETED'
                    ? 'bg-green-500/20 text-green-300'
                    : item.status === 'IN_PROGRESS'
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {['SUBMITTED', 'UNDER_REVIEW'].includes(resignation.status) && (
        <button
          onClick={handleWithdraw}
          className="w-full px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition font-semibold"
        >
          Withdraw Resignation
        </button>
      )}
    </div>
  )
}
