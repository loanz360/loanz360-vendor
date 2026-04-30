'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { getLogoutRedirect } from '@/lib/auth/auth-hooks'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import NotificationBell from '@/components/notifications/NotificationBell'

interface HeaderProps {
  className?: string
  onMenuToggle?: () => void
  showMenuToggle?: boolean
}

export function Header({ className, onMenuToggle, showMenuToggle = true }: HeaderProps) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // Mock notifications data - replace with real data from API
  const notifications = [
    {
      id: 1,
      title: 'Application Approved',
      message: 'Your loan application has been approved.',
      time: '2 minutes ago',
      read: false,
      type: 'success'
    },
    {
      id: 2,
      title: 'Document Required',
      message: 'Please upload additional documents.',
      time: '1 hour ago',
      read: false,
      type: 'warning'
    },
    {
      id: 3,
      title: 'Payment Reminder',
      message: 'EMI payment due in 3 days.',
      time: '1 day ago',
      read: true,
      type: 'info'
    }
  ]

  const unreadCount = notifications.filter(n => !n.read).length

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    // Store redirect path BEFORE signing out (user will be null after signOut)
    const redirectPath = getLogoutRedirect(user?.role as unknown, user?.sub_role) || '/auth/login'
    await signOut()
    // Use hard redirect to ensure complete state reset
    window.location.href = redirectPath
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  return (
    <header className={cn("header flex items-center justify-between px-6 py-3", className)}>
      {/* Left Section */}
      <div className="flex items-center space-x-4">
        {/* Menu Toggle for Mobile */}
        {showMenuToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
          >
            <MenuIcon />
          </Button>
        )}

        {/* Welcome Message */}
        {user && (
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-foreground font-poppins">
              {getGreeting()}, {user.full_name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome to your {user.role?.toLowerCase().replace(/_/g, ' ')} dashboard
            </p>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="hidden md:flex">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Notifications */}
        <NotificationBell />

        {/* Messages */}
        <Button variant="ghost" size="icon">
          <MessageIcon />
        </Button>

        {/* Profile Dropdown */}
        {user && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 hover:bg-muted rounded-md p-2 transition-colors"
            >
              <UserAvatar
                src={user.avatar_url}
                name={user.full_name}
                role={user.role}
                size="sm"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground">
                  {user.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.role?.replace(/_/g, ' ')}
                </p>
              </div>
              <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      src={user.avatar_url}
                      name={user.full_name}
                      role={user.role}
                      verified={user.email_verified && user.mobile_verified}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-primary">
                        {user.user_metadata?.generated_id || 'USER001'}
                      </p>
                      <div className="flex items-center space-x-1 mt-1">
                        <Badge variant="ash" size="sm">
                          {user.role?.replace(/_/g, ' ')}
                        </Badge>
                        {user.email_verified && user.mobile_verified && (
                          <span className="text-xs text-success">✓ Verified</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      router.push(`/${user.role?.toLowerCase()}/profile`)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center space-x-2"
                  >
                    <ProfileIcon className="w-4 h-4" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      router.push(`/${user.role?.toLowerCase()}/settings`)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center space-x-2"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      router.push('/help')
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center space-x-2"
                  >
                    <HelpIcon className="w-4 h-4" />
                    <span>Help & Support</span>
                  </button>
                </div>

                <div className="border-t border-border py-2">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      handleLogout()
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center space-x-2 text-error"
                  >
                    <LogoutIcon className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}

// Icon Components
const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const MessageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
)

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

const ProfileIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const HelpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)