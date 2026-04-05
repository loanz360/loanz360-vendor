'use client'

import { ErrorBoundary } from '@/components/error-boundary'
import { Suspense, useState, useEffect } from 'react'

// Temporarily disable AuthProvider to fix TDZ error
export function ClientProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #333',
            borderTopColor: '#FF6700',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }} />
          <p>Loading LOANZ 360...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
