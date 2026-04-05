'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  XCircle,
  PauseCircle,
  ArrowUpCircle,
  RefreshCw,
  ListChecks,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react'
import PriorityBadge from './PriorityBadge'

interface QueueItem {
  id: string
  app_id: string
  partner_type: 'CP' | 'BA' | 'BP'
  customer_name: string
  bank_name: string | null
  amount: number
  status: string
  created_at: string
  days_pending: number
  priority_score: number
}

interface QueueResponse {
  success: boolean
  data: {
    queue: QueueItem[]
    total: number
    counts: { cp: number; ba: number; bp: number }
    summary: { avg_priority: number; critical_count: number }
  }
  error?: string
}

interface BatchResponse {
  success: boolean
  data?: { processed: number; failed: number; errors: string[] }
  error?: string
}

type TabFilter = 'all' | 'CP' | 'BA' | 'BP'
type BatchAction = 'verify' | 'reject' | 'hold' | 'escalate'

interface Props {
  onActionComplete?: () => void
}

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`
  return amount.toLocaleString('en-IN')
}

const ACTION_CONFIG: Record<BatchAction, { label: string; icon: React.ElementType; bg: string; hoverBg: string; text: string }> = {
  verify: {
    label: 'Verify Selected',
    icon: CheckCircle2,
    bg: 'bg-emerald-500/20',
    hoverBg: 'hover:bg-emerald-500/30',
    text: 'text-emerald-400',
  },
  reject: {
    label: 'Reject Selected',
    icon: XCircle,
    bg: 'bg-red-500/20',
    hoverBg: 'hover:bg-red-500/30',
    text: 'text-red-400',
  },
  hold: {
    label: 'Put on Hold',
    icon: PauseCircle,
    bg: 'bg-yellow-500/20',
    hoverBg: 'hover:bg-yellow-500/30',
    text: 'text-yellow-400',
  },
  escalate: {
    label: 'Escalate',
    icon: ArrowUpCircle,
    bg: 'bg-orange-500/20',
    hoverBg: 'hover:bg-orange-500/30',
    text: 'text-orange-400',
  },
}

export default function BatchVerificationPanel({ onActionComplete }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [counts, setCounts] = useState({ cp: 0, ba: 0, bp: 0 })
  const [summary, setSummary] = useState({ avg_priority: 0, critical_count: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmAction, setConfirmAction] = useState<BatchAction | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchQueue = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (activeTab !== 'all') params.set('partner_type', activeTab)

      const res = await fetch(`/api/employees/accounts-manager/priority-queue?${params}`)
      const json: QueueResponse = await res.json()

      if (json.success && json.data) {
        setQueue(json.data.queue)
        setCounts(json.data.counts)
        setSummary(json.data.summary)
      }
    } catch {
      showToast('error', 'Failed to load priority queue')
    } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === queue.length && queue.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(queue.map(item => item.id)))
    }
  }

  const getSelectedPartnerType = (): 'CP' | 'BA' | 'BP' | null => {
    const selectedItems = queue.filter(item => selected.has(item.id))
    if (selectedItems.length === 0) return null

    const types = new Set(selectedItems.map(i => i.partner_type))
    if (types.size > 1) return null // mixed types
    return selectedItems[0].partner_type
  }

  const handleBatchAction = async () => {
    if (!confirmAction || selected.size === 0) return

    const partnerType = getSelectedPartnerType()
    if (!partnerType) {
      showToast('error', 'Selected applications must be of the same partner type. Filter by tab first.')
      setConfirmAction(null)
      return
    }

    setProcessing(true)
    try {
      const res = await fetch('/api/employees/accounts-manager/batch-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: Array.from(selected),
          action: confirmAction,
          partner_type: partnerType,
          notes: actionNotes || undefined,
        }),
      })

      const json: BatchResponse = await res.json()

      if (json.success && json.data) {
        const { processed, failed, errors } = json.data
        if (processed > 0) {
          showToast('success', `${processed} application${processed > 1 ? 's' : ''} ${confirmAction === 'verify' ? 'verified' : confirmAction === 'reject' ? 'rejected' : confirmAction === 'hold' ? 'put on hold' : 'escalated'} successfully${failed > 0 ? `. ${failed} failed.` : '.'}`)
        } else {
          showToast('error', errors[0] || 'No applications were processed')
        }
        setSelected(new Set())
        setConfirmAction(null)
        setActionNotes('')
        fetchQueue()
        onActionComplete?.()
      } else {
        showToast('error', json.error || 'Batch action failed')
      }
    } catch {
      showToast('error', 'Network error. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.cp + counts.ba + counts.bp },
    { key: 'CP', label: 'CP', count: counts.cp },
    { key: 'BA', label: 'BA', count: counts.ba },
    { key: 'BP', label: 'BP', count: counts.bp },
  ]

  const partnerTypeColors: Record<string, string> = {
    CP: 'bg-yellow-500/20 text-yellow-400',
    BA: 'bg-orange-500/20 text-orange-400',
    BP: 'bg-amber-500/20 text-amber-400',
  }

  return (
    <div className="frosted-card p-6 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold font-poppins text-white flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-orange-500" />
          Batch Verification
        </h2>
        <div className="flex items-center gap-2">
          {summary.critical_count > 0 && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {summary.critical_count} critical
            </span>
          )}
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-gray-800/30 p-1 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelected(new Set()) }}
            className={`flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            {tab.label}
            <span className="ml-1 opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
          <span className="text-xs text-gray-400 mr-1">{selected.size} selected</span>
          {(Object.entries(ACTION_CONFIG) as [BatchAction, typeof ACTION_CONFIG[BatchAction]][]).map(([key, config]) => {
            const Icon = config.icon
            return (
              <button
                key={key}
                onClick={() => setConfirmAction(key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${config.bg} ${config.text} ${config.hoverBg} transition-colors`}
              >
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading queue...</span>
        </div>
      ) : queue.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          No pending applications in queue
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left py-2 px-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === queue.length && queue.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/30"
                  />
                </th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Priority</th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">App ID</th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Type</th>
                <th className="text-right py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Amount</th>
                <th className="text-right py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Days</th>
                <th className="text-left py-2 px-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.map(item => (
                <tr
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`border-b border-gray-800/30 cursor-pointer transition-colors ${
                    selected.has(item.id) ? 'bg-orange-500/5' : 'hover:bg-gray-800/20'
                  }`}
                >
                  <td className="py-2.5 px-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500/30"
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <PriorityBadge score={item.priority_score} showScore />
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-white font-medium">{item.app_id}</span>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.customer_name}</p>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${partnerTypeColors[item.partner_type] || 'bg-gray-800 text-gray-400'}`}>
                      {item.partner_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-white">
                    <span className="text-xs">&#8377;</span>{formatCurrency(item.amount)}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <span className={`text-sm ${item.days_pending >= 10 ? 'text-red-400 font-medium' : item.days_pending >= 5 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {item.days_pending}d
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-[10px] text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded">
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      {!loading && queue.length > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50 text-xs text-gray-500">
          <span>Avg Priority: <span className="text-white font-medium">{summary.avg_priority}</span></span>
          <span>{queue.length} application{queue.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="frosted-card p-6 rounded-xl w-full max-w-md mx-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold font-poppins text-white flex items-center gap-2">
                {React.createElement(ACTION_CONFIG[confirmAction].icon, {
                  className: `w-5 h-5 ${ACTION_CONFIG[confirmAction].text}`,
                })}
                Confirm {ACTION_CONFIG[confirmAction].label}
              </h3>
              <button
                onClick={() => { setConfirmAction(null); setActionNotes('') }}
                className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              You are about to <span className="text-white font-medium">{confirmAction}</span>{' '}
              <span className="text-orange-400 font-medium">{selected.size}</span> application{selected.size > 1 ? 's' : ''}.
              This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">
                Notes (optional)
              </label>
              <textarea
                value={actionNotes}
                onChange={e => setActionNotes(e.target.value)}
                placeholder="Add notes for this batch action..."
                rows={3}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setConfirmAction(null); setActionNotes('') }}
                className="flex-1 px-4 py-2 text-sm text-gray-400 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchAction}
                disabled={processing}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${ACTION_CONFIG[confirmAction].bg} ${ACTION_CONFIG[confirmAction].text} ${ACTION_CONFIG[confirmAction].hoverBg} disabled:opacity-50`}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {React.createElement(ACTION_CONFIG[confirmAction].icon, { className: 'w-4 h-4' })}
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="text-sm">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
