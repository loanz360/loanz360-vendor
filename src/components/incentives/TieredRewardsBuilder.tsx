'use client'

import React, { useState } from 'react'
import {
  Trophy,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Medal,
  Crown,
  Star,
  Zap
} from 'lucide-react'

export interface IncentiveTier {
  id: string
  tier_code: string
  tier_name: string
  min_percentage: number
  max_percentage: number
  reward_amount: number
  reward_currency: string
  badge_icon?: string
  badge_color?: string
  bonus_multiplier?: number
}

interface TieredRewardsBuilderProps {
  tiers: IncentiveTier[]
  onChange: (tiers: IncentiveTier[]) => void
  baseCurrency?: string
}

const TIER_PRESETS = [
  { code: 'BRONZE', name: 'Bronze', icon: Medal, color: '#CD7F32', min: 0, max: 25, multiplier: 1.0 },
  { code: 'SILVER', name: 'Silver', icon: Medal, color: '#C0C0C0', min: 25, max: 50, multiplier: 1.5 },
  { code: 'GOLD', name: 'Gold', icon: Star, color: '#FFD700', min: 50, max: 75, multiplier: 2.0 },
  { code: 'PLATINUM', name: 'Platinum', icon: Crown, color: '#E5E4E2', min: 75, max: 100, multiplier: 2.5 },
  { code: 'DIAMOND', name: 'Diamond', icon: Sparkles, color: '#B9F2FF', min: 100, max: 150, multiplier: 3.0 },
]

