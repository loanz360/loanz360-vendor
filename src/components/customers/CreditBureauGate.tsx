'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Clock, Bell, Loader2 } from 'lucide-react'

interface CreditBureauGateProps {
  children: React.ReactNode
}

export function CreditBureauGate({ children }: CreditBureauGateProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    // Quick env-var override (no network call)
    if (process.env.NEXT_PUBLIC_CREDIT_BUREAU_ENABLED === 'true') {
      setEnabled(true)
      return
    }
    // Dynamically check ULI hub credit bureau flag from DB
    fetch('/api/uli/feature-check?service=uli-credit-bureau')
      .then(r => r.json())
      .then(data => setEnabled(!!data.enabled))
      .catch(() => setEnabled(false))
  }, [])

  if (enabled === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (enabled) {
    return <>{children}</>
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center">
            <Shield className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">
          Credit Bureau Integration Pending
        </h1>

        <p className="text-muted-foreground mb-6 leading-relaxed">
          We are awaiting regulatory approval to securely connect with CIBIL and Experian.
          Once live, you will see your real credit score, loan history, and financial health
          analysis here.
        </p>

        <div className="bg-card border border-border rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Expected Timeline</p>
              <p className="text-sm text-muted-foreground">
                Q2 2026 — Enable from Super Admin › ULI Hub › Credit Bureau once API keys are ready
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Get Notified</p>
              <p className="text-sm text-muted-foreground">You will receive a notification the moment this goes live</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/customers/dashboard')}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
