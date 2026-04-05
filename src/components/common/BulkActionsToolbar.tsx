'use client'

import React, { useState } from 'react'
import { CheckSquare, X, Loader2 } from 'lucide-react'

interface BulkAction {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'danger' | 'success'
  confirmMessage?: string
  handler: (selectedIds: string[]) => Promise<void>
}

interface BulkActionsToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  actions: BulkAction[]
  className?: string
}

const VARIANT_STYLES = {
  default: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400',
  success: 'bg-green-500/20 hover:bg-green-500/30 text-green-400',
}

export function BulkActionsToolbar({ selectedCount, totalCount, onSelectAll, onDeselectAll, actions, className = '' }: BulkActionsToolbarProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<BulkAction | null>(null)

  if (selectedCount === 0) return null

  const executeAction = async (action: BulkAction) => {
    if (action.confirmMessage) {
      setConfirmAction(action)
      return
    }
    await runAction(action)
  }

  const runAction = async (action: BulkAction) => {
    setLoadingAction(action.id)
    setConfirmAction(null)
    try {
      await action.handler([]) // Parent provides actual IDs through the handler closure
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <>
      <div className={`flex items-center gap-3 px-4 py-3 bg-[#FF6700]/10 border border-[#FF6700]/20 rounded-xl ${className}`}>
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#FF6700]" />
          <span className="text-sm font-medium text-white">
            {selectedCount} of {totalCount} selected
          </span>
        </div>
        <div className="h-4 w-px bg-gray-700" />
        <button onClick={onSelectAll} className="text-xs text-[#FF6700] hover:text-[#FF8533] font-medium">Select All</button>
        <button onClick={onDeselectAll} className="text-xs text-gray-400 hover:text-white font-medium">Clear</button>
        <div className="h-4 w-px bg-gray-700" />
        <div className="flex items-center gap-2">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => executeAction(action)}
              disabled={loadingAction !== null}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${VARIANT_STYLES[action.variant || 'default']}`}
            >
              {loadingAction === action.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : action.icon}
              {action.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={onDeselectAll} className="p-1 text-gray-400 hover:text-white" aria-label="Dismiss selection">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">Confirm Action</h3>
            <p className="text-sm text-gray-400 mb-6">{confirmAction.confirmMessage}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600">Cancel</button>
              <button
                onClick={() => runAction(confirmAction)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${confirmAction.variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#FF6700] hover:bg-[#FF6700]/80 text-white'}`}
              >
                {confirmAction.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
