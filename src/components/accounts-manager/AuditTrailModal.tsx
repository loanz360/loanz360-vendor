'use client'

import React, { useState, useEffect } from 'react'
import { X, Loader2, Clock, ArrowRight } from 'lucide-react'

interface HistoryEntry {
  id: string
  previous_status: string
  new_status: string
  changed_by_name: string
  changed_by_role: string
  notes: string | null
  created_at: string
}

interface Props {
  applicationId: string
  appType: 'CP' | 'BA' | 'BP'
  appLabel: string
  onClose: () => void
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

function getStatusColor(status: string): string {
  if (status === 'ACCOUNTS_VERIFIED' || status === 'SA_APPROVED') return 'text-green-400'
  if (status === 'REJECTED') return 'text-red-400'
  if (status === 'ON_HOLD') return 'text-orange-400'
  if (status === 'ACCOUNTS_VERIFICATION') return 'text-blue-400'
  if (status === 'FINANCE_PROCESSING') return 'text-purple-400'
  if (status === 'PAYOUT_CREDITED') return 'text-emerald-400'
  return 'text-gray-400'
}

export default function AuditTrailModal({ applicationId, appType, appLabel, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true)
        const endpoint = appType === 'CP'
          ? `/api/employees/accounts-executive/cp-applications?mode=history&applicationId=${applicationId}`
          : appType === 'BA'
          ? `/api/employees/accounts-executive/ba-applications?mode=history&applicationId=${applicationId}`
          : `/api/employees/accounts-executive/bp-applications?mode=history&applicationId=${applicationId}`

        const res = await fetch(endpoint)
        const data = await res.json()
        if (data.success) {
          setHistory(data.data?.history || data.history || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [applicationId, appType])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-white font-poppins">Audit Trail</h3>
            <p className="text-xs text-gray-500 mt-0.5">{appLabel}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </div>
          ) : history.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-800" />

              <div className="space-y-4">
                {history.map((entry, idx) => (
                  <div key={entry.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      idx === 0 ? 'bg-orange-500' : 'bg-gray-700'
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>

                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm ${getStatusColor(entry.previous_status)}`}>
                          {STATUS_LABELS[entry.previous_status] || entry.previous_status}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-600" />
                        <span className={`text-sm font-medium ${getStatusColor(entry.new_status)}`}>
                          {STATUS_LABELS[entry.new_status] || entry.new_status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(entry.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}</span>
                        <span>&bull;</span>
                        <span>{entry.changed_by_name}</span>
                        {entry.changed_by_role && (
                          <span className="text-gray-600">({entry.changed_by_role.replace(/_/g, ' ')})</span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-gray-400 mt-1 bg-gray-800/50 rounded p-2">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No history found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
