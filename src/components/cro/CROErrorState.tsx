'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface CROErrorStateProps {
  /** What failed to load — shown in the error message */
  label?: string
  /** Retry handler — called when user clicks retry */
  onRetry?: () => void
  /** Optional additional detail */
  detail?: string
}

export default function CROErrorState({
  label = 'data',
  onRetry,
  detail,
}: CROErrorStateProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-red-300 font-medium">
          Failed to load {label}
        </p>
        <p className="text-xs text-red-400/70 mt-1">
          {detail || 'Please check your connection and try again'}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-xs text-red-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  )
}
