'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  Users,
  Search,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  DollarSign,
  Calendar,
  User,
  ChevronRight,
  Award,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import StatusIndicator from '@/components/partners/shared/StatusIndicator'
import type { BATeamMember } from '@/types/bp-profile'
import { cn, formatCurrency} from '@/lib/utils/cn'

interface MyTeamSectionProps {
  teamMembers: BATeamMember[]
  isLoading?: boolean
  onViewDetails?: (member: BATeamMember) => void
}

// Team Member Card Component
function TeamMemberCard({
  member,
  onClick,
}: {
  member: BATeamMember
  onClick: () => void
}) {
  const getPerformanceColor = (rating: BATeamMember['performance_rating']) => {
    switch (rating) {
      case 'EXCELLENT':
        return 'text-green-400 bg-green-500/10 border-green-500/30'
      case 'GOOD':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
      case 'AVERAGE':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
      case 'POOR':
        return 'text-red-400 bg-red-500/10 border-red-500/30'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    }
  }

  return (
    <div
      onClick={onClick}
      className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-xl hover:border-orange-500/50 hover:bg-gray-800/50 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-700/50 border-2 border-gray-600">
            {member.profile_photo_url ? (
              <Image
                src={member.profile_photo_url}
                alt={member.full_name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-7 h-7 text-gray-400" />
              </div>
            )}
          </div>
          {/* Status Dot */}
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-gray-900',
              member.status === 'ACTIVE' && 'bg-green-500',
              member.status === 'INACTIVE' && 'bg-gray-500',
              member.status === 'SUSPENDED' && 'bg-red-500',
              member.status === 'PENDING' && 'bg-yellow-500'
            )}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-white font-medium truncate">{member.full_name}</h4>
            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" />
          </div>

          <p className="text-gray-400 text-sm mb-2">{member.ba_id}</p>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              <TrendingUp className="w-3 h-3 inline mr-1" />
              {member.conversion_rate.toFixed(1)}%
            </span>
            <span className="text-gray-500">
              <DollarSign className="w-3 h-3 inline mr-1" />
              {formatCurrency(member.total_commission_earned)}
            </span>
          </div>

          {/* Performance Badge */}
          {member.performance_rating && (
            <Badge
              className={cn('mt-2 text-xs', getPerformanceColor(member.performance_rating))}
            >
              {member.performance_rating}
            </Badge>
          )}
        </div>
      </div>

      {/* Location */}
      {(member.city || member.state) && (
        <div className="mt-3 pt-3 border-t border-gray-700/30 flex items-center gap-2 text-gray-500 text-xs">
          <MapPin className="w-3 h-3" />
          <span>
            {[member.city, member.state].filter(Boolean).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

// Team Member Detail Modal
function TeamMemberDetailModal({
  member,
  onClose,
}: {
  member: BATeamMember | null
  onClose: () => void
}) {
  if (!member) return null

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700/50 p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700/50 border-2 border-orange-500/30">
                {member.profile_photo_url ? (
                  <Image
                    src={member.profile_photo_url}
                    alt={member.full_name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-400" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">{member.full_name}</h3>
                <p className="text-gray-400 text-sm">{member.ba_id}</p>
                <StatusIndicator
                  status={member.status.toLowerCase() as 'active' | 'inactive' | 'suspended' | 'pending'}
                  label={member.status}
                  size="sm"
                  variant="pill"
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="text-gray-400 text-sm mb-3 font-medium">Contact Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <Phone className="w-4 h-4 text-orange-400" />
                <span className="text-white">{member.mobile_number}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                <Mail className="w-4 h-4 text-orange-400" />
                <span className="text-white">{member.email_id}</span>
              </div>
              {(member.city || member.state) && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                  <MapPin className="w-4 h-4 text-orange-400" />
                  <span className="text-white">
                    {[member.city, member.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Stats */}
          <div>
            <h4 className="text-gray-400 text-sm mb-3 font-medium">Performance</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-gray-800/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-white">
                  {member.total_leads_submitted}
                </p>
                <p className="text-gray-400 text-xs mt-1">Leads Submitted</p>
              </div>
              <div className="p-4 bg-gray-800/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">
                  {member.total_leads_converted}
                </p>
                <p className="text-gray-400 text-xs mt-1">Leads Converted</p>
              </div>
              <div className="p-4 bg-gray-800/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-400">
                  {member.conversion_rate.toFixed(1)}%
                </p>
                <p className="text-gray-400 text-xs mt-1">Conversion Rate</p>
              </div>
              <div className="p-4 bg-gray-800/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(member.total_commission_earned)}
                </p>
                <p className="text-gray-400 text-xs mt-1">Commission Earned</p>
              </div>
            </div>
          </div>

          {/* Performance Rating */}
          {member.performance_rating && (
            <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-orange-400" />
                <span className="text-gray-400">Performance Rating</span>
              </div>
              <Badge
                className={cn(
                  member.performance_rating === 'EXCELLENT' &&
                    'bg-green-500/20 text-green-400 border-green-500/30',
                  member.performance_rating === 'GOOD' &&
                    'bg-blue-500/20 text-blue-400 border-blue-500/30',
                  member.performance_rating === 'AVERAGE' &&
                    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                  member.performance_rating === 'POOR' &&
                    'bg-red-500/20 text-red-400 border-red-500/30'
                )}
              >
                {member.performance_rating}
              </Badge>
            </div>
          )}

          {/* Dates */}
          <div>
            <h4 className="text-gray-400 text-sm mb-3 font-medium">Activity</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  <span className="text-gray-400 text-sm">Onboarded</span>
                </div>
                <span className="text-white text-sm">
                  {formatDate(member.onboarding_date)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                  <span className="text-gray-400 text-sm">Last Lead</span>
                </div>
                <span className="text-white text-sm">
                  {formatDate(member.last_lead_date)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MyTeamSection({
  teamMembers,
  isLoading = false,
  onViewDetails,
}: MyTeamSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedMember, setSelectedMember] = useState<BATeamMember | null>(null)

  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.ba_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email_id.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleMemberClick = (member: BATeamMember) => {
    setSelectedMember(member)
    onViewDetails?.(member)
  }

  if (isLoading) {
    return (
      <CollapsibleSection title="My Team" icon={Users}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          <span className="ml-3 text-gray-400">Loading team members...</span>
        </div>
      </CollapsibleSection>
    )
  }

  return (
    <>
      <CollapsibleSection
        title="My Team"
        icon={Users}
        badge={
          teamMembers.length > 0
            ? { text: `${teamMembers.length} Associates`, variant: 'info' }
            : undefined
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
            asChild
          >
            <a href="/partners/bp/my-team">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </a>
          </Button>
        }
      >
        <div className="space-y-4 mt-4">
          {/* Search and Filter */}
          {teamMembers.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800/50 text-white pl-10 pr-4 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800/50 text-white px-3 py-2.5 rounded-lg border border-gray-700/50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>
          )}

          {/* Team Members Grid */}
          {filteredMembers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.slice(0, 6).map((member) => (
                <TeamMemberCard
                  key={member.ba_id}
                  member={member}
                  onClick={() => handleMemberClick(member)}
                />
              ))}
            </div>
          ) : teamMembers.length > 0 ? (
            <div className="text-center py-8 bg-gray-800/30 rounded-lg">
              <Search className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium">No matches found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your search or filter criteria
              </p>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-800/30 rounded-lg">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">No Team Members Yet</p>
              <p className="text-gray-400 text-sm mb-4">
                Start building your team by onboarding Business Associates.
              </p>
              <Button
                variant="outline"
                className="border-orange-500 text-orange-400 hover:bg-orange-500/10"
                asChild
              >
                <a href="/partners/bp/my-team">
                  <Users className="w-4 h-4 mr-2" />
                  Go to My Team
                </a>
              </Button>
            </div>
          )}

          {/* View All Link */}
          {filteredMembers.length > 6 && (
            <div className="text-center pt-4">
              <a
                href="/partners/bp/my-team"
                className="text-orange-400 hover:text-orange-300 text-sm font-medium inline-flex items-center gap-1"
              >
                View all {teamMembers.length} team members
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Detail Modal */}
      {selectedMember && (
        <TeamMemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </>
  )
}
