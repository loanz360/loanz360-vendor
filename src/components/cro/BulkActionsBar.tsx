'use client'

import { useState, useEffect } from 'react'
import {
  X,
  CheckSquare,
  Square,
  Download,
  MessageSquare,
  ChevronDown,
  Loader2,
} from 'lucide-react'
import { formatStatusName } from '@/lib/constants/sales-pipeline'

export type BulkEntityType = 'contacts' | 'leads' | 'deals' | 'followups'

interface BulkActionsBarProps {
  entityType: BulkEntityType
  selectedCount: number
  totalCount: number
  allSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onBulkStatusChange: (status: string) => Promise<void>
  onBulkExport: () => void
  onBulkWhatsApp?: () => void
  onDismiss: () => void
}

const STATUS_OPTIONS: Record<BulkEntityType, readonly string[]> = {
  contacts: ['new', 'contacted', 'called', 'follow_up', 'not_interested', 'positive'],
  leads: ['active', 'follow_up', 'dropped'],
  deals: [], // Read-only for CRO
  followups: ['Completed', 'Cancelled'],
}

export default function BulkActionsBar({
  entityType,
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onDeselectAll,
  onBulkStatusChange,
  onBulkExport,
  onBulkWhatsApp,
  onDismiss,
}: BulkActionsBarProps) {
  const [visible, setVisible] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  // Slide-up animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const statusOptions = STATUS_OPTIONS[entityType]
  const showWhatsApp = (entityType === 'contacts' || entityType === 'leads') && onBulkWhatsApp
  const showStatusChange = statusOptions.length > 0

  const handleStatusChange = async (status: string) => {
    setIsUpdating(true)
    setStatusDropdownOpen(false)
    try {
      await onBulkStatusChange(status)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-[#1a1a2e] border-t border-gray-700 shadow-2xl shadow-black/50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Selection info + toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 text-sm text-gray-300 hover:bg-white/10 transition-colors"
              title={allSelected ? 'Deselect All' : 'Select All'}
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-orange-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{allSelected ? 'Deselect All' : 'Select All'}</span>
            </button>
            <span className="text-sm text-white font-medium">
              {selectedCount} <span className="text-gray-400">of</span> {totalCount} <span className="text-gray-400">selected</span>
            </span>
          </div>

          {/* Center: Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Status Change */}
            {showStatusChange && (
              <div className="relative">
                <button
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>Change Status</span>
                </button>

                {statusDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setStatusDropdownOpen(false)}
                    />
                    <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-white/20 rounded-lg shadow-xl z-50 min-w-[180px] py-1">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                        >
                          {formatStatusName(status)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Bulk Export CSV */}
            <button
              onClick={onBulkExport}
              className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            {/* Bulk WhatsApp */}
            {showWhatsApp && (
              <button
                onClick={onBulkWhatsApp}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white font-medium transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
          </div>

          {/* Right: Dismiss */}
          <button
            onClick={() => {
              setVisible(false)
              setTimeout(onDismiss, 300)
            }}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
