'use client'

import { useState, useEffect, useCallback } from 'react'
import { History, Clock, User, ArrowRight, RotateCcw, CheckCircle, XCircle, X } from 'lucide-react'
import { toast } from 'sonner'

interface AuditChange {
  old: string | number | boolean | null | string[]
  new: string | number | boolean | null | string[]
}

interface AuditEntry {
  id: string
  action: string
  changed_fields: string[]
  change_count: number
  changes: Record<string, AuditChange>
  user_name: string
  user_role: string
  changed_at: string
  change_severity: 'low' | 'normal' | 'high' | 'critical'
  is_rolled_back: boolean
}

interface AuditTrailViewerProps {
  offerId: string
  showRollback?: boolean
  className?: string
}

export default function AuditTrailViewer({
  offerId,
  showRollback = true,
  className = ''
}: AuditTrailViewerProps) {
  const [history, setHistory] = useState<AuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [rollbackModal, setRollbackModal] = useState<{
    isOpen: boolean
    entry: AuditEntry | null
    reason: string
    step: 'confirm' | 'reason'
  }>({
    isOpen: false,
    entry: null,
    reason: '',
    step: 'confirm'
  })

  const fetchAuditHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/offers/audit?offer_id=${offerId}&limit=50`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch audit history')
      }

      setHistory(data.history || [])
    } catch (error) {
      console.error('Error fetching audit history:', error)
      toast.error('Failed to load audit history', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }, [offerId])

  useEffect(() => {
    if (offerId) {
      fetchAuditHistory()
    }
  }, [offerId, fetchAuditHistory])

  const openRollbackModal = (entry: AuditEntry) => {
    setRollbackModal({
      isOpen: true,
      entry,
      reason: '',
      step: 'confirm'
    })
  }

  const closeRollbackModal = () => {
    setRollbackModal({
      isOpen: false,
      entry: null,
      reason: '',
      step: 'confirm'
    })
  }

  const handleRollbackConfirm = () => {
    setRollbackModal(prev => ({ ...prev, step: 'reason' }))
  }

  const handleRollbackSubmit = async () => {
    if (!rollbackModal.entry || !rollbackModal.reason.trim()) {
      toast.error('Please provide a reason for this rollback')
      return
    }

    setIsRollingBack(true)
    try {
      const response = await fetch('/api/offers/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offerId,
          audit_log_id: rollbackModal.entry.id,
          rollback_reason: rollbackModal.reason.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rollback')
      }

      toast.success('Rollback successful', {
        description: `Restored to version from ${new Date(rollbackModal.entry.changed_at).toLocaleString()}`
      })

      closeRollbackModal()
      fetchAuditHistory()
    } catch (error) {
      console.error('Error rolling back:', error)
      toast.error('Rollback failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsRollingBack(false)
    }
  }

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30'
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
      case 'normal': return 'text-blue-500 bg-blue-500/10 border-blue-500/30'
      case 'low': return 'text-gray-500 bg-gray-500/10 border-gray-500/30'
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30'
    }
  }

  // Get action icon
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'updated': return <History className="w-5 h-5 text-blue-500" />
      case 'deleted': return <XCircle className="w-5 h-5 text-red-500" />
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />
      case 'published': return <CheckCircle className="w-5 h-5 text-purple-500" />
      case 'restored': return <RotateCcw className="w-5 h-5 text-orange-500" />
      default: return <History className="w-5 h-5 text-gray-500" />
    }
  }

  // Format field name
  const formatFieldName = (field: string) => {
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  // Format value for display
  const formatValue = (value: AuditChange['old'] | AuditChange['new']) => {
    if (value === null || value === undefined) return <span className="text-gray-500 italic">null</span>
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) return value.join(', ') || <span className="text-gray-500 italic">empty</span>
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  // Time ago formatter
  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)

    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return new Date(date).toLocaleDateString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="text-center p-8 text-gray-400">
        <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No audit history available</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10"></div>

        {/* Entries */}
        <div className="space-y-6">
          {history.map((entry, index) => (
            <div key={entry.id} className="relative pl-16">
              {/* Timeline dot */}
              <div className="absolute left-4 -ml-2 mt-2">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  entry.is_rolled_back
                    ? 'bg-orange-500 border-orange-500'
                    : 'bg-gray-800 border-blue-500'
                }`}></div>
              </div>

              {/* Entry card */}
              <div
                className={`bg-white/5 border rounded-lg p-4 hover:bg-white/10 transition-all cursor-pointer ${
                  selectedEntry?.id === entry.id
                    ? 'border-blue-500 bg-white/10'
                    : 'border-white/10'
                } ${entry.is_rolled_back ? 'opacity-60' : ''}`}
                onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    {getActionIcon(entry.action)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white capitalize">
                          {entry.action}
                        </span>
                        {entry.is_rolled_back && (
                          <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                            Rolled Back
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        {entry.user_name || 'Unknown User'}
                        <span className="text-gray-500">•</span>
                        <span className="text-xs px-1.5 py-0.5 bg-white/5 rounded">
                          {entry.user_role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded border ${getSeverityColor(entry.change_severity)}`}>
                      {entry.change_severity}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(entry.changed_at)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.changed_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Changed fields summary */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {entry.changed_fields.map((field) => (
                    <span
                      key={field}
                      className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded"
                    >
                      {formatFieldName(field)}
                    </span>
                  ))}
                </div>

                {/* Expanded diff view */}
                {selectedEntry?.id === entry.id && Object.keys(entry.changes).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    {Object.entries(entry.changes).map(([field, change]) => (
                      <div key={field} className="bg-black/20 rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-300 mb-2">
                          {formatFieldName(field)}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Old value */}
                          <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                            <div className="text-xs text-red-400 mb-1">Before</div>
                            <div className="text-sm text-white font-mono break-all">
                              {formatValue(change.old)}
                            </div>
                          </div>

                          {/* Arrow */}
                          <div className="flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 text-gray-500" />
                          </div>

                          {/* New value */}
                          <div className="bg-green-500/10 border border-green-500/30 rounded p-2 -ml-12">
                            <div className="text-xs text-green-400 mb-1">After</div>
                            <div className="text-sm text-white font-mono break-all">
                              {formatValue(change.new)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Rollback button */}
                    {showRollback && index > 0 && !entry.is_rolled_back && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openRollbackModal(entry)
                          }}
                          disabled={isRollingBack}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30
                                   text-orange-400 rounded-lg transition-colors disabled:opacity-50
                                   disabled:cursor-not-allowed text-sm"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Rollback to this version
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rollback Confirmation Modal */}
      {rollbackModal.isOpen && rollbackModal.entry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/20 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">
                {rollbackModal.step === 'confirm' ? 'Confirm Rollback' : 'Rollback Reason'}
              </h3>
              <button
                onClick={closeRollbackModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {rollbackModal.step === 'confirm' ? (
                <>
                  <p className="text-gray-300 mb-4">
                    Are you sure you want to rollback to this version from{' '}
                    <span className="text-white font-medium">
                      {new Date(rollbackModal.entry.changed_at).toLocaleString()}
                    </span>
                    ?
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    This will restore all fields to their previous values.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={closeRollbackModal}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRollbackConfirm}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-300 mb-4">
                    Please provide a reason for this rollback:
                  </p>
                  <textarea
                    value={rollbackModal.reason}
                    onChange={(e) => setRollbackModal(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Enter the reason for this rollback..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/20 rounded-lg text-white
                             placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500
                             resize-none h-24"
                  />
                  <div className="flex gap-3 justify-end mt-4">
                    <button
                      onClick={() => setRollbackModal(prev => ({ ...prev, step: 'confirm' }))}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleRollbackSubmit}
                      disabled={isRollingBack || !rollbackModal.reason.trim()}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg
                               transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                               flex items-center gap-2"
                    >
                      {isRollingBack ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Rolling back...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Rollback
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact Audit Summary Component
 * Shows quick stats without full timeline
 */
export function AuditSummary({
  offerId,
  className = ''
}: {
  offerId: string
  className?: string
}) {
  const [stats, setStats] = useState<{
    total: number
    last_change: string
    last_user: string
  } | null>(null)

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/offers/audit?offer_id=${offerId}&limit=1`)
      const data = await response.json()

      if (data.history && data.history.length > 0) {
        setStats({
          total: data.count || 0,
          last_change: data.history[0].changed_at,
          last_user: data.history[0].user_name
        })
      }
    } catch (error) {
      console.error('Error fetching audit summary:', error)
    }
  }, [offerId])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  if (!stats) return null

  return (
    <div className={`flex items-center gap-4 text-xs text-gray-400 ${className}`}>
      <div className="flex items-center gap-1">
        <History className="w-3.5 h-3.5" />
        <span>{stats.total} changes</span>
      </div>
      <div className="flex items-center gap-1">
        <User className="w-3.5 h-3.5" />
        <span>Last: {stats.last_user}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        <span>{new Date(stats.last_change).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
