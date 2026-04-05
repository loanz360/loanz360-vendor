'use client'

import React, { useEffect, useState } from 'react'
import { Users, User, BadgeCheck, Shield, ChevronDown, ChevronUp } from 'lucide-react'

interface EntityMember {
  id: string
  full_name: string
  role: string
  designation?: string
  email?: string
  phone?: string
  shareholding_percentage?: number
  can_sign_documents?: boolean
  can_apply_for_loans?: boolean
  can_manage_entity?: boolean
  is_primary_contact?: boolean
  kyc_status?: string
  profile_photo_url?: string | null
  joining_date?: string
}

interface ProfileMembersSectionProps {
  profileId: string
  entityType?: string
}

// Map entity types to their member terminology
const MEMBER_LABELS: Record<string, string> = {
  PARTNERSHIP: 'Partners',
  PARTNERSHIP_REGISTERED: 'Partners',
  PARTNERSHIP_UNREGISTERED: 'Partners',
  LLP: 'Designated Partners',
  PRIVATE_LIMITED: 'Directors & Shareholders',
  PUBLIC_LIMITED: 'Directors & Shareholders',
  PUBLIC_LIMITED_LISTED: 'Directors & Shareholders',
  PUBLIC_LIMITED_UNLISTED: 'Directors & Shareholders',
  OPC: 'Director & Nominee',
  HUF: 'Members',
  TRUST_PRIVATE: 'Trustees',
  TRUST_CHARITABLE: 'Trustees',
  SOCIETY: 'Committee Members',
  COOPERATIVE: 'Board Members',
  PROPRIETORSHIP: 'Proprietor',
}

const ROLE_COLORS: Record<string, string> = {
  PARTNER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  DESIGNATED_PARTNER: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  DIRECTOR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  SHAREHOLDER: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  PROPRIETOR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  TRUSTEE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  KARTA: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  NOMINEE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  MEMBER: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  SECRETARY: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  MANAGING_DIRECTOR: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const INITIAL_SHOW = 3

export default function ProfileMembersSection({ profileId, entityType }: ProfileMembersSectionProps) {
  const [members, setMembers] = useState<EntityMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    async function fetchMembers() {
      try {
        setLoading(true)
        const response = await fetch(`/api/customers/profiles/${profileId}/members`)
        const data = await response.json()

        if (data.success) {
          setMembers(data.members || [])
        } else {
          setError(data.error || 'Failed to load members')
        }
      } catch {
        setError('Failed to load members')
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [profileId])

  const sectionTitle = MEMBER_LABELS[entityType || ''] || 'Members'
  const displayMembers = showAll ? members : members.slice(0, INITIAL_SHOW)
  const hasMore = members.length > INITIAL_SHOW

  if (loading) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <Users className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
          <Users className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-white">{sectionTitle}</h3>
        </div>
        {members.length > 0 && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        )}
      </div>
      <div className="p-6">
        {members.length === 0 ? (
          <div className="text-center py-6 bg-gray-800/30 rounded-xl">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No members found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {displayMembers.map((member) => {
                const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.MEMBER
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/40 border border-gray-700/40 hover:border-gray-600/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {member.profile_photo_url ? (
                        <img src={member.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-gray-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{member.full_name}</span>
                        {member.kyc_status === 'VERIFIED' && (
                          <BadgeCheck className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        )}
                        {member.is_primary_contact && (
                          <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Primary</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${roleColor}`}>
                          {member.designation || member.role.replace(/_/g, ' ')}
                        </span>
                        {member.shareholding_percentage != null && member.shareholding_percentage > 0 && (
                          <span className="text-[10px] text-gray-500">{member.shareholding_percentage}% share</span>
                        )}
                      </div>
                    </div>

                    {/* Permissions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {member.can_sign_documents && (
                        <span className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center" title="Can sign documents">
                          <Shield className="w-3 h-3 text-green-400" />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Show more/less */}
            {hasMore && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="flex items-center gap-1.5 mx-auto mt-4 text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    View All {members.length} Members
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
