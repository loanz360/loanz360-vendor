'use client'

import React from 'react'
import { Users, CheckCircle, Clock, XCircle, ArrowUpRight } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
  email: string
  sub_role: string
  status: string
  last_login_at: string | null
  today: { picked_up: number; verified: number; rejected: number }
  monthly: { picked_up: number; verified: number; rejected: number }
}

interface Props {
  teamPerformance: TeamMember[]
  teamSize: number
}

export default function TeamPerformanceTable({ teamPerformance, teamSize }: Props) {
  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 5) return 'Online'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getStatusDot = (lastLogin: string | null) => {
    if (!lastLogin) return 'bg-gray-500'
    const diff = Date.now() - new Date(lastLogin).getTime()
    if (diff < 5 * 60000) return 'bg-green-400 animate-pulse' // Online < 5min
    if (diff < 60 * 60000) return 'bg-yellow-400' // Active < 1hr
    return 'bg-gray-500' // Offline
  }

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          Team Performance
        </h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{teamSize} members</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-gray-400 font-medium">Member</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium" title="Picked up today">
                <Clock className="w-3.5 h-3.5 inline text-blue-400" />
              </th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium" title="Verified today">
                <CheckCircle className="w-3.5 h-3.5 inline text-green-400" />
              </th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium" title="Rejected today">
                <XCircle className="w-3.5 h-3.5 inline text-red-400" />
              </th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium" title="Monthly verified">
                <ArrowUpRight className="w-3.5 h-3.5 inline text-emerald-400" />
              </th>
              <th className="text-right py-2 px-3 text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {teamPerformance.map((member) => (
              <tr key={member.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(member.last_login_at)}`} />
                    <div>
                      <p className="text-white font-medium text-sm">{member.name}</p>
                      <p className="text-gray-500 text-xs">
                        {member.sub_role === 'ACCOUNTS_MANAGER' ? 'Manager' : 'Executive'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="text-blue-300 font-medium">{member.today.picked_up}</span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="text-green-300 font-medium">{member.today.verified}</span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="text-red-300 font-medium">{member.today.rejected}</span>
                </td>
                <td className="text-center py-3 px-2">
                  <span className="text-emerald-300 font-medium">{member.monthly.verified}</span>
                </td>
                <td className="text-right py-3 px-3">
                  <span className="text-xs text-gray-500">{formatLastSeen(member.last_login_at)}</span>
                </td>
              </tr>
            ))}
            {teamPerformance.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-gray-500 text-sm">No team members found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
