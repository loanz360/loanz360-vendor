'use client'

import React, { useState } from 'react'
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface OverdueApp {
  id: string
  app_id: string
  customer_name: string
  bank_name: string
  amount: number
  type: 'CP' | 'BA' | 'BP'
  status: string
  created_at: string
  age_hours: number
}

interface AgingHeatmap {
  bucket_1_2: { cp: number; ba: number; bp: number }
  bucket_3_4: { cp: number; ba: number; bp: number }
  bucket_5_6: { cp: number; ba: number; bp: number }
  bucket_7_plus: { cp: number; ba: number; bp: number }
}

interface Props {
  overdueApps: OverdueApp[]
  agingHeatmap: AgingHeatmap
  totalOverdue: number
  onViewAudit?: (applicationId: string, appType: 'CP' | 'BA' | 'BP', label: string) => void
}

function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function getAgeSeverity(hours: number): string {
  if (hours >= 168) return 'text-red-400 bg-red-500/20' // 7+ days
  if (hours >= 120) return 'text-red-300 bg-red-500/15' // 5+ days
  if (hours >= 72) return 'text-orange-400 bg-orange-500/20' // 3+ days
  return 'text-yellow-400 bg-yellow-500/20'
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

export default function SLAOverduePanel({ overdueApps, agingHeatmap, totalOverdue, onViewAudit }: Props) {
  const [expanded, setExpanded] = useState(false)

  const buckets = [
    { label: '1-2 days', data: agingHeatmap.bucket_1_2, color: 'bg-green-500/40', textColor: 'text-green-400' },
    { label: '3-4 days', data: agingHeatmap.bucket_3_4, color: 'bg-yellow-500/40', textColor: 'text-yellow-400' },
    { label: '5-6 days', data: agingHeatmap.bucket_5_6, color: 'bg-orange-500/40', textColor: 'text-orange-400' },
    { label: '7+ days', data: agingHeatmap.bucket_7_plus, color: 'bg-red-500/40', textColor: 'text-red-400' },
  ]

  const types = ['cp', 'ba', 'bp'] as const
  const typeLabels = { cp: 'CP', ba: 'BA', bp: 'BP' }

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          SLA & Aging Analysis
        </h2>
        {totalOverdue > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-medium">
            {totalOverdue} overdue
          </span>
        )}
      </div>

      {/* Aging Heatmap Grid */}
      <div className="mb-4">
        <div className="grid grid-cols-5 gap-1 text-xs">
          <div className="p-2" />
          {buckets.map(b => (
            <div key={b.label} className={`p-2 text-center font-medium ${b.textColor}`}>
              {b.label}
            </div>
          ))}
          {types.map(type => (
            <React.Fragment key={type}>
              <div className="p-2 text-gray-400 font-medium">{typeLabels[type]}</div>
              {buckets.map(bucket => {
                const value = bucket.data[type]
                return (
                  <div
                    key={`${type}-${bucket.label}`}
                    className={`p-2 text-center rounded ${value > 0 ? bucket.color : 'bg-gray-800/30'} text-white font-medium`}
                  >
                    {value}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Overdue Applications List */}
      {overdueApps.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors text-sm"
          >
            <span className="text-red-300 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {overdueApps.length} overdue applications
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 max-h-[250px] overflow-y-auto pr-1">
              {overdueApps.map((app) => (
                <div
                  key={app.id}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-800 ${onViewAudit ? 'cursor-pointer hover:bg-gray-800/50' : ''} transition-colors`}
                  onClick={() => onViewAudit?.(app.id, app.type, `${app.type} - ${app.customer_name} (${app.app_id || 'N/A'})`)}
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    app.type === 'CP' ? 'bg-yellow-500/20 text-yellow-400' :
                    app.type === 'BA' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>{app.type}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{app.customer_name}</p>
                    <p className="text-xs text-gray-500">{app.bank_name} {app.app_id ? `• ${app.app_id}` : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${getAgeSeverity(app.age_hours)}`}>
                      {formatAge(app.age_hours)}
                    </span>
                    {app.amount > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">&#8377;{formatCurrency(app.amount)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {overdueApps.length === 0 && totalOverdue === 0 && (
        <div className="text-center py-4">
          <p className="text-green-400 text-sm">All applications within SLA</p>
        </div>
      )}
    </div>
  )
}
