'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, FileText, Check } from 'lucide-react'
import { Button } from './button'

interface PayoutData {
  id: string
  bank_name: string
  location: string
  loan_type: string
  commission_percentage: number
  specific_conditions?: string | null
}

interface SpecificConditionsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  payout: PayoutData | null
  apiEndpoint: string // e.g., '/api/superadmin/payout-management/general-percentages'
}

export default function SpecificConditionsModal({
  isOpen,
  onClose,
  onSuccess,
  payout,
  apiEndpoint
}: SpecificConditionsModalProps) {
  const [conditions, setConditions] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && payout) {
      setConditions(payout.specific_conditions || '')
      setError('')
    }
  }, [isOpen, payout])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payout) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payout.id,
          specific_conditions: conditions.trim() || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update specific conditions')
      }

      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !payout) return null

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-black z-10 flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold mb-2 font-poppins">Edit Specific Payout Conditions</h2>
            <p className="text-sm text-gray-400">
              Add specific conditions required to receive this particular payout
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Payout Details */}
          <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border border-orange-500/30 rounded-lg p-5 mb-6">
            <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center font-poppins">
              <FileText className="w-4 h-4 mr-2" />
              Payout Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">Bank Name</p>
                <p className="text-sm font-medium text-white">{payout.bank_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Location</p>
                <p className="text-sm font-medium text-white">{payout.location}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Loan Type</p>
                <p className="text-sm font-medium text-white">{payout.loan_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Commission %</p>
                <p className="text-sm font-semibold text-orange-400">
                  {payout.commission_percentage.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Banner */}
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-blue-300">
                <p className="font-medium mb-2">How to add specific conditions:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                  <li>Enter each condition on a new line</li>
                  <li>Be specific about requirements (e.g., processing fee, interest rate, insurance)</li>
                  <li>These conditions are unique to this particular payout record</li>
                  <li>Partners will see these conditions in addition to the global mandatory conditions</li>
                  <li>Leave empty if no specific conditions are required for this payout</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Conditions Text Area */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Specific Conditions
            </label>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={10}
              className="w-full bg-white/5 text-white rounded-lg px-4 py-3 text-sm
                         border border-white/10 focus:ring-2 focus:ring-orange-500
                         focus:border-orange-500 placeholder-gray-400 font-mono"
              placeholder={`Enter specific conditions for this payout (one per line). Examples:

Processing fee must be maintained at 2%
Rate of interest should be between 12% - 15%
Insurance must be included in loan amount
Minimum loan amount: ₹5,00,000
Maximum loan tenure: 5 years
Client must have minimum credit score of 700`}
            />
            <div className="mt-2 flex items-start space-x-2">
              <p className="text-xs text-gray-500">
                {conditions.split('\n').filter(line => line.trim()).length} condition(s) entered
              </p>
            </div>
          </div>

          {/* Example */}
          <div className="mb-6 p-4 bg-gray-900/50 border border-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-400 mb-2 font-semibold">Example:</p>
            <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
Processing fee: 2% of loan amount
Interest rate: 12% - 15% per annum
Insurance: Mandatory (included in EMI)
Minimum loan amount: ₹5,00,000
Maximum tenure: 60 months
Credit score requirement: 700+
            </pre>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Conditions
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
