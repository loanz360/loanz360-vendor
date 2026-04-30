'use client'

import React, { useState } from 'react'
import {
  Plus,
  Trash2,
  Target,
  TrendingUp,
  DollarSign,
  Users,
  Phone,
  Award,
  Percent,
  AlertCircle
} from 'lucide-react'

export interface MetricDefinition {
  id: string
  name: string
  display_name: string
  target_value: number
  weight: number
  measurement_type: 'count' | 'amount' | 'percentage' | 'rating'
  unit?: string
  icon?: string
}

interface MultiMetricTargetBuilderProps {
  metrics: MetricDefinition[]
  onChange: (metrics: MetricDefinition[]) => void
  formula?: 'weighted_average' | 'all_or_nothing' | 'minimum_threshold'
  minimumThreshold?: number
}

const METRIC_PRESETS = [
  { name: 'leads_converted', display: 'Leads Converted', type: 'count', icon: 'Users', unit: 'leads' },
  { name: 'deals_closed', display: 'Deals Closed', type: 'count', icon: 'Award', unit: 'deals' },
  { name: 'revenue_generated', display: 'Revenue Generated', type: 'amount', icon: 'DollarSign', unit: '₹' },
  { name: 'calls_made', display: 'Calls Made', type: 'count', icon: 'Phone', unit: 'calls' },
  { name: 'customer_satisfaction', display: 'Customer Satisfaction', type: 'rating', icon: 'Award', unit: '/5' },
  { name: 'conversion_rate', display: 'Conversion Rate', type: 'percentage', icon: 'Percent', unit: '%' },
  { name: 'meetings_conducted', display: 'Meetings Conducted', type: 'count', icon: 'Users', unit: 'meetings' },
  { name: 'applications_processed', display: 'Applications Processed', type: 'count', icon: 'Target', unit: 'applications' },
]

const getIconComponent = (iconName?: string) => {
  const icons = {
    Users,
    Award,
    DollarSign,
    Phone,
    Percent,
    Target,
    TrendingUp
  }
  return icons[iconName as keyof typeof icons] || Target
}

