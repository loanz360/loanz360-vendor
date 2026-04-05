'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Building2, ChevronDown, ChevronUp, Plus, Users, Shield,
  CheckCircle, Clock, AlertCircle, Loader2, ExternalLink,
  MoreHorizontal, FileText, Percent, BadgeCheck, XCircle
} from 'lucide-react'
import { clientLogger } from '@/lib/utils/client-logger'

interface EntityType {
  id: string
  code: string
  name: string
  short_name: string | null
  category: string
  icon: string | null
  color: string | null
}

interface Entity {
  id: string
  display_id: string
  legal_name: string
  trading_name: string | null
  registration_number: string | null
  pan_number: string | null
  gstin: string | null
  business_address_city: string | null
  business_address_state: string | null
  profile_completion_percentage: number
  verification_status: string
  is_active: boolean
  entity_types: EntityType
}

interface EntityLink {
  linkId: string
  role: {
    code: string
    name: string
  }
  ownership_percentage: number | null
  permissions: {
    is_primary_contact: boolean
    can_apply_loan: boolean
    can_view_financials: boolean
    can_manage_members: boolean
    can_sign_documents: boolean
  }
  consent: {
    status: string
    date: string | null
  }
  status: string
  joined_at: string
  entity: Entity
}

interface MyEntitiesSectionProps {
  onAddEntity?: () => void
  onEntityClick?: (entity: Entity) => void
  className?: string
}

export default function MyEntitiesSection({
  onAddEntity,
  onEntityClick,
  className = ''
}: MyEntitiesSectionProps) {
  const [expanded, setExpanded] = useState(true)
  const [entities, setEntities] = useState<EntityLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState({ total: 0, active: 0, pendingConsent: 0 })

  const fetchEntities = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/customers/individual/entities', {
        credentials: 'include'
      })

      const data = await response.json()

      if (data.success) {
        setEntities(data.entities || [])
        setStatistics(data.statistics || { total: 0, active: 0, pendingConsent: 0 })
      } else {
        setError(data.error || 'Failed to load entities')
      }
    } catch (err) {
      clientLogger.error('Error fetching entities', { error: err })
      setError('Failed to load entities')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  const getCategoryColor = (category: string | undefined) => {
    const colorMap: Record<string, string> = {
      INDIVIDUAL: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PARTNERSHIP: 'bg-green-500/20 text-green-400 border-green-500/30',
      CORPORATE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      TRUST_NGO: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      COOPERATIVE: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      JOINT_VENTURE: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    }
    return colorMap[category || ''] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
            <BadgeCheck className="w-3 h-3" /> Verified
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
            <AlertCircle className="w-3 h-3" /> {status}
          </span>
        )
    }
  }

  const getConsentBadge = (status: string) => {
    switch (status) {
      case 'GRANTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
            <CheckCircle className="w-3 h-3" /> Consent Given
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
            <Clock className="w-3 h-3" /> Consent Pending
          </span>
        )
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
            <XCircle className="w-3 h-3" /> Consent Revoked
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className={`content-card rounded-xl border border-gray-700 overflow-hidden ${className}`}>
      {/* Header - Always visible, clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">My Entities</h3>
            <p className="text-sm text-gray-400">
              {statistics.total === 0
                ? 'No entities linked'
                : `${statistics.active} active${statistics.pendingConsent > 0 ? `, ${statistics.pendingConsent} pending` : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statistics.total > 0 && (
            <span className="px-2 py-1 bg-gray-800 text-gray-300 text-sm rounded-lg">
              {statistics.total} {statistics.total === 1 ? 'entity' : 'entities'}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content - Collapsible */}
      {expanded && (
        <div className="p-4 border-t border-gray-800">
          {/* Error State */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && entities.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-white mb-2">No Entities Yet</h4>
              <p className="text-gray-400 text-sm mb-4">
                Add your business entities like Proprietorship, Partnership, Company, etc.
              </p>
              {onAddEntity && (
                <button
                  onClick={onAddEntity}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Entity
                </button>
              )}
            </div>
          )}

          {/* Entities List */}
          {!loading && entities.length > 0 && (
            <div className="space-y-3">
              {entities.map((link) => (
                <div
                  key={link.linkId}
                  className={`p-4 rounded-lg border transition-all hover:border-gray-600 cursor-pointer ${
                    link.status === 'ACTIVE'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-gray-800/30 border-yellow-500/30'
                  }`}
                  onClick={() => onEntityClick?.(link.entity)}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Entity Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white truncate">
                          {link.entity.legal_name}
                        </h4>
                        {link.entity.trading_name && link.entity.trading_name !== link.entity.legal_name && (
                          <span className="text-gray-500 text-sm truncate">
                            ({link.entity.trading_name})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded border ${getCategoryColor(link.entity.entity_types?.category)}`}>
                          {link.entity.entity_types?.short_name || link.entity.entity_types?.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {link.entity.display_id}
                        </span>
                        {getVerificationBadge(link.entity.verification_status)}
                        {link.status !== 'ACTIVE' && getConsentBadge(link.consent.status)}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {link.role.name}
                        </span>
                        {link.ownership_percentage && (
                          <span className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {link.ownership_percentage}% ownership
                          </span>
                        )}
                        {link.entity.business_address_city && (
                          <span>
                            {link.entity.business_address_city}
                            {link.entity.business_address_state && `, ${link.entity.business_address_state}`}
                          </span>
                        )}
                      </div>

                      {/* Permissions badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {link.permissions.can_apply_loan && (
                          <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                            Loan
                          </span>
                        )}
                        {link.permissions.can_view_financials && (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded">
                            Financials
                          </span>
                        )}
                        {link.permissions.can_manage_members && (
                          <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-xs rounded">
                            Members
                          </span>
                        )}
                        {link.permissions.can_sign_documents && (
                          <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 text-xs rounded">
                            Sign
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Profile Completion */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">
                          {link.entity.profile_completion_percentage || 0}%
                        </p>
                        <p className="text-xs text-gray-500">Complete</p>
                      </div>
                      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500 rounded-full transition-all"
                          style={{ width: `${link.entity.profile_completion_percentage || 0}%` }}
                        />
                      </div>
                      <button className="p-1 text-gray-400 hover:text-white rounded">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Entity Button */}
              {onAddEntity && (
                <button
                  onClick={onAddEntity}
                  className="w-full p-4 rounded-lg border-2 border-dashed border-gray-700 hover:border-orange-500/50 text-gray-400 hover:text-orange-400 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Entity
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
