'use client'

import React from 'react'
import { Copy, AlertTriangle } from 'lucide-react'

interface DuplicateGroup {
  customer_name: string
  bank_name: string
  count: number
  app_ids: string[]
}

interface Props {
  duplicateGroups: DuplicateGroup[]
}

export default function DuplicateAlerts({ duplicateGroups }: Props) {
  if (duplicateGroups.length === 0) return null

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <Copy className="w-5 h-5 text-orange-500" />
          Potential Duplicates
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 font-medium">
          {duplicateGroups.length} group{duplicateGroups.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {duplicateGroups.map((group, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/15 hover:bg-orange-500/10 transition-colors">
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">
                <span className="font-medium">{group.customer_name}</span>
                <span className="text-gray-500"> @ </span>
                <span className="text-gray-300">{group.bank_name}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {group.count} applications: {group.app_ids.slice(0, 3).join(', ')}
                {group.app_ids.length > 3 && ` +${group.app_ids.length - 3} more`}
              </p>
            </div>
            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium flex-shrink-0">
              {group.count}x
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
