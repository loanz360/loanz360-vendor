'use client'

import React, { useMemo, useState } from 'react'
import { GitCompare, ChevronDown, ChevronUp, Plus, Minus, Edit3 } from 'lucide-react'

interface DiffEntry {
  field: string
  oldValue: string | number | boolean | null
  newValue: string | number | boolean | null
  type: 'added' | 'removed' | 'changed' | 'unchanged'
}

interface AuditDiffProps {
  before: Record<string, unknown>
  after: Record<string, unknown>
  title?: string
  timestamp?: string
  actor?: string
  compact?: boolean
}

function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>): DiffEntry[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const entries: DiffEntry[] = []

  for (const key of allKeys) {
    const oldVal = before[key] ?? null
    const newVal = after[key] ?? null

    // Skip metadata fields
    if (['updated_at', 'created_at', 'id'].includes(key)) continue

    const oldStr = oldVal === null ? null : String(oldVal)
    const newStr = newVal === null ? null : String(newVal)

    if (oldStr === null && newStr !== null) {
      entries.push({ field: key, oldValue: null, newValue: newVal as string, type: 'added' })
    } else if (oldStr !== null && newStr === null) {
      entries.push({ field: key, oldValue: oldVal as string, newValue: null, type: 'removed' })
    } else if (oldStr !== newStr) {
      entries.push({ field: key, oldValue: oldVal as string, newValue: newVal as string, type: 'changed' })
    }
  }

  // Sort: changed first, then added, then removed
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  return entries.sort((a, b) => order[a.type] - order[b.type])
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const typeConfig = {
  added: { icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Added' },
  removed: { icon: Minus, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Removed' },
  changed: { icon: Edit3, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Changed' },
  unchanged: { icon: Edit3, color: 'text-gray-500', bg: 'bg-white/5', label: 'Unchanged' },
}

export default function AuditDiffViewer({ before, after, title, timestamp, actor, compact = false }: AuditDiffProps) {
  const [isExpanded, setIsExpanded] = useState(!compact)
  const diff = useMemo(() => computeDiff(before, after), [before, after])

  if (diff.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">No changes detected</div>
    )
  }

  const summary = {
    changed: diff.filter(d => d.type === 'changed').length,
    added: diff.filter(d => d.type === 'added').length,
    removed: diff.filter(d => d.type === 'removed').length,
  }

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-white/5 hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#FF6700]" />
          <span className="text-sm font-medium text-white">{title || 'Changes'}</span>
          <div className="flex items-center gap-1.5 ml-2">
            {summary.changed > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400">{summary.changed} modified</span>}
            {summary.added > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">{summary.added} added</span>}
            {summary.removed > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">{summary.removed} removed</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {actor && <span className="text-[10px] text-gray-500">by {actor}</span>}
          {timestamp && <span className="text-[10px] text-gray-500">{new Date(timestamp).toLocaleString('en-IN')}</span>}
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {/* Diff Table */}
      {isExpanded && (
        <div className="divide-y divide-white/5">
          {diff.map((entry, idx) => {
            const config = typeConfig[entry.type]
            const Icon = config.icon
            return (
              <div key={idx} className={`flex items-start gap-3 px-4 py-2 ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-300">{formatFieldName(entry.field)}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.type === 'changed' && (
                      <>
                        <span className="text-xs text-red-400 line-through">{formatValue(entry.oldValue)}</span>
                        <span className="text-[10px] text-gray-600">→</span>
                        <span className="text-xs text-emerald-400">{formatValue(entry.newValue)}</span>
                      </>
                    )}
                    {entry.type === 'added' && (
                      <span className="text-xs text-emerald-400">{formatValue(entry.newValue)}</span>
                    )}
                    {entry.type === 'removed' && (
                      <span className="text-xs text-red-400 line-through">{formatValue(entry.oldValue)}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { computeDiff, formatFieldName }
export type { DiffEntry, AuditDiffProps }