export default function MultiMetricTargetBuilder({
  metrics,
  onChange,
  formula = 'weighted_average',
  minimumThreshold = 70
}: MultiMetricTargetBuilderProps) {
  const [showPresets, setShowPresets] = useState(false)

  const addMetric = (preset?: typeof METRIC_PRESETS[0]) => {
    const newMetric: MetricDefinition = {
      id: `metric-${Date.now()}`,
      name: preset?.name || 'custom_metric',
      display_name: preset?.display || 'Custom Metric',
      target_value: 50,
      weight: 100 / (metrics.length + 1),
      measurement_type: (preset?.type as unknown) || 'count',
      unit: preset?.unit,
      icon: preset?.icon
    }

    // Rebalance weights
    const rebalancedMetrics = metrics.map(m => ({
      ...m,
      weight: (m.weight * metrics.length) / (metrics.length + 1)
    }))

    onChange([...rebalancedMetrics, newMetric])
    setShowPresets(false)
  }

  const removeMetric = (id: string) => {
    const remainingMetrics = metrics.filter(m => m.id !== id)

    // Rebalance weights
    const totalWeight = remainingMetrics.reduce((sum, m) => sum + m.weight, 0)
    const rebalanced = remainingMetrics.map(m => ({
      ...m,
      weight: (m.weight / totalWeight) * 100
    }))

    onChange(rebalanced)
  }

  const updateMetric = (id: string, updates: Partial<MetricDefinition>) => {
    onChange(metrics.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  const normalizeWeights = () => {
    const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0)
    if (totalWeight === 100) return

    const normalized = metrics.map(m => ({
      ...m,
      weight: (m.weight / totalWeight) * 100
    }))
    onChange(normalized)
  }

  const distributeEqualWeights = () => {
    const equalWeight = 100 / metrics.length
    onChange(metrics.map(m => ({ ...m, weight: equalWeight })))
  }

  const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0)
  const isWeightValid = Math.abs(totalWeight - 100) < 0.01

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-orange-400" />
          <div>
            <h3 className="text-lg font-semibold font-poppins">Multi-Metric Targets</h3>
            <p className="text-sm text-gray-400">Define composite targets with weighted scoring</p>
          </div>
        </div>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Metric
        </button>
      </div>

      {/* Preset Selection Modal */}
      {showPresets && (
        <div className="content-card p-6">
          <h4 className="text-sm font-semibold mb-4">Select Metric Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {METRIC_PRESETS.map(preset => {
              const Icon = getIconComponent(preset.icon)
              return (
                <button
                  key={preset.name}
                  onClick={() => addMetric(preset)}
                  className="p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-lg transition-colors text-left"
                >
                  <Icon className="w-5 h-5 text-orange-400 mb-2" />
                  <div className="text-sm font-medium">{preset.display}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.type}</div>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setShowPresets(false)}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Metrics List */}
      {metrics.length === 0 ? (
        <div className="content-card p-12 text-center">
          <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Metrics Defined</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add metrics to create a composite target with weighted scoring
          </p>
          <button
            onClick={() => setShowPresets(true)}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            Add Your First Metric
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map((metric, index) => {
            const Icon = getIconComponent(metric.icon)

            return (
              <div
                key={metric.id}
                className="content-card p-4 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-orange-400" />
                  </div>

                  {/* Metric Details */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Display Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Metric Name
                      </label>
                      <input
                        type="text"
                        value={metric.display_name}
                        onChange={(e) => updateMetric(metric.id, { display_name: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>

                    {/* Target Value */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Target Value
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={metric.target_value}
                          onChange={(e) => updateMetric(metric.id, { target_value: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0"
                        />
                        {metric.unit && (
                          <span className="absolute right-3 top-2 text-gray-500 text-sm">
                            {metric.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Weight */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Weight (%)
                      </label>
                      <input
                        type="number"
                        value={metric.weight.toFixed(1)}
                        onChange={(e) => updateMetric(metric.id, { weight: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        value={metric.measurement_type}
                        onChange={(e) => updateMetric(metric.id, { measurement_type: e.target.value as unknown })}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value="count">Count</option>
                        <option value="amount">Amount</option>
                        <option value="percentage">Percentage</option>
                        <option value="rating">Rating</option>
                      </select>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeMetric(metric.id)}
                    className="p-2 hover:bg-red-900/50 rounded transition-colors text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Weight Progress Bar */}
                <div className="mt-3 ml-14">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${metric.weight}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Weight Summary */}
      {metrics.length > 0 && (
        <div className={`${isWeightValid ? 'bg-green-900/20 border-green-500/50' : 'bg-yellow-900/20 border-yellow-500/50'} border rounded-lg p-4`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {isWeightValid ? (
                <Award className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className={`text-sm font-semibold ${isWeightValid ? 'text-green-300' : 'text-yellow-300'} mb-1`}>
                  Total Weight: {totalWeight.toFixed(1)}%
                </h4>
                <p className="text-sm text-gray-400">
                  {isWeightValid
                    ? 'Weights are properly balanced'
                    : 'Weights should total 100%. Click "Normalize" to auto-balance.'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {!isWeightValid && (
                <button
                  onClick={normalizeWeights}
                  className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Normalize
                </button>
              )}
              <button
                onClick={distributeEqualWeights}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Equal Weights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula Configuration */}
      {metrics.length > 0 && (
        <div className="content-card p-6">
          <h4 className="text-sm font-semibold mb-4">Achievement Formula</h4>

          <div className="space-y-4">
            {/* Formula Selection */}
            <div className="grid grid-cols-3 gap-3">
              <label className="relative">
                <input
                  type="radio"
                  name="formula"
                  value="weighted_average"
                  checked={formula === 'weighted_average'}
                  className="peer sr-only"
                />
                <div className="p-4 bg-gray-800 border-2 border-gray-700 peer-checked:border-orange-500 peer-checked:bg-orange-500/10 rounded-lg cursor-pointer transition-all">
                  <Percent className="w-5 h-5 text-orange-400 mb-2" />
                  <div className="text-sm font-medium">Weighted Average</div>
                  <div className="text-xs text-gray-500 mt-1">Sum of (metric% × weight)</div>
                </div>
              </label>

              <label className="relative">
                <input
                  type="radio"
                  name="formula"
                  value="minimum_threshold"
                  checked={formula === 'minimum_threshold'}
                  className="peer sr-only"
                />
                <div className="p-4 bg-gray-800 border-2 border-gray-700 peer-checked:border-orange-500 peer-checked:bg-orange-500/10 rounded-lg cursor-pointer transition-all">
                  <Target className="w-5 h-5 text-orange-400 mb-2" />
                  <div className="text-sm font-medium">Minimum Threshold</div>
                  <div className="text-xs text-gray-500 mt-1">All metrics ≥ threshold</div>
                </div>
              </label>

              <label className="relative">
                <input
                  type="radio"
                  name="formula"
                  value="all_or_nothing"
                  checked={formula === 'all_or_nothing'}
                  className="peer sr-only"
                />
                <div className="p-4 bg-gray-800 border-2 border-gray-700 peer-checked:border-orange-500 peer-checked:bg-orange-500/10 rounded-lg cursor-pointer transition-all">
                  <Award className="w-5 h-5 text-orange-400 mb-2" />
                  <div className="text-sm font-medium">All or Nothing</div>
                  <div className="text-xs text-gray-500 mt-1">100% on all metrics</div>
                </div>
              </label>
            </div>

            {/* Minimum Threshold Input */}
            {formula === 'minimum_threshold' && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Threshold (%)
                </label>
                <input
                  type="number"
                  value={minimumThreshold}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-2">
                  All metrics must achieve at least {minimumThreshold}% to unlock the reward
                </p>
              </div>
            )}

            {/* Example Calculation */}
            <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-blue-300 mb-3">Example Calculation</h5>
              <div className="space-y-2 text-sm">
                {metrics.slice(0, 3).map((metric, index) => (
                  <div key={metric.id} className="flex justify-between text-gray-300">
                    <span>{metric.display_name}: 80%</span>
                    <span className="text-gray-500">× {metric.weight.toFixed(0)}% = {(80 * metric.weight / 100).toFixed(1)}%</span>
                  </div>
                ))}
                {formula === 'weighted_average' && (
                  <div className="pt-2 border-t border-blue-500/30 flex justify-between font-semibold text-blue-300">
                    <span>Final Score:</span>
                    <span>{metrics.slice(0, 3).reduce((sum, m) => sum + (80 * m.weight / 100), 0).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
