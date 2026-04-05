'use client'

/**
 * E28: Bulk Operations Framework
 * Reusable toolbar for bulk approve, assign, status change operations
 */

import { useState } from 'react'
import { CheckSquare, Trash2, UserPlus, Tag, Download, Loader2, X } from 'lucide-react'

interface BulkAction {
  id: string
  label: string
  icon: React.ReactNode
  variant: 'default' | 'danger' | 'success'
  confirmMessage?: string
}

interface BulkOperationsToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  actions: BulkAction[]
  onAction: (actionId: string) => Promise<void>
  isAllSelected?: boolean
}

export function BulkOperationsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  actions,
  onAction,
  isAllSelected = false,
}: BulkOperationsToolbarProps) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  if (selectedCount === 0) return null

  const handleAction = async (action: BulkAction) => {
    if (action.confirmMessage) {
      if (!confirm(action.confirmMessage.replace('{count}', String(selectedCount)))) return
    }

    setIsProcessing(action.id)
    try {
      await onAction(action.id)
    } finally {
      setIsProcessing(null)
    }
  }

  const getButtonClasses = (variant: BulkAction['variant']) => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
      case 'success':
        return 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/30'
      default:
        return 'bg-gray-700 text-white hover:bg-gray-600 border-gray-600'
    }
  }

  return (
    <div className="sticky top-0 z-20 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-orange-400" />
        <span className="text-sm text-white font-medium">
          {selectedCount} of {totalCount} selected
        </span>
        <button
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
          className="text-xs text-orange-400 hover:text-orange-300 underline"
        >
          {isAllSelected ? 'Deselect all' : 'Select all'}
        </button>
        <button onClick={onDeselectAll} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={isProcessing !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${getButtonClasses(action.variant)}`}
          >
            {isProcessing === action.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              action.icon
            )}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Pre-built action sets for common use cases */
export const COMMON_BULK_ACTIONS = {
  leads: [
    { id: 'assign', label: 'Assign BDE', icon: <UserPlus className="w-4 h-4" />, variant: 'default' as const },
    { id: 'tag', label: 'Add Tag', icon: <Tag className="w-4 h-4" />, variant: 'default' as const },
    { id: 'export', label: 'Export', icon: <Download className="w-4 h-4" />, variant: 'default' as const },
    { id: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, variant: 'danger' as const, confirmMessage: 'Delete {count} leads? This cannot be undone.' },
  ],
  payouts: [
    { id: 'approve', label: 'Approve', icon: <CheckSquare className="w-4 h-4" />, variant: 'success' as const, confirmMessage: 'Approve {count} payouts?' },
    { id: 'export', label: 'Export', icon: <Download className="w-4 h-4" />, variant: 'default' as const },
    { id: 'reject', label: 'Reject', icon: <Trash2 className="w-4 h-4" />, variant: 'danger' as const, confirmMessage: 'Reject {count} payouts? This cannot be undone.' },
  ],
}
