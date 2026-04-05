'use client'

import React from 'react'
import { Activity } from 'lucide-react'

interface ActivityItem {
  id: string
  application_id: string
  app_id?: string
  partner_type?: string
  previous_status: string
  new_status: string
  changed_by?: string
  changed_by_name: string
  changed_by_role: string
  notes: string | null
  created_at: string
  source?: string
}

interface Props {
  recentActivity: ActivityItem[]
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  ACCOUNTS_VERIFICATION: 'In Verification',
  ACCOUNTS_VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  ON_HOLD: 'On Hold',
  SA_APPROVED: 'SA Approved',
  FINANCE_PROCESSING: 'Finance Processing',
  PAYOUT_CREDITED: 'Payout Credited',
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function getStatusDotColor(status: string): string {
  if (status === 'ACCOUNTS_VERIFIED') return 'bg-green-400'
  if (status === 'REJECTED') return 'bg-red-400'
  if (status === 'ON_HOLD') return 'bg-orange-400'
  if (status === 'ACCOUNTS_VERIFICATION') return 'bg-blue-400'
  if (status === 'SA_APPROVED') return 'bg-emerald-400'
  return 'bg-gray-400'
}

function getSourceBadge(source: string): { bg: string; text: string } {
  if (source === 'CP') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400' }
  if (source === 'BA') return { bg: 'bg-orange-500/20', text: 'text-orange-400' }
  return { bg: 'bg-purple-500/20', text: 'text-purple-400' }
}

export default function TeamActivityFeed({ recentActivity }: Props) {
  return (
    <div className="frosted-card p-6 rounded-lg">
      <h2 className="text-lg font-bold mb-4 font-poppins text-white flex items-center gap-2">
        <Activity className="w-5 h-5 text-orange-500" />
        Team Activity
      </h2>
      {recentActivity.length > 0 ? (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {recentActivity.map((item) => {
            const badge = item.source ? getSourceBadge(item.source) : null
            return (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800 hover:bg-gray-800/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getStatusDotColor(item.new_status)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white flex items-center gap-2 flex-wrap">
                    {badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}>
                        {item.source}
                      </span>
                    )}
                    <span className="text-gray-400">{STATUS_LABELS[item.previous_status] || item.previous_status.replace(/_/g, ' ')}</span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className="font-medium">{STATUS_LABELS[item.new_status] || item.new_status.replace(/_/g, ' ')}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.changed_by_name} &bull; {formatTime(item.created_at)}
                    {item.app_id && <span className="text-gray-600 ml-1">({item.app_id})</span>}
                  </p>
                  {item.notes && <p className="text-xs text-gray-400 mt-1 truncate">{item.notes}</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No recent team activity</p>
        </div>
      )}
    </div>
  )
}
