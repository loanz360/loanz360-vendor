'use client'

import React, { useState } from 'react'
import { AlertOctagon, ChevronDown, ChevronUp, Send } from 'lucide-react'

interface EscalationItem {
  id: string
  app_id: string
  partner_type: string
  days_pending: number
  amount: number
}

interface EscalationLevel {
  count: number
  items: EscalationItem[]
}

interface Props {
  escalations: {
    critical: EscalationLevel
    warning: EscalationLevel
    watch: EscalationLevel
  }
  onEscalate?: (ids: string[]) => void
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

const levelConfig = {
  critical: {
    label: 'Critical',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    badge: 'bg-red-500/20 text-red-400',
    dot: 'bg-red-400',
    hoverBg: 'hover:bg-red-500/15',
  },
  warning: {
    label: 'Warning',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/20 text-orange-400',
    dot: 'bg-orange-400',
    hoverBg: 'hover:bg-orange-500/15',
  },
  watch: {
    label: 'Watch',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    badge: 'bg-yellow-500/20 text-yellow-400',
    dot: 'bg-yellow-400',
    hoverBg: 'hover:bg-yellow-500/15',
  },
}

export default function EscalationPanel({ escalations, onEscalate }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ critical: true, warning: false, watch: false })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleExpand = (level: string) => {
    setExpanded((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = (items: EscalationItem[]) => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allSelected = items.every((i) => next.has(i.id))
      if (allSelected) {
        items.forEach((i) => next.delete(i.id))
      } else {
        items.forEach((i) => next.add(i.id))
      }
      return next
    })
  }

  const handleEscalate = () => {
    if (onEscalate && selected.size > 0) {
      onEscalate(Array.from(selected))
      setSelected(new Set())
    }
  }

  const totalEscalations = escalations.critical.count + escalations.warning.count + escalations.watch.count
  const levels = [
    { key: 'critical' as const, data: escalations.critical },
    { key: 'warning' as const, data: escalations.warning },
    { key: 'watch' as const, data: escalations.watch },
  ]

  return (
    <div className="frosted-card p-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-orange-500" />
          Escalations
        </h2>
        <div className="flex items-center gap-2">
          {totalEscalations > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">{totalEscalations} total</span>
          )}
          {selected.size > 0 && onEscalate && (
            <button
              onClick={handleEscalate}
              className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Send className="w-3 h-3" />
              Escalate ({selected.size})
            </button>
          )}
        </div>
      </div>

      {totalEscalations === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No items require escalation
        </div>
      ) : (
        <div className="space-y-3">
          {levels.map(({ key, data }) => {
            const config = levelConfig[key]
            if (data.count === 0) return null

            return (
              <div key={key} className={`rounded-lg border ${config.border} overflow-hidden`}>
                {/* Level header */}
                <button
                  onClick={() => toggleExpand(key)}
                  className={`w-full flex items-center justify-between p-3 ${config.bg} ${config.hoverBg} transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${config.dot} ${key === 'critical' ? 'animate-pulse' : ''}`} />
                    <span className="text-sm font-medium text-white">{config.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${config.badge}`}>{data.count}</span>
                  </div>
                  {expanded[key] ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Items list */}
                {expanded[key] && data.items.length > 0 && (
                  <div className="border-t border-gray-800/50">
                    {/* Select all */}
                    {onEscalate && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/20 border-b border-gray-800/50">
                        <input
                          type="checkbox"
                          checked={data.items.every((i) => selected.has(i.id))}
                          onChange={() => selectAll(data.items)}
                          className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/30"
                        />
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Select all</span>
                      </div>
                    )}
                    {data.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-800/30 last:border-0 hover:bg-gray-800/20 transition-colors group relative"
                      >
                        {onEscalate && (
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/30 flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white font-medium">{item.app_id}</span>
                            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                              {item.partner_type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{item.days_pending} days pending</p>
                        </div>
                        <span className="text-sm font-medium text-white flex-shrink-0">&#8377;{formatCurrency(item.amount)}</span>
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white whitespace-nowrap">
                          {item.app_id} - {item.days_pending}d pending - &#8377;{formatCurrency(item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
