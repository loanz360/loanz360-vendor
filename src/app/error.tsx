'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, Home, AlertTriangle } from 'lucide-react'

export default function VendorError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Vendor Portal Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 border border-orange-500/30 rounded-xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2 font-poppins">
          Something went wrong
        </h1>
        <p className="text-gray-400 text-center mb-6">
          We encountered an unexpected error in the Vendor Portal. This might be a temporary issue.
        </p>
        <details className="mb-6 bg-gray-800 rounded-lg p-3">
          <summary className="text-orange-400 cursor-pointer text-sm font-medium">Error Details</summary>
          <div className="mt-3 text-xs text-gray-500 font-mono break-all">
            <p className="mb-2"><strong>Message:</strong> {error.message}</p>
            {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
          </div>
        </details>
        <div className="space-y-3">
          <Button onClick={reset} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full border-gray-700 text-gray-300 hover:bg-gray-800">
            Hard Refresh Page
          </Button>
          <Button onClick={() => window.location.href = '/auth/login'} variant="ghost" className="w-full text-gray-400 hover:text-white">
            <Home className="w-4 h-4 mr-2" />
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  )
}
