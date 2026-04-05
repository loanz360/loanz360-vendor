'use client'

import { useState } from 'react'
import { X, RefreshCw, AlertCircle } from 'lucide-react'

interface StatusUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  contactId: string
  contactName: string
  currentStatus: string
  onUpdateStatus: (newStatus: string, reason?: string) => Promise<void>
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'blue' },
  { value: 'contacted', label: 'Contacted', color: 'indigo' },
  { value: 'follow_up', label: 'Follow Up', color: 'yellow' },
  { value: 'positive', label: 'Positive', color: 'green' },
  { value: 'not_interested', label: 'Not Interested', color: 'red' },
  { value: 'wrong_number', label: 'Wrong Number', color: 'gray' },
  { value: 'callback_later', label: 'Callback Later', color: 'orange' }
]

export default function StatusUpdateModal({
  isOpen,
  onClose,
  contactId,
  contactName,
  currentStatus,
  onUpdateStatus
}: StatusUpdateModalProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [reason, setReason] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const requiresReason = (status: string) => {
    return ['not_interested', 'wrong_number'].includes(status)
  }

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) {
      onClose()
      return
    }

    if (requiresReason(selectedStatus) && !reason.trim()) {
      setError('Please provide a reason for this status change')
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      await onUpdateStatus(selectedStatus, reason.trim() || undefined)
      onClose()
    } catch (error) {
      console.error('Failed to update status:', error)
      setError(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500',
      indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
      green: 'bg-green-500/20 text-green-400 border-green-500',
      red: 'bg-red-500/20 text-red-400 border-red-500',
      gray: 'bg-gray-500/20 text-gray-400 border-gray-500',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500'
    }
    return colors[color] || colors.gray
  }

  const handleClose = () => {
    if (!isUpdating) {
      setSelectedStatus(currentStatus)
      setReason('')
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/20 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold flex items-center font-poppins">
              <RefreshCw className="w-6 h-6 mr-2 text-orange-500" />
              Update Status
            </h2>
            <p className="text-sm text-gray-400 mt-1">{contactName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUpdating}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Current Status */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">Current Status</label>
            <div className={`px-3 py-2 rounded border ${getStatusColor(
              STATUS_OPTIONS.find(s => s.value === currentStatus)?.color || 'gray'
            )} text-center font-medium uppercase text-sm`}>
              {STATUS_OPTIONS.find(s => s.value === currentStatus)?.label || currentStatus}
            </div>
          </div>

          {/* New Status */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-2 block">
              New Status <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => setSelectedStatus(status.value)}
                  disabled={isUpdating}
                  className={`px-3 py-2 rounded border text-sm font-medium uppercase transition-colors ${
                    selectedStatus === status.value
                      ? getStatusColor(status.color)
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reason (conditional) */}
          {requiresReason(selectedStatus) && (
            <div>
              <label className="text-sm font-medium text-gray-400 mb-2 block">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please provide a reason for this status change..."
                className="w-full bg-black/50 text-white border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={3}
                disabled={isUpdating}
              />
              <p className="text-xs text-gray-400 mt-1">
                This information helps improve our processes
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Info Note */}
          {selectedStatus !== currentStatus && (
            <div className="flex items-start space-x-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-blue-400 text-xs">
                <p className="font-medium mb-1">Status Change Impact:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>This change will be recorded in the contact history</li>
                  {selectedStatus === 'positive' && (
                    <li>Contact will be moved to Positive Contacts</li>
                  )}
                  {['not_interested', 'wrong_number'].includes(selectedStatus) && (
                    <li>Contact will be marked as inactive</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-white/10">
          <button
            onClick={handleClose}
            disabled={isUpdating}
            className="px-6 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating || (requiresReason(selectedStatus) && !reason.trim())}
            className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating...' : 'Update Status'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
