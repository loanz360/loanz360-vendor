'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Bell, User, ChevronDown, LogOut, Building2, Plus, Check, Loader2, BadgeCheck } from 'lucide-react'
import { InlineLoading } from '@/components/ui/loading-spinner'
import { useAuth } from '@/lib/auth/auth-context'
import { Logo } from '@/components/ui/logo'
import { clientLogger } from '@/lib/utils/client-logger'
import { HeaderSearch } from '@/components/ui/header-search'
import { useActiveProfile, Profile, IndividualProfile, EntityProfile } from '@/lib/contexts/active-profile-context'

export default function CustomerHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSignOutModal, setShowSignOutModal] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch real unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setUnreadCount(data.count || 0)
        }
      }
    } catch {
      // Silently fail - badge will show 0
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Profile switching context
  const {
    activeProfile,
    profiles,
    isLoading: profilesLoading,
    switchProfile,
    isEntityProfile
  } = useActiveProfile()

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
    // Always redirect to customers login page since this is the Customer Header
    const redirectPath = '/customers/auth/login'

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

  // Get user's display name
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Customer'
  const displayEmail = user?.email || ''

  // Profile helper functions
  const getProfileDisplay = (profile: Profile) => {
    if (profile.type === 'INDIVIDUAL') {
      const ind = profile as IndividualProfile
      return {
        name: ind.full_name,
        subtitle: ind.income_profile || ind.income_category || 'Individual',
        avatar: ind.profile_photo_url,
        icon: User,
        verified: ind.kyc_status === 'VERIFIED',
        completion: ind.profile_completion
      }
    } else {
      const ent = profile as EntityProfile
      return {
        name: ent.trading_name || ent.legal_name,
        subtitle: ent.entity_type_name || ent.entity_type.replace(/_/g, ' '),
        avatar: ent.logo_url,
        icon: Building2,
        verified: ent.verification_status === 'VERIFIED',
        completion: ent.profile_completion
      }
    }
  }

  const handleSwitchProfile = async (profile: Profile) => {
    if (profile.id === activeProfile?.id) {
      return
    }

    setSwitching(profile.id)
    await switchProfile(profile.id)
    setSwitching(null)
    setShowDropdown(false)

    // Reload the page to reflect the profile change
    window.location.reload()
  }

  const handleAddProfile = () => {
    setShowDropdown(false)
    router.push('/customers/add-profile')
  }

  // Separate profiles by type
  const individualProfiles = profiles.filter(p => p.type === 'INDIVIDUAL')
  const entityProfiles = profiles.filter(p => p.type === 'ENTITY')

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 frosted-header h-[70px]">
        <div className="flex items-center h-full px-6">
          {/* Logo Section - Centered with Sidebar (20% width) */}
          <div className="w-[20%] min-w-[280px] flex justify-center">
            <Logo variant="light" size="sm" href="/customers/dashboard" />
          </div>

          {/* Main Header Content - 80% width */}
          <div className="w-[80%] flex justify-between items-center pr-6">
            {/* Welcome Message Section */}
            <div className="flex-1">
              <p className="text-orange-500/80 text-xs font-medium tracking-wide uppercase mb-0.5">
                Welcome back, {displayName}
              </p>
              <p className="text-gray-400 text-sm">
                Track your loans and manage your applications
              </p>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
            {/* Search Bar */}
            <HeaderSearch
              portal="customer"
              placeholder="Search loans, documents..."
            />

            {/* Notifications */}
            <button
              onClick={() => router.push(`${pathname.split('/').slice(0, 3).join('/')}/notifications`)}
              className="relative p-2.5 text-gray-400 hover:text-orange-500 transition-all duration-200 rounded-xl hover:bg-orange-500/5 border border-transparent hover:border-orange-500/10"
            >
              <Bell className="w-5 h-5" />
              {/* Notification Badge - real unread count */}
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="h-8 w-px bg-gradient-to-b from-transparent via-gray-700/50 to-transparent"></div>

            {/* User Menu Dropdown with Profile Switching */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2.5 px-3 py-2 rounded-xl text-gray-300 hover:text-white transition-all duration-200 border border-white/5 hover:border-orange-500/20 hover:bg-orange-500/5 group"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center overflow-hidden ring-2 transition-all duration-200 ${
                  isEntityProfile
                    ? 'bg-gradient-to-br from-green-600 to-green-800 ring-green-500/20 group-hover:ring-green-500/40'
                    : 'bg-gradient-to-br from-orange-600 to-orange-800 ring-orange-500/20 group-hover:ring-orange-500/40'
                }`}>
                  {activeProfile ? (
                    isEntityProfile ? (
                      (activeProfile as EntityProfile).logo_url ? (
                        <img src={(activeProfile as EntityProfile).logo_url!} alt="Entity" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-4 h-4 text-white" />
                      )
                    ) : (
                      (activeProfile as IndividualProfile).profile_photo_url || user?.avatar_url ? (
                        <img src={(activeProfile as IndividualProfile).profile_photo_url || user?.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )
                    )
                  ) : user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <span className="text-sm font-medium block truncate max-w-[120px]">
                    {activeProfile
                      ? (isEntityProfile
                          ? ((activeProfile as EntityProfile).trading_name || (activeProfile as EntityProfile).legal_name)
                          : (activeProfile as IndividualProfile).full_name)
                      : displayName}
                  </span>
                  {activeProfile && (
                    <span className={`text-xs block ${isEntityProfile ? 'text-green-400' : 'text-gray-500'}`}>
                      {isEntityProfile ? 'Entity' : 'Individual'}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 group-hover:text-orange-500/70 transition-all duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu with Profile Switching */}
              {showDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-black/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  {/* Current Profile Header */}
                  <div className="p-4 border-b border-white/5 bg-gradient-to-r from-orange-500/5 to-transparent">
                    <p className="text-white text-sm font-semibold">{displayName}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{displayEmail}</p>
                  </div>

                  {/* Profile Switching Section */}
                  {!profilesLoading && (
                    <div className="border-b border-white/5">
                      {/* Individual Profiles */}
                      {profiles.length > 0 && individualProfiles.length > 0 && (
                        <div className="py-2">
                          <p className="px-4 py-1 text-xs text-gray-500 font-medium flex items-center gap-2">
                            <User className="w-3 h-3" />
                            Individual Profile
                          </p>
                          {individualProfiles.map((profile) => {
                            const display = getProfileDisplay(profile)
                            const isActive = profile.id === activeProfile?.id
                            const isSwitching = switching === profile.id

                            return (
                              <button
                                key={profile.id}
                                onClick={() => handleSwitchProfile(profile)}
                                disabled={isSwitching}
                                className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all duration-200 ${
                                  isActive
                                    ? 'bg-orange-500/10 border-l-2 border-orange-500'
                                    : 'hover:bg-white/5 border-l-2 border-transparent'
                                }`}
                              >
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {display.avatar ? (
                                    <img src={display.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-4 h-4 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-white truncate">{display.name}</span>
                                    {display.verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                  </div>
                                  <span className="text-xs text-gray-500">{display.subtitle}</span>
                                </div>
                                {isSwitching ? (
                                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                                ) : isActive ? (
                                  <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Entity Profiles */}
                      {profiles.length > 0 && entityProfiles.length > 0 && (
                        <div className="py-2 border-t border-white/5">
                          <p className="px-4 py-1 text-xs text-gray-500 font-medium flex items-center gap-2">
                            <Building2 className="w-3 h-3" />
                            Entity Profiles ({entityProfiles.length})
                          </p>
                          <div className="max-h-[150px] overflow-y-auto">
                            {entityProfiles.map((profile) => {
                              const display = getProfileDisplay(profile)
                              const ent = profile as EntityProfile
                              const isActive = profile.id === activeProfile?.id
                              const isSwitching = switching === profile.id

                              return (
                                <button
                                  key={profile.id}
                                  onClick={() => handleSwitchProfile(profile)}
                                  disabled={isSwitching}
                                  className={`w-full px-4 py-2.5 flex items-center gap-3 transition-all duration-200 ${
                                    isActive
                                      ? 'bg-green-500/10 border-l-2 border-green-500'
                                      : 'hover:bg-white/5 border-l-2 border-transparent'
                                  }`}
                                >
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {display.avatar ? (
                                      <img src={display.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <Building2 className="w-4 h-4 text-white" />
                                    )}
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-medium text-white truncate">{display.name}</span>
                                      {display.verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{display.subtitle}</span>
                                      <span className="text-xs text-green-400">• {ent.role_in_entity}</span>
                                    </div>
                                  </div>
                                  {isSwitching ? (
                                    <Loader2 className="w-4 h-4 text-green-500 animate-spin flex-shrink-0" />
                                  ) : isActive ? (
                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Add New Profile Button */}
                      <div className="p-2">
                        <button
                          onClick={handleAddProfile}
                          className="w-full px-3 py-2.5 flex items-center justify-center gap-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-xl transition-all duration-200 group"
                        >
                          <div className="w-7 h-7 rounded-lg border-2 border-dashed border-orange-500/50 flex items-center justify-center group-hover:border-orange-500 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-medium text-sm">Add New Profile</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {profilesLoading && (
                    <div className="border-b border-white/5 p-6 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                      <span className="ml-2 text-sm text-gray-400">Loading profiles...</span>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="py-2 px-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/customers/my-profile')
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center space-x-3 rounded-xl group"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-800/50 group-hover:bg-orange-500/10 transition-colors">
                        <User className="w-4 h-4 group-hover:text-orange-500" />
                      </div>
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        router.push('/customers/notifications')
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 flex items-center space-x-3 rounded-xl group"
                    >
                      <div className="p-1.5 rounded-lg bg-gray-800/50 group-hover:bg-orange-500/10 transition-colors">
                        <Bell className="w-4 h-4 group-hover:text-orange-500" />
                      </div>
                      <span>Notifications</span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-white/5 p-2">
                    <button
                      onClick={() => {
                        setShowDropdown(false)
                        setShowSignOutModal(true)
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 flex items-center space-x-3 rounded-xl group"
                    >
                      <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                        <LogOut className="w-4 h-4" />
                      </div>
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
                <InlineLoading size="md" />
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
