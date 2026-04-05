'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, User, ChevronDown, LogOut, HelpCircle, Check, X, Eye } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Logo } from '@/components/ui/logo'
import { clientLogger } from '@/lib/utils/client-logger'
import { HeaderSearch } from '@/components/ui/header-search'
import { formatDistanceToNow } from 'date-fns'

export default function EmployeeHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Array<{
    id: string; title: string; message: string; type?: string;
    is_read: boolean; created_at: string; action_url?: string; source?: string
  }>>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/employees/notifications?count_only=true')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unread_count || 0)
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [user, fetchUnreadCount])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false)
      }
    }

    if (showDropdown || showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown, showNotifDropdown])

  const fetchNotifications = async () => {
    setNotifLoading(true)
    try {
      const res = await fetch('/api/employees/notifications?limit=10')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.data || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch {
      // Silently fail
    } finally {
      setNotifLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await fetch('/api/employees/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: [id] })
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) { console.warn('Failed to mark notification as read', err) }
  }

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await fetch('/api/employees/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true })
      })
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) { console.warn('Failed to mark all notifications as read', err) }
  }

  const handleSignOut = async () => {
    // Always redirect to employees login page since this is the Employee Header
    const redirectPath = '/employees/auth/login'

    try {
      // isSigningOut is already set to true before calling this function
      await signOut()
      // Small delay to ensure auth state is cleared
      await new Promise(resolve => setTimeout(resolve, 300))
      // Use Next.js router for cleaner client-side navigation
      router.push(redirectPath)
    } catch (error) {
      clientLogger.error('Logout error', { error: error instanceof Error ? error.message : String(error) })
      // Even on error, redirect to login page
      router.push(redirectPath)
    }
  }

  // Get user's display name
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Employee'
  const displayEmail = user?.email || ''

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 frosted-header border-b-0 h-[70px]">
        <div className="flex items-center h-full px-6">
          {/* Logo Section - Centered with Sidebar (20% width) */}
          <div className="w-[20%] min-w-[280px] flex justify-center">
            <Logo variant="light" size="sm" />
          </div>

          {/* Main Header Content - 80% width */}
          <div className="w-[80%] flex justify-between items-center pr-6">
            {/* Welcome Message Section */}
            <div className="flex-1">
              <h1 className="text-lg font-bold font-poppins leading-tight">
                👋 Welcome back, {displayName}
              </h1>
              <p className="text-gray-400 text-base">
                Manage your tasks and track your performance
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <HeaderSearch
              portal="employee"
              placeholder="Search tasks, leads..."
            />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown)
                  if (!showNotifDropdown) fetchNotifications()
                }}
                className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800/30"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-96 bg-gray-900/95 backdrop-blur-lg border border-gray-700/50 rounded-lg shadow-2xl z-50">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <div>
                      <h3 className="font-semibold font-poppins text-white">Notifications</h3>
                      {unreadCount > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {unreadCount} unread
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Mark all as read"
                        >
                          <Check className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifDropdown(false)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Loading */}
                  {notifLoading && (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  )}

                  {/* Empty */}
                  {!notifLoading && notifications.length === 0 && (
                    <div className="p-8 text-center">
                      <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No notifications</p>
                    </div>
                  )}

                  {/* List */}
                  {!notifLoading && notifications.length > 0 && (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`block p-4 border-b border-gray-700/30 hover:bg-white/5 transition-colors cursor-pointer ${
                            !n.is_read ? 'bg-orange-500/5' : ''
                          }`}
                          onClick={() => {
                            if (n.action_url) {
                              router.push(n.action_url)
                              setShowNotifDropdown(false)
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 pt-1">
                              {!n.is_read && (
                                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm mb-1 line-clamp-1">
                                {n.title}
                              </p>
                              <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                                {n.message}
                              </p>
                              <div className="flex items-center justify-between">
                                <p className="text-gray-500 text-xs">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </p>
                                {!n.is_read && (
                                  <button
                                    onClick={(e) => handleMarkAsRead(n.id, e)}
                                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  {!notifLoading && notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-700/50">
                      <button
                        onClick={() => {
                          router.push('/employees/notifications')
                          setShowNotifDropdown(false)
                        }}
                        className="block w-full text-center text-orange-400 hover:text-orange-300 text-sm font-medium py-2 hover:bg-white/5 rounded transition-colors"
                      >
                        View all notifications
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="text-base font-medium">{displayName}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-900/95 backdrop-blur-lg rounded-lg shadow-xl border border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-gray-700/50">
                    <p className="text-white text-sm font-medium">{displayName}</p>
                    <p className="text-gray-400 text-xs">{displayEmail}</p>
                  </div>

                  <div className="py-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/employees/profile')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                    >
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/employees/notifications')
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white hover:bg-gray-800/50 transition-colors flex items-center space-x-2"
                    >
                      <Bell className="w-4 h-4" />
                      <span>Notifications</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/employees/support')
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
