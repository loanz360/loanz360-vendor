'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, User, ChevronDown, LogOut, Zap, HelpCircle } from 'lucide-react'
import { SecureSessionStorage } from '@/lib/auth/session-storage'
import { Logo } from '@/components/ui/logo'
import { clientLogger } from '@/lib/utils/client-logger'
import NotificationBellBadge from '@/components/notifications/NotificationBellBadge'
import { useSuperAdminAuth } from '@/lib/auth/super-admin-auth-context'
import { HeaderSearch } from '@/components/ui/header-search'

export default function SuperAdminHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useSuperAdminAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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
    try {
      // Call logout API to clear HTTP-Only cookies on server
      await fetch('/api/superadmin/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
      })
    } catch (error) {
      clientLogger.error('Logout error', { error: error instanceof Error ? error.message : String(error) })
    } finally {
      // Clear any client-side metadata
      SecureSessionStorage.clearSession()

      // Use hard redirect to ensure complete state reset
      window.location.href = '/superadmin/auth/login'
    }
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 frosted-header border-b-0 h-[70px]">
        <div className="flex items-center h-full px-6">
          {/* Logo Section - Centered with Sidebar (20% width) */}
          <div className="w-[20%] min-w-[280px] flex justify-center">
            <Logo size="sm" />
          </div>

          {/* Main Header Content - 80% width */}
          <div className="w-[80%] flex justify-between items-center pr-6">
            {/* Welcome Message Section */}
            <div className="flex-1">
              <h1 className="text-lg font-bold font-poppins leading-tight text-white">
                Welcome back, {user?.fullName || 'Super Admin'}
              </h1>
              <p className="text-gray-400 text-base">
                Here's what's happening with your loan management platform today.
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <HeaderSearch
              portal="superadmin"
              placeholder="Search users, leads, partners..."
            />

            {/* Notifications */}
            <NotificationBellBadge onClick={() => router.push('/superadmin/notifications')} userId={user?.id} />

            {/* Divider */}
            <div className="h-6 w-px bg-gray-700/50"></div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800/30 transition-all duration-200 border border-gray-700/30 hover:border-gray-600"
              >
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-base font-medium">{user?.fullName || 'Super Admin'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-gray-700/50">
                    <p className="text-white text-sm font-medium">{user?.fullName || 'Super Admin'}</p>
                    <p className="text-gray-400 text-xs">{user?.email || 'admin@loanz360.com'}</p>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/superadmin/realtime-feed')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Real-Time Activity Feed</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/superadmin/my-profile')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/superadmin/notifications')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Notifications</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/superadmin/support-tickets')
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
    </>
  )
}
