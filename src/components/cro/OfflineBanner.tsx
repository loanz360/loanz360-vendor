'use client'

import { useState } from 'react'
import { WifiOff, X } from 'lucide-react'
import { useOfflineMode } from '@/lib/hooks/useOfflineMode'

export function OfflineBanner() {
  const { isOnline } = useOfflineMode()
  const [dismissed, setDismissed] = useState(false)

  if (isOnline || dismissed) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2.5">
        <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-amber-400" />
        <span>
          You&apos;re offline &mdash; calculations still work, but data won&apos;t
          be saved until you reconnect.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 text-amber-400 transition-colors hover:bg-amber-500/20 hover:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        aria-label="Dismiss offline notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default OfflineBanner
