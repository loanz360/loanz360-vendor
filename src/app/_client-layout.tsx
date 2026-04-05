'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { VendorHeader } from '@/components/vendors/VendorHeader'
import { VendorSidebar } from '@/components/vendors/VendorSidebar'
import { clientLogger } from '@/lib/utils/client-logger'
import { PageLoading } from '@/components/ui/loading-spinner'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showDashboard, setShowDashboard] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  // Skip auth checks for auth routes
  const isAuthRoute = pathname?.startsWith('/auth/')

  // Check if user is authenticated vendor
  const isAuthenticated = !isAuthRoute && !!user && user.role === 'VENDOR'

  useEffect(() => {
    if (isAuthRoute) return

    if (!loading && !user) {
      clientLogger.info('No user found, redirecting to vendor login')
      router.push('/auth/login')
      return
    }

    if (user && user.role !== 'VENDOR') {
      clientLogger.warn('User role not authorized for vendors portal', { role: user.role })
      router.push('/auth/login')
      return
    }

    if (user) {
      clientLogger.info('Vendor access granted', { email: user.email, role: user.role })
    }
  }, [user, loading, router, isAuthRoute])

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setShowDashboard(true)
    }
  }, [isAuthenticated, loading])

  // For auth routes, render children directly
  if (isAuthRoute) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <PageLoading
        text="Loading your dashboard..."
        subText="Please wait while we prepare your dashboard"
      />
    )
  }

  if (!user || user.role !== 'VENDOR') {
    return null
  }

  if (!showDashboard) {
    return (
      <PageLoading
        text="Loading your dashboard..."
        subText="Please wait while we prepare your dashboard"
      />
    )
  }

  return (
    <div className="min-h-screen bg-black font-poppins flex flex-col">
      <VendorHeader onMenuToggle={toggleSidebar} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1">
        <aside className={`
          fixed top-0 left-0 h-full z-50 w-[280px] bg-black transform transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:w-[20%] lg:min-w-[280px] lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <VendorSidebar />
        </aside>

        <main className="w-full lg:w-[80%] bg-black">
          <div className="px-4 sm:px-6 lg:px-8 pt-[86px] pb-8">
            <div className="space-y-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
