'use client'

import React from 'react'
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface IdleTimeoutWarningProps {
  isVisible: boolean
  remainingSeconds: number
  onStayLoggedIn: () => void
  onLogout: () => void
  portalName?: string
}

/**
 * Warning modal shown when user is about to be logged out due to inactivity
 */
export function IdleTimeoutWarning({
  isVisible,
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
  portalName = 'Portal',
}: IdleTimeoutWarningProps) {
  if (!isVisible) return null

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${secs} seconds`
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-orange-500/30 rounded-xl shadow-2xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-orange-500 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-2 font-poppins">
          Session Timeout Warning
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-center mb-4">
          You have been inactive for a while. For security reasons, you will be
          automatically logged out from the {portalName}.
        </p>

        {/* Countdown */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className="text-gray-400 text-sm">Logging out in</span>
          </div>
          <div className="text-3xl font-bold text-orange-500 font-mono">
            {formatTime(remainingSeconds)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onLogout}
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Logout Now
          </Button>
          <Button
            onClick={onStayLoggedIn}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Stay Logged In
          </Button>
        </div>

        {/* Help text */}
        <p className="text-gray-500 text-xs text-center mt-4">
          Click anywhere or press any key to stay logged in
        </p>
      </div>
    </div>
  )
}

export default IdleTimeoutWarning