export default function TieredRewardsBuilder({
  tiers,
  onChange,
  baseCurrency = 'INR'
}: TieredRewardsBuilderProps) {
  const [expandedTier, setExpandedTier] = useState<string | null>(null)

  const addTier = () => {
    const nextPreset = TIER_PRESETS[tiers.length] || TIER_PRESETS[TIER_PRESETS.length - 1]
    const lastTier = tiers[tiers.length - 1]

    const newTier: IncentiveTier = {
      id: `tier-${Date.now()}`,
      tier_code: nextPreset.code,
      tier_name: nextPreset.name,
      min_percentage: lastTier ? lastTier.max_percentage : nextPreset.min,
      max_percentage: lastTier ? lastTier.max_percentage + 25 : nextPreset.max,
      reward_amount: lastTier ? lastTier.reward_amount * 1.5 : 5000,
      reward_currency: baseCurrency,
      badge_icon: nextPreset.icon.name,
      badge_color: nextPreset.color,
      bonus_multiplier: nextPreset.multiplier
    }

    onChange([...tiers, newTier])
  }

  const removeTier = (id: string) => {
    onChange(tiers.filter(t => t.id !== id))
  }

  const updateTier = (id: string, updates: Partial<IncentiveTier>) => {
    onChange(tiers.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const moveTier = (index: number, direction: 'up' | 'down') => {
    const newTiers = [...tiers]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= tiers.length) return

    [newTiers[index], newTiers[newIndex]] = [newTiers[newIndex], newTiers[index]]
    onChange(newTiers)
  }

  const loadPresets = () => {
    const presetTiers: IncentiveTier[] = TIER_PRESETS.map((preset, index) => ({
      id: `preset-${preset.code}`,
      tier_code: preset.code,
      tier_name: preset.name,
      min_percentage: preset.min,
      max_percentage: preset.max,
      reward_amount: 5000 * preset.multiplier,
      reward_currency: baseCurrency,
      badge_icon: preset.icon.name,
      badge_color: preset.color,
      bonus_multiplier: preset.multiplier
    }))
    onChange(presetTiers)
  }

  const getTierIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Medal': return Medal
      case 'Star': return Star
      case 'Crown': return Crown
      case 'Sparkles': return Sparkles
      case 'Trophy': return Trophy
      case 'Zap': return Zap
      default: return Medal
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-orange-400" />
          <div>
            <h3 className="text-lg font-semibold font-poppins">Tiered Rewards</h3>
            <p className="text-sm text-gray-400">Define progressive reward levels based on achievement percentage</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPresets}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Load Presets
          </button>
          <button
            onClick={addTier}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Tier
          </button>
        </div>
      </div>

      {/* Tiers List */}
      {tiers.length === 0 ? (
        <div className="content-card p-12 text-center">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No Tiers Defined</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add tiers to create progressive rewards or load preset tiers
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadPresets}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Load Presets (Bronze → Diamond)
            </button>
            <button
              onClick={addTier}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Custom Tier
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tiers.map((tier, index) => {
            const TierIcon = getTierIcon(tier.badge_icon)
            const isExpanded = expandedTier === tier.id

            return (
              <div
                key={tier.id}
                className="content-card overflow-hidden hover:border-gray-700 transition-colors"
              >
                {/* Tier Header */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Tier Icon */}
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${tier.badge_color}20`, borderColor: tier.badge_color, borderWidth: '2px' }}
                      >
                        <TierIcon className="w-6 h-6" style={{ color: tier.badge_color }} />
                      </div>

                      {/* Tier Info */}
                      <div>
                        <h4 className="font-semibold font-poppins">{tier.tier_name}</h4>
                        <p className="text-sm text-gray-400">
                          {tier.min_percentage}% - {tier.max_percentage}% achievement • ₹{tier.reward_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTier(index, 'up') }}
                          className="p-2 hover:bg-gray-800 rounded transition-colors"
                        >
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      {index < tiers.length - 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); moveTier(index, 'down') }}
                          className="p-2 hover:bg-gray-800 rounded transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTier(tier.id) }}
                        className="p-2 hover:bg-red-900/50 rounded transition-colors text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tier Details (Expanded) */}
                {isExpanded && (
                  <div className="p-4 border-t border-gray-800 bg-gray-800/50">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Tier Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tier Name
                        </label>
                        <input
                          type="text"
                          value={tier.tier_name}
                          onChange={(e) => updateTier(tier.id, { tier_name: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>

                      {/* Tier Code */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tier Code
                        </label>
                        <input
                          type="text"
                          value={tier.tier_code}
                          onChange={(e) => updateTier(tier.id, { tier_code: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>

                      {/* Min Percentage */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Minimum Achievement %
                        </label>
                        <input
                          type="number"
                          value={tier.min_percentage}
                          onChange={(e) => updateTier(tier.id, { min_percentage: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0"
                          max="200"
                        />
                      </div>

                      {/* Max Percentage */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Maximum Achievement %
                        </label>
                        <input
                          type="number"
                          value={tier.max_percentage}
                          onChange={(e) => updateTier(tier.id, { max_percentage: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0"
                          max="200"
                        />
                      </div>

                      {/* Reward Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Reward Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={tier.reward_amount}
                          onChange={(e) => updateTier(tier.id, { reward_amount: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0"
                          step="100"
                        />
                      </div>

                      {/* Bonus Multiplier */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Bonus Multiplier
                        </label>
                        <input
                          type="number"
                          value={tier.bonus_multiplier || 1.0}
                          onChange={(e) => updateTier(tier.id, { bonus_multiplier: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0.1"
                          max="10"
                          step="0.1"
                        />
                      </div>

                      {/* Badge Color */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Badge Color
                        </label>
                        <input
                          type="color"
                          value={tier.badge_color || '#CD7F32'}
                          onChange={(e) => updateTier(tier.id, { badge_color: e.target.value })}
                          className="w-full h-10 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Visual Preview */}
      {tiers.length > 0 && (
        <div className="content-card p-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-4">Progression Preview</h4>
          <div className="relative h-20">
            {/* Progress Bar Background */}
            <div className="absolute inset-0 bg-gray-800 rounded-full overflow-hidden">
              {tiers.map((tier, index) => {
                const TierIcon = getTierIcon(tier.badge_icon)
                const widthPercent = ((tier.max_percentage - tier.min_percentage) / (tiers[tiers.length - 1]?.max_percentage || 100)) * 100
                const leftPercent = (tier.min_percentage / (tiers[tiers.length - 1]?.max_percentage || 100)) * 100

                return (
                  <div
                    key={tier.id}
                    className="absolute h-full flex items-center justify-center transition-all"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: tier.badge_color + '40',
                      borderLeft: index > 0 ? `2px solid ${tier.badge_color}` : 'none'
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <TierIcon className="w-6 h-6" style={{ color: tier.badge_color }} />
                      <span className="text-xs font-semibold mt-1" style={{ color: tier.badge_color }}>
                        {tier.tier_name}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Percentage Markers */}
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
            {tiers[tiers.length - 1]?.max_percentage > 100 && (
              <span>{tiers[tiers.length - 1].max_percentage}%</span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {tiers.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">Rewards Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Total Tiers:</span>
                  <span className="ml-2 font-semibold text-white">{tiers.length}</span>
                </div>
                <div>
                  <span className="text-gray-400">Max Reward:</span>
                  <span className="ml-2 font-semibold text-white">
                    ₹{Math.max(...tiers.map(t => t.reward_amount)).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Achievement Range:</span>
                  <span className="ml-2 font-semibold text-white">
                    {tiers[0]?.min_percentage}% - {tiers[tiers.length - 1]?.max_percentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
