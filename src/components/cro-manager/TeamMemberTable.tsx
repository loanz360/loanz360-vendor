'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Eye } from 'lucide-react'
import type { CROTeamMember } from '@/types/cro-manager'

interface TeamMemberTableProps {
  members: CROTeamMember[]
  onViewMember?: (member: CROTeamMember) => void
  showState?: boolean
  loading?: boolean
  emptyMessage?: string
}

type SortField = 'name' | 'callsToday' | 'activeLeads' | 'conversionRate' | 'state'
type SortDir = 'asc' | 'desc'

export default function TeamMemberTable({
  members,
  onViewMember,
  showState = true,
  loading = false,
  emptyMessage = 'No team members found',
}: TeamMemberTableProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...members].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'name':
        return dir * (`${a.firstName} ${a.lastName}`).localeCompare(`${b.firstName} ${b.lastName}`)
      case 'callsToday':
        return dir * ((a.metrics?.callsToday || 0) - (b.metrics?.callsToday || 0))
      case 'activeLeads':
        return dir * ((a.metrics?.activeLeads || 0) - (b.metrics?.activeLeads || 0))
      case 'conversionRate':
        return dir * ((a.metrics?.conversionRate || 0) - (b.metrics?.conversionRate || 0))
      case 'state':
        return dir * (a.state || '').localeCompare(b.state || '')
      default:
        return 0
    }
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 text-gray-600" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-orange-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-orange-500" />
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400">Loading team members...</span>
        </div>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th
                className="px-4 py-3 text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-orange-400"
                onClick={() => toggleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name <SortIcon field="name" />
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Phone</th>
              {showState && (
                <th
                  className="px-4 py-3 text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-orange-400"
                  onClick={() => toggleSort('state')}
                >
                  <div className="flex items-center gap-1">
                    State <SortIcon field="state" />
                  </div>
                </th>
              )}
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Contacts</th>
              <th
                className="px-4 py-3 text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-orange-400"
                onClick={() => toggleSort('activeLeads')}
              >
                <div className="flex items-center gap-1">
                  Leads <SortIcon field="activeLeads" />
                </div>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Deals</th>
              <th
                className="px-4 py-3 text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-orange-400"
                onClick={() => toggleSort('callsToday')}
              >
                <div className="flex items-center gap-1">
                  Calls Today <SortIcon field="callsToday" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-orange-400"
                onClick={() => toggleSort('conversionRate')}
              >
                <div className="flex items-center gap-1">
                  Conv. Rate <SortIcon field="conversionRate" />
                </div>
              </th>
              {onViewMember && (
                <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.userId}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.phone || '-'}</td>
                {showState && (
                  <td className="px-4 py-3 text-sm text-gray-300">{member.state || '-'}</td>
                )}
                <td className="px-4 py-3 text-sm text-gray-300">{member.metrics?.activeContacts || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.metrics?.activeLeads || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.metrics?.activeDeals || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{member.metrics?.callsToday || 0}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-medium ${
                      (member.metrics?.conversionRate || 0) >= 20
                        ? 'text-green-400'
                        : (member.metrics?.conversionRate || 0) >= 10
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {(member.metrics?.conversionRate || 0).toFixed(1)}%
                  </span>
                </td>
                {onViewMember && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewMember(member)}
                      className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
