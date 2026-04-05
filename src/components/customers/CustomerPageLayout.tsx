'use client'

import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import CustomerSidebar from '@/components/customers/CustomerSidebar'
import CustomerHeader from '@/components/customers/CustomerHeader'
import { useActiveProfile } from '@/lib/contexts/active-profile-context'

// Context for coordinating loading states between sidebar and main content
interface CustomerLayoutLoadingContextType {
  isSidebarLoaded: boolean
  isContentLoaded: boolean
  setSidebarLoaded: (loaded: boolean) => void
  setContentLoaded: (loaded: boolean) => void
}

const CustomerLayoutLoadingContext = createContext<CustomerLayoutLoadingContextType | undefined>(undefined)

export function useCustomerLayoutLoading() {
  const context = useContext(CustomerLayoutLoadingContext)
  if (!context) {
    // Return a fallback if used outside the provider (for standalone components)
    return {
      isSidebarLoaded: true,
      isContentLoaded: true,
      setSidebarLoaded: () => {},
      setContentLoaded: () => {},
    }
  }
  return context
}

interface CustomerPageLayoutProps {
  children: React.ReactNode
}

// Premium Full-Page Loading Spinner — Unified loader for sidebar + content
function LogoFloatingSpinner({ text = 'Loading...', subText = 'Please wait' }: { text?: string; subText?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
      {/* Ambient background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-orange-500/[0.03] blur-[120px] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-orange-400/[0.05] blur-[80px] pointer-events-none animate-pulse" />

      <div className="relative flex flex-col items-center gap-8">
        {/* Ring Spinner with Logo */}
        <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
          {/* Outermost ring — slow spin */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500 border-r-orange-500/30"
            style={{ animation: 'spin 2.5s linear infinite' }}
          />
          {/* Second ring — medium counter-spin */}
          <div
            className="absolute rounded-full border-2 border-transparent border-b-orange-400/50 border-l-orange-400/20"
            style={{ width: 180, height: 180, animation: 'spin 1.8s linear infinite reverse' }}
          />
          {/* Inner glow ring — pulse */}
          <div
            className="absolute rounded-full border border-orange-500/20 animate-pulse"
            style={{ width: 160, height: 160 }}
          />
          {/* Dot accents on the outer ring */}
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className="absolute w-2 h-2 rounded-full bg-orange-500/60"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${deg}deg) translateY(-100px)`,
                animation: `pulse 2s ease-in-out infinite ${deg * 0.005}s`,
              }}
            />
          ))}
          {/* Logo */}
          <Image
            src="/loanz-logo.png"
            alt="LOANZ 360"
            width={120}
            height={36}
            className="object-contain z-10 drop-shadow-[0_0_20px_rgba(255,103,0,0.15)]"
            priority
          />
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-3">
          <p className="text-white text-lg font-semibold tracking-wide">{text}</p>
          {subText && (
            <p className="text-gray-500 text-sm font-light">{subText}</p>
          )}
          {/* Animated progress dots */}
          <div className="flex justify-center gap-1.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-orange-500"
                style={{
                  animation: 'bounce 1s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomerPageLayout({ children }: CustomerPageLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { individualProfile, isLoading: profileLoading } = useActiveProfile()

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarLoaded, setIsSidebarLoaded] = useState(false)
  // Content is considered ready by default — pages render their own loading states
  // The unified spinner is primarily gated on the sidebar being fully loaded
  const [isContentLoaded, setIsContentLoaded] = useState(true)
  const [showContent, setShowContent] = useState(false)
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const minLoadTimeRef = useRef<number>(Date.now())

  // Minimum time to show the spinner (prevents jarring flash)
  const MIN_LOAD_TIME = 800

  // Profile lock: false = enforce profile completion before dashboard access
  const DEV_BYPASS_PROFILE_LOCK = false

  // Phase 3: Redirect to my-profile if Customer Profile (KYC) is incomplete
  // Only allow my-profile and getting-started pages when profile not complete
  useEffect(() => {
    // DEV: Bypass redirect during development
    if (DEV_BYPASS_PROFILE_LOCK) return

    if (profileLoading) return // Wait for profile to load

    // Pages allowed without profile completion
    const allowedPaths = ['/customers/my-profile', '/customers/getting-started']
    const isAllowedPath = allowedPaths.some(path => pathname?.startsWith(path))

    // Check if profile is incomplete - STRICT check using only profile_completed flag
    const isProfileComplete = individualProfile?.profile_completed === true

    // Redirect to my-profile if profile incomplete and not on allowed page
    if (!isProfileComplete && !isAllowedPath && pathname?.startsWith('/customers')) {
      router.replace('/customers/my-profile')
    }
  }, [individualProfile, profileLoading, pathname, router])

  const setSidebarLoaded = useCallback((loaded: boolean) => {
    setIsSidebarLoaded(loaded)
  }, [])

  const setContentLoaded = useCallback((loaded: boolean) => {
    setIsContentLoaded(loaded)
  }, [])

  // Content is set to loaded by default (true) in state init.
  // Individual pages can set it to false and then true when their data is ready
  // for more granular control. The spinner is primarily gated on sidebar.

  // Coordinate showing content when both sidebar and content are loaded
  useEffect(() => {
    if (isSidebarLoaded && isContentLoaded) {
      const elapsed = Date.now() - minLoadTimeRef.current
      const remainingTime = Math.max(0, MIN_LOAD_TIME - elapsed)

      loadTimeoutRef.current = setTimeout(() => {
        setShowContent(true)
      }, remainingTime)
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
      }
    }
  }, [isSidebarLoaded, isContentLoaded])

  // Fallback: Show content after max wait time even if sidebar loading hangs
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      setShowContent(true)
    }, 8000) // Max 8 seconds wait — safety net only

    return () => clearTimeout(fallbackTimeout)
  }, [])

  return (
    <CustomerLayoutLoadingContext.Provider
      value={{
        isSidebarLoaded,
        isContentLoaded,
        setSidebarLoaded,
        setContentLoaded,
      }}
    >
      {/* Unified full-page spinner — covers sidebar + content until everything is ready */}
      {!showContent && (
        <LogoFloatingSpinner
          text="Loading your profile vault..."
          subText="Your financial data is protected with bank-grade encryption"
        />
      )}

      {/* Main Layout — hidden until ready, still rendered so loading states can trigger */}
      <div className={`min-h-screen bg-black font-poppins flex flex-col transition-opacity duration-500 ease-out ${showContent ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Fixed Transparent Header at Top */}
        <CustomerHeader />

        {/* Mobile hamburger button */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-40 p-2 bg-gray-900 rounded-lg border border-gray-700 text-gray-300 hover:text-white"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Mobile sidebar overlay */}
        {isMobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* Main Layout Container */}
        <div className="flex flex-1">
          {/* Sidebar - hidden on mobile, shown as drawer when open */}
          <aside className={`
            fixed inset-y-0 left-0 z-50 w-[280px] transition-transform duration-300
            md:relative md:translate-x-0 md:w-[20%] md:min-w-[280px] md:z-auto
            ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <CustomerSidebar />
          </aside>

          {/* Main Content Area - Scrolls with page (background controlled by globals.css) */}
          <main className="w-full md:w-[80%] customer-main-content">
            <div className="px-4 md:px-8 pt-[86px] pb-8">
              <div className="space-y-6">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </CustomerLayoutLoadingContext.Provider>
  )
}
