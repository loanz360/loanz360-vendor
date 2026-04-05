'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  onGoBack?: () => void
  variant?: 'default' | 'compact' | 'inline'
  error?: string
}

export default function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  onGoBack,
  variant = 'default',
  error,
}: ErrorStateProps) {
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <p className="text-sm text-red-300">{title}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-medium text-[#FF6700] hover:text-[#ff8533] transition-colors ml-auto">
            Retry
          </button>
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-0.5">{title}</h4>
        <p className="text-xs text-gray-400 text-center max-w-xs">{description}</p>
        {error && <p className="text-xs text-red-400/70 text-center max-w-xs mt-1 font-mono">{error}</p>}
        {onRetry && (
          <button onClick={onRetry} className="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-xs font-medium rounded-lg transition-colors">
            <RefreshCw className="w-3 h-3" /> Try Again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400 text-center max-w-sm">{description}</p>
      {error && <p className="text-xs text-red-400/70 text-center max-w-sm mt-2 font-mono bg-red-500/5 px-3 py-1.5 rounded">{error}</p>}
      <div className="flex items-center gap-3 mt-5">
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6700] hover:bg-[#e65c00] text-white text-sm font-medium rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        )}
        {onGoBack && (
          <button onClick={onGoBack} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-300 border border-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        )}
      </div>
    </div>
  )
}
