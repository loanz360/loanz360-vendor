'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SessionTimeoutModalProps {
  remainingSeconds: number
  onExtendSession: () => void
  onLogout: () => void
}

export function SessionTimeoutModal({
  remainingSeconds,
  onExtendSession,
  onLogout
}: SessionTimeoutModalProps) {
  const [countdown, setCountdown] = useState(remainingSeconds)

  useEffect(() => {
    setCountdown(remainingSeconds)
  }, [remainingSeconds])

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4" variant="default">
        <CardHeader className="text-center flex flex-col gap-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-warning/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-warning"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <CardTitle className="text-2xl font-bold">Session Timeout Warning</CardTitle>
            <CardDescription className="text-orange-400">
              Your session is about to expire due to inactivity
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                You will be logged out in:
              </p>
              <p className="text-3xl font-bold text-warning">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground text-center">
            Click "Stay Logged In" to extend your session, or you will be automatically logged out for security.
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="orange"
              size="lg"
              className="w-full"
              onClick={onExtendSession}
            >
              Stay Logged In
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={onLogout}
            >
              Log Out Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
