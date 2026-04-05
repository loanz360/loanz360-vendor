'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { Button } from '@/components/ui/button'
import { User, ChevronDown, LogOut, Bell, HelpCircle, Menu } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import Image from 'next/image'
import { clientLogger } from '@/lib/utils/client-logger'
import { NotificationDropdown } from '@/components/partners/shared/NotificationDropdown'
import { HeaderSearch } from '@/components/ui/header-search'
import { ThemeToggle } from '@/components/partners/shared/ThemeToggle'

export function BAHeader({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  const handleSignOut = async () => {
    // Always redirect to partners login page since this is the BA (Business Associate) Header
    const redirectPath = '/partners/auth/login'

    try {
      // isSigningOut is already set to true before calling this function
      await signOut()
      // Small delay to ensure auth state is cleared
      await new Promise(resolve => setTimeout(resolve, 300))
      // Use hard redirect to ensure complete state reset
      window.location.href = redirectPath
    } catch (error) {
      clientLogger.error('Logout error', { error: error instanceof Error ? error.message : String(error) })
      // Even on error, redirect to login page using hard redirect
      window.location.href = redirectPath
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 frosted-header border-b-0 h-[70px]">
        <div className="flex items-center h-full px-4 lg:px-6">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden mr-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="w-6 h-6 text-white" />
          </button>

          {/* Logo Section - Centered with Sidebar (20% width) */}
          <div className="hidden lg:flex w-[20%] min-w-[280px] justify-center">
            <Logo variant="light" size="sm" />
          </div>
          <div className="lg:hidden">
            <Logo variant="light" size="sm" />
          </div>

          {/* Main Header Content */}
          <div className="flex-1 lg:w-[80%] flex justify-between items-center pr-2 lg:pr-6">
            {/* Welcome Message Section */}
            <div className="flex-1 hidden sm:block">
              <h1 className="text-xl font-bold font-poppins leading-tight">
                Welcome back, {user?.full_name || 'Business Associate'}
              </h1>
              <p className="text-gray-400 text-base hidden md:block">
                Track your leads, monitor performance, and achieve your goals.
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Search Bar */}
              <HeaderSearch
                portal="partner"
                placeholder="Search leads, payouts..."
              />

              {/* Notifications */}
              <NotificationDropdown partnerType="ba" />

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Divider */}
              <div className="h-6 w-px bg-gray-700/50"></div>

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/30 transition-all duration-200 border border-gray-700/30 hover:border-gray-600"
                >
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                    {user?.avatar_url ? (
                      <Image
                        src={user.avatar_url}
                        alt="Profile"
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <span className="text-base font-medium">{user?.full_name || 'Business Associate'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-gray-700/50">
                      <p className="text-white text-sm font-medium">{user?.full_name || 'Business Associate'}</p>
                      <p className="text-gray-400 text-xs">{user?.email || 'ba@loanz360.com'}</p>
                    </div>

                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/partners/ba/profile')
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                      >
                        <User className="w-4 h-4" />
                        <span>My Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/partners/ba/notifications')
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Notifications</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          router.push('/partners/ba/support-tickets')
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>Support</span>
                      </button>
                    </div>

                    <div className="border-t border-gray-700/50 py-2">
                      <button
                        onClick={() => {
                          setShowDropdown(false)
                          setShowSignOutModal(true)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center space-x-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700/50 p-6 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-semibold mb-3 font-poppins">Confirm Sign Out</h3>
            <p className="text-gray-400 text-sm mb-6">
              Are you sure you want to sign out?
            </p>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowSignOutModal(false)}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                No, Stay Logged In
              </Button>
              <Button
                onClick={() => {
                  setIsSigningOut(true)
                  setShowSignOutModal(false)
                  handleSignOut()
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Yes, Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Signing Out Overlay */}
      {isSigningOut && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center">
          <div className="bg-gray-900/90 rounded-xl shadow-2xl border border-gray-700/50 p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-700 border-t-orange-500 rounded-full animate-spin"></div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 font-poppins">Signing Out...</h3>
                <p className="text-gray-400 text-sm">
                  Please wait while we securely log you out
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
