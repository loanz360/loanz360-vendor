'use client'

import React, { useState } from 'react'
import {
  CheckSquare, Tag as TagIcon, UserPlus, FileText, Download, Loader2,
  AlertCircle, CheckCircle, X, ChevronDown
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface BulkOperationsProps {
  selectedCustomers: string[]
  onOperationComplete: () => void
  onClearSelection: () => void
}

type BulkOperation =
  | 'update_status'
  | 'update_kyc_status'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_to'
  | 'add_note'
  | 'export'

export function BulkOperations({
  selectedCustomers,
  onOperationComplete,
  onClearSelection
}: BulkOperationsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState<BulkOperation | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form data for different operations
  const [formData, setFormData] = useState<Record<string, any>>({})

  if (selectedCustomers.length === 0) {
    return null
  }

  const operations = [
    { id: 'update_status' as BulkOperation, label: 'Update Status', icon: CheckSquare },
    { id: 'update_kyc_status' as BulkOperation, label: 'Update KYC Status', icon: CheckCircle },
    { id: 'add_tag' as BulkOperation, label: 'Add Tag', icon: TagIcon },
    { id: 'remove_tag' as BulkOperation, label: 'Remove Tag', icon: X },
    { id: 'add_note' as BulkOperation, label: 'Add Note', icon: FileText },
    { id: 'export' as BulkOperation, label: 'Export Selected', icon: Download }
  ]

  const handleSubmit = async () => {
    if (!selectedOperation) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/superadmin/customer-management/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: selectedOperation,
          customer_ids: selectedCustomers,
          data: formData
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        setFormData({})
        setSelectedOperation(null)
        onOperationComplete()

        // Auto-close success message after 3 seconds
        setTimeout(() => {
          setSuccess(null)
          onClearSelection()
        }, 3000)
      } else {
        setError(data.error || 'Operation failed')
      }
    } catch (err) {
      console.error('Bulk operation error:', err)
      setError('Failed to perform bulk operation')
      clientLogger.error('Bulk operation failed', { operation: selectedOperation, error: err })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderOperationForm = () => {
    switch (selectedOperation) {
      case 'update_status':
        return (
          <div className="space-y-3">
            <label className="block text-sm text-gray-300">New Status</label>
            <select
              value={formData.status || ''}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select status...</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
            </select>
          </div>
        )

      case 'update_kyc_status':
        return (
          <div className="space-y-3">
            <label className="block text-sm text-gray-300">New KYC Status</label>
            <select
              value={formData.kyc_status || ''}
              onChange={(e) => setFormData({ ...formData, kyc_status: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Select KYC status...</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        )

      case 'add_tag':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Tag Name</label>
              <input
                type="text"
                value={formData.tag_name || ''}
                onChange={(e) => setFormData({ ...formData, tag_name: e.target.value })}
                placeholder="e.g., HIGH_PRIORITY"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Category</label>
              <select
                value={formData.tag_category || 'CUSTOM'}
                onChange={(e) => setFormData({ ...formData, tag_category: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="CUSTOM">Custom</option>
                <option value="BEHAVIORAL">Behavioral</option>
                <option value="FINANCIAL">Financial</option>
                <option value="RISK">Risk</option>
                <option value="LIFECYCLE">Lifecycle</option>
              </select>
            </div>
          </div>
        )

      case 'remove_tag':
        return (
          <div className="space-y-3">
            <label className="block text-sm text-gray-300">Tag Name to Remove</label>
            <input
              type="text"
              value={formData.tag_name || ''}
              onChange={(e) => setFormData({ ...formData, tag_name: e.target.value })}
              placeholder="e.g., HIGH_PRIORITY"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        )

      case 'add_note':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Note Content</label>
              <textarea
                value={formData.note_content || ''}
                onChange={(e) => setFormData({ ...formData, note_content: e.target.value })}
                placeholder="Enter note content..."
                rows={4}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Type</label>
                <select
                  value={formData.note_type || 'GENERAL'}
                  onChange={(e) => setFormData({ ...formData, note_type: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="INTERNAL">Internal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Category</label>
                <select
                  value={formData.category || 'GENERAL'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="SALES">Sales</option>
                  <option value="SUPPORT">Support</option>
                </select>
              </div>
            </div>
          </div>
        )

      case 'export':
        return (
          <div className="space-y-3">
            <label className="block text-sm text-gray-300">Export Format</label>
            <select
              value={formData.format || 'json'}
              onChange={(e) => setFormData({ ...formData, format: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
            <p className="text-xs text-gray-400">
              This will export {selectedCustomers.length} selected customer(s)
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Success Message */}
      {success && (
        <div className="mb-4 bg-green-500/20 border border-green-500/30 rounded-lg p-4 flex items-start space-x-3 max-w-md">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Panel */}
      <div className="bg-gradient-to-br from-orange-900/90 to-orange-950/90 backdrop-blur-lg rounded-xl shadow-2xl border border-orange-700/30 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Bulk Operations</h3>
              <p className="text-xs text-gray-300">{selectedCustomers.length} selected</p>
            </div>
          </div>
          <button
            onClick={onClearSelection}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {!selectedOperation ? (
            // Operation Selection
            <div className="space-y-2 min-w-[300px]">
              {operations.map((op) => {
                const Icon = op.icon
                return (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperation(op.id)}
                    className="w-full flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-left"
                  >
                    <Icon className="w-5 h-5 text-orange-400" />
                    <span className="text-white text-sm font-medium">{op.label}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto rotate-[-90deg]" />
                  </button>
                )
              })}
            </div>
          ) : (
            // Operation Form
            <div className="min-w-[350px]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium">
                  {operations.find(op => op.id === selectedOperation)?.label}
                </h4>
                <button
                  onClick={() => {
                    setSelectedOperation(null)
                    setFormData({})
                    setError(null)
                  }}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Back
                </button>
              </div>

              {renderOperationForm()}

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    setSelectedOperation(null)
                    setFormData({})
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canSubmit()}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Apply</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  function canSubmit(): boolean {
    switch (selectedOperation) {
      case 'update_status':
        return !!formData.status
      case 'update_kyc_status':
        return !!formData.kyc_status
      case 'add_tag':
        return !!formData.tag_name
      case 'remove_tag':
        return !!formData.tag_name
      case 'add_note':
        return !!formData.note_content?.trim()
      case 'export':
        return true
      default:
        return false
    }
  }
}
