'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => {
      setIsOffline(false)
      setShowReconnected(true)
      setTimeout(() => setShowReconnected(false), 3000)
    }

    // Check initial state
    if (!navigator.onLine) setIsOffline(true)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline && !showReconnected) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
      {isOffline ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-sm">
          <WifiOff className="w-4 h-4" />
          <span>You are offline. Changes won&apos;t be saved.</span>
        </div>
      ) : showReconnected ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-green-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-sm">
          <Wifi className="w-4 h-4" />
          <span>Back online!</span>
        </div>
      ) : null}
    </div>
  )
}

export default OfflineIndicator
