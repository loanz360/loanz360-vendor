'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface SetTargetModalProps {
  isOpen: boolean
  onClose: () => void
  bde?: {
    id: string
    name: string
    employeeCode: string
  } | null
  month: number
  year: number
  existingTarget?: {
    monthlyConversionTarget: number
    monthlyRevenueTarget: number
    dailyConversionTarget?: number
    incentiveMultiplier?: number
  } | null
  onSuccess: () => void
}

export default function SetTargetModal({
  isOpen,
  onClose,
  bde,
  month,
  year,
  existingTarget,
  onSuccess,
}: SetTargetModalProps) {
  const [monthlyConversionTarget, setMonthlyConversionTarget] = useState(existingTarget?.monthlyConversionTarget || 20)
  const [monthlyRevenueTarget, setMonthlyRevenueTarget] = useState(existingTarget?.monthlyRevenueTarget || 5000000)
  const [dailyConversionTarget, setDailyConversionTarget] = useState(existingTarget?.dailyConversionTarget || 1)
  const [incentiveMultiplier, setIncentiveMultiplier] = useState(existingTarget?.incentiveMultiplier || 1.0)
  const [targetRationale, setTargetRationale] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const daysInMonth = new Date(year, month, 0).getDate()

  useEffect(() => {
    if (existingTarget) {
      setMonthlyConversionTarget(existingTarget.monthlyConversionTarget)
      setMonthlyRevenueTarget(existingTarget.monthlyRevenueTarget)
      setDailyConversionTarget(existingTarget.dailyConversionTarget || Math.ceil(existingTarget.monthlyConversionTarget / daysInMonth))
      setIncentiveMultiplier(existingTarget.incentiveMultiplier || 1.0)
    }
  }, [existingTarget])

  useEffect(() => {
    // Auto-calculate daily target when monthly changes
    setDailyConversionTarget(Math.ceil(monthlyConversionTarget / daysInMonth))
  }, [monthlyConversionTarget, daysInMonth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/bdm/team-targets/targets/set-individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bdeId: bde?.id,
          month,
          year,
          dailyConversionTarget,
          monthlyConversionTarget,
          monthlyRevenueTarget,
          incentiveMultiplier,
          targetRationale,
          notes,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to set target')
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set target')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="content-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {existingTarget ? 'Update Target' : 'Set Target'}
            </h2>
            {bde && (
              <p className="text-sm text-gray-400 mt-1">
                {bde.name} ({bde.employeeCode}) - {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Monthly Conversion Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Monthly Conversion Target *
            </label>
            <input
              type="number"
              min="1"
              required
              value={monthlyConversionTarget}
              onChange={(e) => setMonthlyConversionTarget(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="20"
            />
            <p className="text-xs text-gray-500 mt-1">Number of conversions expected this month</p>
          </div>

          {/* Daily Conversion Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Daily Conversion Target
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={dailyConversionTarget}
              onChange={(e) => setDailyConversionTarget(parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Auto-calculated: {(monthlyConversionTarget / daysInMonth).toFixed(2)} conversions/day for {daysInMonth} days
            </p>
          </div>

          {/* Monthly Revenue Target */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Monthly Revenue Target (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="100000"
              required
              value={monthlyRevenueTarget}
              onChange={(e) => setMonthlyRevenueTarget(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="5000000"
            />
            <p className="text-xs text-gray-500 mt-1">
              In Crores: ₹{(monthlyRevenueTarget / 10000000).toFixed(2)}Cr
            </p>
          </div>

          {/* Incentive Multiplier */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Incentive Multiplier
            </label>
            <input
              type="number"
              min="0.5"
              max="2.0"
              step="0.1"
              value={incentiveMultiplier}
              onChange={(e) => setIncentiveMultiplier(parseFloat(e.target.value))}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: 1.0x | Range: 0.5x - 2.0x (affects incentive calculations)
            </p>
          </div>

          {/* Target Rationale */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Rationale
            </label>
            <textarea
              value={targetRationale}
              onChange={(e) => setTargetRationale(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Why this target was set (e.g., based on last month performance +10%)"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Additional Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Any additional notes or context"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Setting Target...
                </>
              ) : (
                existingTarget ? 'Update Target' : 'Set Target'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
