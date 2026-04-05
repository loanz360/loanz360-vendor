'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Users, Target, Check, AlertCircle } from 'lucide-react'

interface BulkSetTargetsModalProps {
  isOpen: boolean
  onClose: () => void
  month: number
  year: number
  teamBDEs: Array<{
    bdeId: string
    bdeName: string
    employeeCode: string
  }>
  onSuccess: () => void
}

interface BDETarget {
  bdeId: string
  bdeName: string
  employeeCode: string
  monthlyConversionTarget: number
  monthlyRevenueTarget: number
  incentiveMultiplier: number
  selected: boolean
}

export default function BulkSetTargetsModal({
  isOpen,
  onClose,
  month,
  year,
  teamBDEs,
  onSuccess,
}: BulkSetTargetsModalProps) {
  const [targets, setTargets] = useState<BDETarget[]>([])
  const [baseConversionTarget, setBaseConversionTarget] = useState(20)
  const [baseRevenueTarget, setBaseRevenueTarget] = useState(5000000)
  const [baseIncentiveMultiplier, setBaseIncentiveMultiplier] = useState(1.0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && teamBDEs.length > 0) {
      setTargets(
        teamBDEs.map((bde) => ({
          ...bde,
          monthlyConversionTarget: baseConversionTarget,
          monthlyRevenueTarget: baseRevenueTarget,
          incentiveMultiplier: baseIncentiveMultiplier,
          selected: true,
        }))
      )
    }
  }, [isOpen, teamBDEs, baseConversionTarget, baseRevenueTarget, baseIncentiveMultiplier])

  const handleApplyToAll = () => {
    setTargets((prev) =>
      prev.map((target) =>
        target.selected
          ? {
              ...target,
              monthlyConversionTarget: baseConversionTarget,
              monthlyRevenueTarget: baseRevenueTarget,
              incentiveMultiplier: baseIncentiveMultiplier,
            }
          : target
      )
    )
  }

  const handleToggleSelect = (bdeId: string) => {
    setTargets((prev) => prev.map((t) => (t.bdeId === bdeId ? { ...t, selected: !t.selected } : t)))
  }

  const handleToggleSelectAll = () => {
    const allSelected = targets.every((t) => t.selected)
    setTargets((prev) => prev.map((t) => ({ ...t, selected: !allSelected })))
  }

  const handleUpdateTarget = (bdeId: string, field: string, value: number) => {
    setTargets((prev) => prev.map((t) => (t.bdeId === bdeId ? { ...t, [field]: value } : t)))
  }

  const handleSubmit = async () => {
    const selectedTargets = targets.filter((t) => t.selected)

    if (selectedTargets.length === 0) {
      setError('Please select at least one team member')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      const response = await fetch('/api/bdm/team-targets/targets/set-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month,
          year,
          targets: selectedTargets.map((t) => ({
            bdeId: t.bdeId,
            monthlyConversionTarget: t.monthlyConversionTarget,
            monthlyRevenueTarget: t.monthlyRevenueTarget,
            incentiveMultiplier: t.incentiveMultiplier,
          })),
        }),
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
        onClose()
      } else {
        setError(data.error || 'Failed to set targets')
      }
    } catch (error) {
      console.error('Error setting bulk targets:', error)
      setError('An error occurred while setting targets')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const selectedCount = targets.filter((t) => t.selected).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="content-card max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Bulk Set Targets - {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Base Target Settings */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                Base Target Settings
              </h3>
              <button
                onClick={handleApplyToAll}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
              >
                Apply to Selected ({selectedCount})
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Monthly Conversion Target</label>
                <input
                  type="number"
                  value={baseConversionTarget}
                  onChange={(e) => setBaseConversionTarget(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  min="1"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Monthly Revenue Target (₹)</label>
                <input
                  type="number"
                  value={baseRevenueTarget}
                  onChange={(e) => setBaseRevenueTarget(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  min="1"
                  step="100000"
                />
                <p className="text-xs text-gray-500 mt-1">₹{(baseRevenueTarget / 100000).toFixed(2)}L</p>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Incentive Multiplier</label>
                <input
                  type="number"
                  value={baseIncentiveMultiplier}
                  onChange={(e) => setBaseIncentiveMultiplier(parseFloat(e.target.value) || 1.0)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                />
                <p className="text-xs text-gray-500 mt-1">{baseIncentiveMultiplier.toFixed(1)}x</p>
              </div>
            </div>
          </div>

          {/* Team Members Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Team Members ({teamBDEs.length})</h3>
              <button
                onClick={handleToggleSelectAll}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {targets.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="p-3 text-left">
                        <input
                          type="checkbox"
                          checked={targets.every((t) => t.selected)}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-gray-600"
                        />
                      </th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-300">BDE Name</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-300">Employee Code</th>
                      <th className="p-3 text-center text-sm font-semibold text-gray-300">Conversions</th>
                      <th className="p-3 text-center text-sm font-semibold text-gray-300">Revenue (₹L)</th>
                      <th className="p-3 text-center text-sm font-semibold text-gray-300">Multiplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {targets.map((target) => (
                      <tr
                        key={target.bdeId}
                        className={`${target.selected ? 'bg-gray-750' : 'bg-gray-800'} hover:bg-gray-700 transition-colors`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={target.selected}
                            onChange={() => handleToggleSelect(target.bdeId)}
                            className="w-4 h-4 rounded border-gray-600"
                          />
                        </td>
                        <td className="p-3">
                          <div className="text-white font-medium">{target.bdeName}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-gray-400 text-sm">{target.employeeCode}</div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={target.monthlyConversionTarget}
                            onChange={(e) =>
                              handleUpdateTarget(target.bdeId, 'monthlyConversionTarget', parseInt(e.target.value) || 0)
                            }
                            disabled={!target.selected}
                            className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            min="1"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={(target.monthlyRevenueTarget / 100000).toFixed(2)}
                            onChange={(e) =>
                              handleUpdateTarget(
                                target.bdeId,
                                'monthlyRevenueTarget',
                                Math.round((parseFloat(e.target.value) || 0) * 100000)
                              )
                            }
                            disabled={!target.selected}
                            className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            min="0.1"
                            step="0.5"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={target.incentiveMultiplier}
                            onChange={(e) =>
                              handleUpdateTarget(target.bdeId, 'incentiveMultiplier', parseFloat(e.target.value) || 1.0)
                            }
                            disabled={!target.selected}
                            className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-center focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-semibold">Ready to Set Targets</span>
            </div>
            <p className="text-sm text-gray-300">
              {selectedCount} team member{selectedCount !== 1 ? 's' : ''} selected. Targets will be set for{' '}
              {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
            </p>
          </div>
        </CardContent>

        {/* Footer Actions */}
        <div className="border-t border-gray-800 p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || selectedCount === 0}
            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Setting Targets...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Set Targets for {selectedCount} BDE{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </Card>
    </div>
  )
}
