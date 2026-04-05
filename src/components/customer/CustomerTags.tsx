'use client'

import React, { useState, useEffect } from 'react'
import { Tag, X, Plus, Loader2, AlertCircle, Crown, Star, TrendingUp, Shield } from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface CustomerTagsProps {
  customerId: string
}

interface CustomerTag {
  id: string
  tag_name: string
  tag_category: string
  tag_source: 'MANUAL' | 'AUTO' | 'RULE_BASED' | 'AI'
  tag_value: string | null
  confidence_score: number
  expires_at: string | null
  created_at: string
  users?: {
    full_name: string
  }
}

interface CustomerTier {
  tier_name: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE'
  tier_score: number
  total_loan_amount: number
  total_loans: number
  calculated_at: string
}

interface CustomerSegment {
  id: string
  segment_id: string
  joined_at: string
  customer_segments: {
    segment_name: string
    segment_description: string
    segment_category: string
  }
}

export function CustomerTags({ customerId }: CustomerTagsProps) {
  const [tags, setTags] = useState<CustomerTag[]>([])
  const [tier, setTier] = useState<CustomerTier | null>(null)
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState('CUSTOM')

  useEffect(() => {
    fetchTags()
  }, [customerId])

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/superadmin/customer-management/customers/${customerId}/tags`)

      if (!response.ok) {
        throw new Error('Failed to fetch tags')
      }

      const data = await response.json()

      if (data.success) {
        setTags(data.tags || [])
        setTier(data.tier || null)
        setSegments(data.segments || [])
        setError(null)
      } else {
        throw new Error(data.error || 'Failed to fetch tags')
      }
    } catch (err) {
      console.error('Error fetching tags:', err)
      setError('Failed to load tags')
      clientLogger.error('Failed to fetch customer tags', { customerId, error: err })
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = async () => {
    if (!newTagName.trim()) return

    try {
      setIsAddingTag(true)
      const response = await fetch(`/api/superadmin/customer-management/customers/${customerId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: newTagName.trim(),
          tag_category: newTagCategory,
          confidence_score: 100
        })
      })

      const data = await response.json()

      if (data.success) {
        setTags([data.tag, ...tags])
        setNewTagName('')
        setError(null)
      } else {
        setError(data.error || 'Failed to add tag')
      }
    } catch (err) {
      console.error('Error adding tag:', err)
      setError('Failed to add tag')
      clientLogger.error('Failed to add customer tag', { customerId, error: err })
    } finally {
      setIsAddingTag(false)
    }
  }

  const removeTag = async (tagName: string) => {
    try {
      const response = await fetch(
        `/api/superadmin/customer-management/customers/${customerId}/tags?tag_name=${encodeURIComponent(tagName)}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (data.success) {
        setTags(tags.filter(t => t.tag_name !== tagName))
        setError(null)
      } else {
        setError(data.error || 'Failed to remove tag')
      }
    } catch (err) {
      console.error('Error removing tag:', err)
      setError('Failed to remove tag')
      clientLogger.error('Failed to remove customer tag', { customerId, tagName, error: err })
    }
  }

  const getTagCategoryColor = (category: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      BEHAVIORAL: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
      FINANCIAL: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      RISK: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
      LIFECYCLE: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      CUSTOM: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' }
    }
    return colors[category] || colors.CUSTOM
  }

  const getTierIcon = (tierName: string) => {
    switch (tierName) {
      case 'PLATINUM': return Crown
      case 'GOLD': return Star
      case 'SILVER': return TrendingUp
      case 'BRONZE': return Shield
      default: return Tag
    }
  }

  const getTierColor = (tierName: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      PLATINUM: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      GOLD: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
      SILVER: { bg: 'bg-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/30' },
      BRONZE: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' }
    }
    return colors[tierName] || colors.BRONZE
  }

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Customer Tier */}
      {tier && (
        <div className="bg-gradient-to-br from-orange-900/20 to-orange-950/20 rounded-xl p-6 border border-orange-700/30">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            {React.createElement(getTierIcon(tier.tier_name), { className: 'w-5 h-5 text-orange-400' })}
            <span>Customer Tier</span>
          </h3>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold border ${getTierColor(tier.tier_name).bg} ${getTierColor(tier.tier_name).text} ${getTierColor(tier.tier_name).border}`}>
                {React.createElement(getTierIcon(tier.tier_name), { className: 'w-4 h-4' })}
                <span>{tier.tier_name}</span>
              </span>
              <div className="text-gray-400 text-sm">
                Score: <span className="text-white font-semibold">{tier.tier_score}</span>
              </div>
            </div>

            <div className="flex space-x-6 text-sm">
              <div>
                <div className="text-gray-400">Total Loans</div>
                <div className="text-white font-semibold">{tier.total_loans}</div>
              </div>
              <div>
                <div className="text-gray-400">Total Amount</div>
                <div className="text-white font-semibold">₹{tier.total_loan_amount?.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tags Section */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Tag className="w-5 h-5 text-orange-400" />
            <span>Customer Tags</span>
            <span className="text-sm text-gray-400 font-normal">({tags.length})</span>
          </h3>
        </div>

        {/* Add Tag Form */}
        <div className="mb-4 flex space-x-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTag()}
            placeholder="Add tag (e.g., HIGH_VALUE)"
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={isAddingTag}
          />
          <select
            value={newTagCategory}
            onChange={(e) => setNewTagCategory(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            disabled={isAddingTag}
          >
            <option value="CUSTOM">Custom</option>
            <option value="BEHAVIORAL">Behavioral</option>
            <option value="FINANCIAL">Financial</option>
            <option value="RISK">Risk</option>
            <option value="LIFECYCLE">Lifecycle</option>
          </select>
          <button
            onClick={addTag}
            disabled={isAddingTag || !newTagName.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingTag ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Add</span>
          </button>
        </div>

        {/* Tags List */}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const colors = getTagCategoryColor(tag.tag_category)
              return (
                <div
                  key={tag.id}
                  className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  <Tag className="w-3 h-3" />
                  <span className="font-medium">{tag.tag_name}</span>
                  {tag.tag_source !== 'MANUAL' && (
                    <span className="text-xs opacity-75">({tag.tag_source})</span>
                  )}
                  {tag.tag_source === 'MANUAL' && (
                    <button
                      onClick={() => removeTag(tag.tag_name)}
                      className="hover:opacity-75 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No tags yet. Add tags to categorize this customer.</p>
          </div>
        )}
      </div>

      {/* Segments Section */}
      {segments.length > 0 && (
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            <span>Customer Segments</span>
            <span className="text-sm text-gray-400 font-normal">({segments.length})</span>
          </h3>

          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">
                      {segment.customer_segments.segment_name}
                    </h4>
                    {segment.customer_segments.segment_description && (
                      <p className="text-gray-400 text-sm mb-2">
                        {segment.customer_segments.segment_description}
                      </p>
                    )}
                    <span className="text-xs text-gray-500">
                      Joined: {new Date(segment.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium">
                    {segment.customer_segments.segment_category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
