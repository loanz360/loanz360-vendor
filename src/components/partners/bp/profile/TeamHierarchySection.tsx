'use client'

import React from 'react'
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Calendar,
  Settings,
  TrendingUp,
  Award,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import CollapsibleSection from '@/components/partners/shared/CollapsibleSection'
import { SwitchField } from '@/components/partners/shared/FormField'
import type { BPTeamHierarchy } from '@/types/bp-profile'
import { cn } from '@/lib/utils/cn'

interface TeamHierarchySectionProps {
  data: BPTeamHierarchy | null
  onSettingsChange?: (field: string, value: boolean | string) => void
  isEditing: boolean
}

export default function TeamHierarchySection({
  data,
  onSettingsChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isEditing,
}: TeamHierarchySectionProps) {
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const teamStats = [
    {
      label: 'Total Associates',
      value: data?.total_business_associates || 0,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Active',
      value: data?.active_associates_count || 0,
      icon: UserCheck,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Inactive',
      value: data?.inactive_associates_count || 0,
      icon: UserX,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
    },
    {
      label: 'Suspended',
      value: data?.suspended_associates_count || 0,
      icon: UserX,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
  ]

  return (
    <CollapsibleSection
      title="Team & Hierarchy"
      icon={Users}
      badge={
        data?.total_business_associates && data.total_business_associates > 0
          ? { text: `${data.total_business_associates} Associates`, variant: 'info' }
          : { text: 'No Team', variant: 'default' }
      }
    >
      <div className="space-y-6 mt-4">
        {/* Team Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {teamStats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                'p-4 rounded-lg border border-gray-700/50',
                stat.bgColor
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-gray-800/50')}>
                  <stat.icon className={cn('w-5 h-5', stat.color)} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{stat.label}</p>
                  <p className={cn('text-2xl font-bold', stat.color)}>
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Team Timeline */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            Team Timeline
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-orange-400" />
                <span className="text-gray-400 text-sm">Team Lead Since</span>
              </div>
              <p className="text-white font-medium">
                {formatDate(data?.team_lead_since)}
              </p>
            </div>

            <div className="p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-green-400" />
                <span className="text-gray-400 text-sm">First Associate Onboarded</span>
              </div>
              <p className="text-white font-medium">
                {formatDate(data?.date_first_associate_onboarded)}
              </p>
            </div>

            <div className="p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-gray-400 text-sm">Last Onboarding</span>
              </div>
              <p className="text-white font-medium">
                {formatDate(data?.last_associate_onboarded_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Onboarding Rights & Settings */}
        <div className="border-t border-gray-700/50 pt-6">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-orange-400" />
            Onboarding Settings
          </h4>

          <div className="space-y-4">
            <SwitchField
              label="Associate Onboarding Rights"
              description="Can you onboard new Business Associates to your team?"
              icon={UserPlus}
              value={data?.associate_onboarding_rights || false}
              onChange={(v) => onSettingsChange?.('associate_onboarding_rights', v)}
              isEditing={false} // Read-only - controlled by admin
            />

            <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <Settings className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Associate Approval Flow</p>
                  <p className="text-gray-400 text-sm">
                    How new associate applications are processed
                  </p>
                </div>
              </div>
              <Badge
                className={cn(
                  data?.associate_approval_flow === 'AUTO'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                )}
              >
                {data?.associate_approval_flow === 'AUTO' ? 'Auto Approval' : 'Manual Review'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Team Performance Summary (Read-Only) */}
        {data && data.total_business_associates > 0 && (
          <div className="border-t border-gray-700/50 pt-6">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-orange-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium mb-1">Team Performance</p>
                  <p className="text-gray-400 text-sm">
                    View detailed performance metrics and individual associate stats in the
                    <a href="/partners/bp/my-team-performance" className="text-orange-400 hover:underline ml-1">
                      My Team Performance
                    </a> section.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Team Message */}
        {(!data || data.total_business_associates === 0) && (
          <div className="border-t border-gray-700/50 pt-6">
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-6 text-center">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-2">No Team Members Yet</p>
              <p className="text-gray-400 text-sm mb-4">
                Start building your team by onboarding Business Associates.
              </p>
              {data?.associate_onboarding_rights && (
                <a
                  href="/partners/bp/my-team"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Onboard Associates
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
