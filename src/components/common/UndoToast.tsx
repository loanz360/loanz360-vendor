'use client'

import React, { useEffect, useState } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoToastProps {
  message: string
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev - (100 / (duration / 50))
        if (next <= 0) {
          clearInterval(interval)
          return 0
        }
        return next
      })
    }, 50)

    return () => clearInterval(interval)
  }, [duration])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[320px]">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm text-gray-300 flex-1">{message}</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#FF6700]/20 text-[#FF6700] rounded text-sm font-medium hover:bg-[#FF6700]/30 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-[#FF6700]/50 transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
