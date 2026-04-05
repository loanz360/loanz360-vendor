'use client'

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight,
  FileText,
  Users,
  Receipt,
  Landmark,
  ShieldCheck,
  Briefcase,
  Building,
  Building2,
  FileCheck,
  Scale,
  UserCircle,
  Plus,
  Lock,
  Crown,
  Check,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { getCustomerConfig } from '@/lib/services/customer-config-service'
import type { MenuItem, MenuSection } from '@/lib/services/customer-config-service'
import { clientLogger } from '@/lib/utils/client-logger'
import { useCustomerLayoutLoading } from '@/components/customers/CustomerPageLayout'
import { useActiveProfile, EntityProfile, IndividualProfile } from '@/lib/contexts/active-profile-context'
import ProfileCompletionModal, { wasReminderDismissedRecently } from '@/components/customers/ProfileCompletionModal'
import ProfileManagementCard from '@/components/customers/sidebar/ProfileManagementCard'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'

// Cache for menu items with expiration
interface MenuCacheEntry {
  items: MenuItem[]
  sections?: MenuSection[]
  timestamp: number
}

// Cache for customer profile with expiration
interface ProfileCacheEntry {
  profile: CustomerProfile | null
  entities: EntityMembership[]
  timestamp: number
}

const menuCache = new Map<string, MenuCacheEntry>()
const profileCache = new Map<string, ProfileCacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache duration

// Clear cache functions for external use
export function clearCustomerMenuCache(subRole?: string): void {
  if (subRole) {
    menuCache.delete(subRole.toUpperCase())
  } else {
    menuCache.clear()
  }
}

export function clearCustomerProfileCache(userId?: string): void {
  if (userId) {
    profileCache.delete(userId)
  } else {
    profileCache.clear()
  }
}

interface CustomerProfile {
  id: string
  unique_id: string
  full_name: string
  profile_photo_url: string | null
  primary_category: string | null
}

interface EntityMembership {
  id: string
  role: string
  is_admin: boolean
  entity: {
    id: string
    unique_id: string
    entity_name: string
    entity_type: string
  }
}

// Customer profile entry (for multiple profiles)
interface CustomerProfileEntry {
  id: string
  unique_id: string
  profile_name: string
  profile_type: string // INDIVIDUAL, SALARIED, BUSINESS, etc.
  is_primary: boolean
  created_at: string
}

// Entity-specific menu items - will be populated based on entity type
const ENTITY_MENU_SECTIONS: MenuSection[] = []

function CustomerSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[] | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null)
  const [entityMemberships, setEntityMemberships] = useState<EntityMembership[]>([])
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfileEntry[]>([])

  // Profile completion modal state
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Get active profile context for profile switching
  const { activeProfile, isEntityProfile, isIndividualProfile, profiles, individualProfile, switchProfile } = useActiveProfile()

  // Profile switching state (Facebook-style switching from sidebar)
  const [switchingProfileId, setSwitchingProfileId] = useState<string | null>(null)

  // DEV MODE: Set to true to bypass profile lock during development
  // PRODUCTION: Set to false to enforce profile completion before accessing menu links
  const DEV_BYPASS_PROFILE_LOCK = false

  // Check if My Profile (individual profile) is complete
  // Phase 3: Profile is complete ONLY when profile_completed flag is TRUE (KYC completed)
  // All menu links are locked until this flag is true
  const isMyProfileComplete = useMemo(() => {
    // DEV: Bypass lock during development
    if (DEV_BYPASS_PROFILE_LOCK) return true

    if (!individualProfile) return false
    // STRICT check: Only profile_completed flag determines completion
    // This ensures all menu links stay locked until KYC is fully complete
    return individualProfile.profile_completed === true
  }, [individualProfile])

  // Phase 3: ONLY My Profile is allowed when Customer Profile (KYC) is incomplete
  // ALL other links are disabled until profile_completed = true
  const allowedLinksWithoutProfile = [
    '/customers/my-profile',
    '/customers/getting-started'
  ]

  // Check if a link should be disabled
  const isLinkDisabled = useCallback((href: string): boolean => {
    if (isMyProfileComplete) return false
    // Allow exact matches or paths that start with allowed links
    return !allowedLinksWithoutProfile.some(allowed =>
      href === allowed || href.startsWith(allowed + '/')
    )
  }, [isMyProfileComplete])

  // Handle click on disabled link
  const handleDisabledLinkClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only show modal if not recently dismissed
    if (!wasReminderDismissedRecently()) {
      setShowProfileModal(true)
    }
  }, [])

  // Handle profile switching (Facebook-style) - mirrors CustomerHeader.tsx pattern
  const handleSwitchProfile = useCallback(async (profileId: string) => {
    if (profileId === activeProfile?.id) return
    setSwitchingProfileId(profileId)
    await switchProfile(profileId)
    setSwitchingProfileId(null)
    window.location.reload()
  }, [activeProfile?.id, switchProfile])

  // Get layout loading context to coordinate with main content
  const { setSidebarLoaded } = useCustomerLayoutLoading()

  // Track previous sub_role to detect changes
  const prevSubRoleRef = useRef<string>('')

  // Load customer profile from API with caching
  useEffect(() => {
    async function loadCustomerProfile() {
      if (!user?.id) return

      // Check cache first
      const cached = profileCache.get(user.id)
      const now = Date.now()

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setCustomerProfile(cached.profile)
        setEntityMemberships(cached.entities)
        return
      }

      try {
        const response = await fetch('/api/customers/profile', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.profile) {
            setCustomerProfile(data.profile)
            const entities = data.entities || []
            setEntityMemberships(entities)
            // Set customer profiles if available from API
            const profiles = data.profiles || []
            setCustomerProfiles(profiles)
            // Cache the result
            profileCache.set(user.id, {
              profile: data.profile,
              entities,
              timestamp: now
            })
          }
        }
      } catch (error) {
        clientLogger.error('Error loading customer profile', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    loadCustomerProfile()
  }, [user?.id])

  // Invalidate cache when sub_role changes
  useEffect(() => {
    const currentSubRole = user?.sub_role?.toUpperCase() || ''
    if (prevSubRoleRef.current && prevSubRoleRef.current !== currentSubRole) {
      clearCustomerMenuCache(prevSubRoleRef.current)
      clientLogger.debug('Sub role changed, clearing menu cache', {
        from: prevSubRoleRef.current,
        to: currentSubRole
      })
    }
    prevSubRoleRef.current = currentSubRole
  }, [user?.sub_role])

  // Load menu items based on user's subrole with caching
  useEffect(() => {
    async function loadMenuItems() {
      if (!user?.sub_role) {
        clientLogger.warn('No user sub_role found', { user })
        setLoading(false)
        return
      }

      const cacheKey = user.sub_role.toUpperCase()
      const now = Date.now()

      // Check cache first
      const cached = menuCache.get(cacheKey)
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setMenuItems(cached.items)
        setMenuSections(cached.sections)
        setLoading(false)
        return
      }

      try {
        clientLogger.debug('Loading customer config for sub_role', { sub_role: user.sub_role })
        const config = await getCustomerConfig(user.sub_role)
        clientLogger.debug('Customer config loaded', { config, menuItemsCount: config?.menuItems.length })

        if (config && config.menuItems && config.menuItems.length > 0) {
          setMenuItems(config.menuItems)
          setMenuSections(config.menuSections)
          // Cache the result
          menuCache.set(cacheKey, {
            items: config.menuItems,
            sections: config.menuSections,
            timestamp: now
          })
          clientLogger.debug('Menu items set and cached', { count: config.menuItems.length, hasSections: !!config.menuSections })
        } else {
          clientLogger.warn('No menu items in config', { config })
        }
      } catch (error) {
        clientLogger.error('Error loading customer menu config', {
          error: error instanceof Error ? error.message : String(error),
          sub_role: user.sub_role
        })
      } finally {
        setLoading(false)
      }
    }

    loadMenuItems()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sub_role])

  // Notify layout when sidebar is loaded
  useEffect(() => {
    if (!loading) {
      setSidebarLoaded(true)
    }
  }, [loading, setSidebarLoaded])

  // Memoize isActive function
  const isActive = useCallback((href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    // For non-exact matches, check if pathname starts with href
    // AND either pathname === href OR the next character is a '/'
    // This prevents /customers from matching /customers-other
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }, [pathname])

  // Memoize role display name - includes all 13 subroles + legacy mappings
  const roleDisplayName = useMemo(() => {
    if (!user?.sub_role) return 'Customer'

    const displayNames: Record<string, string> = {
      // Primary 13 Subroles
      'INDIVIDUAL': 'Individual',
      'SALARIED': 'Salaried',
      'PROFESSIONAL': 'Professional',
      'BUSINESS': 'Business',
      'MSME': 'MSME',
      'AGRICULTURE': 'Agriculture',
      'PENSIONER': 'Pensioner',
      'NRI': 'NRI',
      'WOMEN': 'Women Entrepreneur',
      'STUDENT': 'Student',
      'GIG_ECONOMY': 'Gig Economy',
      'INSTITUTIONAL': 'Institutional',
      'SPECIAL': 'Special Category',
      // Legacy Subroles (backward compatibility)
      'PROPRIETOR': 'Proprietor',
      'PARTNERSHIP': 'Partnership',
      'PRIVATE_LIMITED_COMPANY': 'Private Limited',
      'PUBLIC_LIMITED_COMPANY': 'Public Limited',
      'LLP': 'LLP',
      'HUF': 'HUF',
      'DOCTOR': 'Doctor',
      'LAWYER': 'Lawyer',
      'CHARTERED_ACCOUNTANT': 'Chartered Accountant',
      'COMPANY_SECRETARY': 'Company Secretary',
      'PURE_RENTAL': 'Rental Income',
    }

    return displayNames[user.sub_role] || user.sub_role.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }, [user?.sub_role])

  // Cast active profile for entity-specific fields
  const activeEntityProfile = isEntityProfile ? (activeProfile as EntityProfile) : null

  // Split profiles into individual and entity categories for MY PROFILE section
  // Filter out placeholder profiles (unique_id === 'Pending') - these have no real individuals record
  // and should not appear as clickable entries in the sidebar
  const { individualProfilesList, entityProfilesList } = useMemo(() => {
    const individual = profiles.filter(p => p.type === 'INDIVIDUAL' && p.unique_id !== 'Pending') as IndividualProfile[]
    const entity = profiles.filter(p => p.type === 'ENTITY') as EntityProfile[]
    return { individualProfilesList: individual, entityProfilesList: entity }
  }, [profiles])

  // Active profile completion data for the profile card
  const activeProfileCompletion = useMemo(() => {
    if (!activeProfile) return { percent: 0, label: 'Not Started' }
    const pct = activeProfile.profile_completion || 0
    if (pct >= 100) return { percent: 100, label: 'Complete' }
    if (pct >= 75) return { percent: pct, label: 'Almost Done' }
    if (pct >= 50) return { percent: pct, label: 'In Progress' }
    if (pct > 0) return { percent: pct, label: 'Getting Started' }
    return { percent: 0, label: 'Not Started' }
  }, [activeProfile])

  // KYC / Verification status for badge display
  const profileStatusBadge = useMemo(() => {
    if (isEntityProfile && activeEntityProfile) {
      const vs = activeEntityProfile.verification_status
      if (vs === 'VERIFIED') return { text: 'Verified', color: 'text-green-400 bg-green-500/20 border-green-500/30' }
      if (vs === 'REJECTED') return { text: 'Rejected', color: 'text-red-400 bg-red-500/20 border-red-500/30' }
      return { text: 'Pending', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' }
    }
    if (individualProfile) {
      const ks = individualProfile.kyc_status
      if (ks === 'VERIFIED') return { text: 'KYC Verified', color: 'text-green-400 bg-green-500/20 border-green-500/30' }
      if (ks === 'REJECTED') return { text: 'KYC Rejected', color: 'text-red-400 bg-red-500/20 border-red-500/30' }
      if (ks === 'EXPIRED') return { text: 'KYC Expired', color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' }
      return { text: 'KYC Pending', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' }
    }
    return null
  }, [isEntityProfile, activeEntityProfile, individualProfile])

  // Total real profiles count for the switcher header
  const totalProfilesCount = individualProfilesList.length + entityProfilesList.length

  // Reorganize menu sections - MY PROFILE is now on the Golden Profile Card footer
  const reorganizedMenuSections = useMemo(() => {
    if (!menuSections || menuSections.length === 0) return menuSections

    // Filter out MY PROFILE section - it's now on the Golden Profile Card footer
    return menuSections.filter(section => section.title !== 'MY PROFILE')
  }, [menuSections])

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      {/* Golden Profile Card — Always shows the CUSTOMER (individual) profile, never changes on profile switch */}
      <GoldenProfileCard
        userName={customerProfile?.full_name || user?.full_name || user?.email || 'Customer'}
        userId={customerProfile?.unique_id || individualProfile?.unique_id || 'Pending'}
        avatarUrl={customerProfile?.profile_photo_url || user?.avatar_url}
        avatarFallbackIcon="user"
        verificationItems={
          individualProfile
            ? [
                { label: individualProfile.kyc_status === 'VERIFIED' ? 'KYC Verified' : 'KYC Pending', verified: individualProfile.kyc_status === 'VERIFIED' },
                { label: individualProfile.pan_verified ? 'PAN Verified' : 'PAN Pending', verified: !!individualProfile.pan_verified },
                { label: individualProfile.aadhaar_verified ? 'Aadhaar Verified' : 'Aadhaar Pending', verified: !!individualProfile.aadhaar_verified },
              ]
            : []
        }
        completionPercentage={individualProfile?.profile_completion || 0}
        profileLink={'/customers/my-profile?showForm=true'}
        isProfileComplete={isMyProfileComplete}
        enableGatekeeping={!DEV_BYPASS_PROFILE_LOCK}
        onDisabledClick={handleDisabledLinkClick}
        currentPath={pathname}
      />

      {/* Profile Management Card - Avatar Strip + Footer Actions */}
      <ProfileManagementCard
        onSwitchProfile={handleSwitchProfile}
        switchingProfileId={switchingProfileId}
      />

      {/* Navigation Menu */}
      <div className="py-4 flex-1 flex flex-col">
        {loading ? (
          /* Empty placeholder while menu loads — full-page spinner covers this */
          <div className="px-3 py-8" />
        ) : reorganizedMenuSections && reorganizedMenuSections.length > 0 ? (
          // Render sectioned menu with headings (new format)
          // Uses reorganizedMenuSections to show "COMPLETE YOUR PROFILE" at top when profile incomplete
          <>
            {/* Entity-specific sections first when entity profile is active */}
            {isEntityProfile && ENTITY_MENU_SECTIONS.map((section, sectionIndex) => (
              <div key={`entity-${sectionIndex}`} className="mb-2">
                {/* Section Header */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-violet-500/50"></div>
                    <span className="text-[10px] font-semibold tracking-wider text-violet-400/80 uppercase">
                      {section.title}
                    </span>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-violet-500/50 to-transparent"></div>
                  </div>
                </div>

                {/* Section Menu Items */}
                {section.items.map((item, index) => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact)
                  const disabled = isLinkDisabled(item.href)

                  if (disabled) {
                    return (
                      <div key={index} className="px-3">
                        <button
                          onClick={handleDisabledLinkClick}
                          className="w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex text-gray-500 bg-gray-800/30 cursor-not-allowed border border-gray-700/50 relative"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-3">
                              <Icon className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            <Lock className="w-3.5 h-3.5 text-gray-600" />
                          </div>
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div key={index} className="px-3">
                      <Link
                        href={item.href}
                        prefetch={false}
                        className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex ${
                          active
                            ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20'
                            : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                        }`}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-3">
                            <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-violet-400'}`} />
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              active
                                ? 'bg-white text-violet-600'
                                : 'bg-violet-500 text-white'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Common menu sections header when entity is active */}
            {isEntityProfile && (
              <div className="px-4 pt-6 pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-gray-500/50"></div>
                  <span className="text-[10px] font-semibold tracking-wider text-gray-400/80 uppercase">
                    Common
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-500/50 to-transparent"></div>
                </div>
              </div>
            )}

            {/* Regular menu sections (reorganized based on profile completion) */}
            {reorganizedMenuSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-2">
                {/* Section Header - Skip for MAIN section */}
                {section.title !== 'MAIN' && (
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-orange-500/50"></div>
                      <span className="text-[10px] font-semibold tracking-wider text-orange-400/80 uppercase">
                        {section.title}
                      </span>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
                    </div>
                  </div>
                )}

                {/* Section Menu Items */}
                {(section.title === 'MY PROFILE' || section.title === 'COMPLETE YOUR PROFILE') ? (
                  // Simplified MY PROFILE section - only the "My Profile" navigation link
                  // Profile listing and switching is now in the Profile Switcher card above
                  <>
                    {section.items.filter(item => item.href !== '/customers/add-profile').map((item, index) => {
                      const Icon = item.icon
                      const active = isActive(item.href, item.exact)
                      const disabled = isLinkDisabled(item.href)

                      if (disabled) {
                        return (
                          <div key={`myprofile-${index}`} className="px-3">
                            <button
                              onClick={handleDisabledLinkClick}
                              className="w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex text-gray-500 bg-gray-800/30 cursor-not-allowed border border-gray-700/50 relative"
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-3">
                                  <Icon className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                <Lock className="w-3.5 h-3.5 text-gray-600" />
                              </div>
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div key={`myprofile-${index}`} className="px-3">
                          <Link
                            href={item.href}
                            prefetch={false}
                            className={`w-full px-3 py-3 mb-1 rounded-lg transition-all duration-200 text-left group flex ${
                              active
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-gradient-to-r from-amber-900/30 to-yellow-900/20 hover:from-amber-900/50 hover:to-yellow-900/40 border border-amber-500/30'
                            }`}
                            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-3">
                                <Crown className={`w-5 h-5 ${active ? 'text-white' : 'text-amber-400'}`} />
                                <span className={`text-base font-semibold ${active ? 'text-white' : 'text-amber-400'}`}>{item.label}</span>
                              </div>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                                active ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                Primary
                              </span>
                            </div>
                          </Link>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  // Normal rendering for other sections
                  section.items.map((item, index) => {
                    const Icon = item.icon
                    const active = isActive(item.href, item.exact)
                    const disabled = isLinkDisabled(item.href)

                    // If disabled, render a button instead of a link
                    if (disabled) {
                      return (
                        <div key={index} className="px-3">
                          <button
                            onClick={handleDisabledLinkClick}
                            className="w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex text-gray-500 bg-gray-800/30 cursor-not-allowed border border-gray-700/50 relative"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center space-x-3">
                                <Icon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium">{item.label}</span>
                              </div>
                              <Lock className="w-3.5 h-3.5 text-gray-600" />
                            </div>
                            {/* Tooltip on hover */}
                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-50">
                              <div className="bg-gray-800 text-gray-300 text-xs px-3 py-2 rounded-lg shadow-lg border border-gray-700 whitespace-nowrap">
                                Complete your profile to unlock
                              </div>
                            </div>
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div key={index} className="px-3">
                        <Link
                          href={item.href}
                          prefetch={false}
                          className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex ${
                            active
                              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                              : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                          }`}
                          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                                active
                                  ? 'bg-white text-orange-600'
                                  : 'bg-orange-500 text-white'
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                    )
                  })
                )}
              </div>
            ))}
          </>
        ) : menuItems.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            No menu items available
          </div>
        ) : (
          // Fallback to flat menu items (legacy support)
          menuItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.href, item.exact)
            const disabled = isLinkDisabled(item.href)

            if (disabled) {
              return (
                <div key={index} className="px-3">
                  <button
                    onClick={handleDisabledLinkClick}
                    className="w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex text-gray-500 bg-gray-800/30 cursor-not-allowed border border-gray-700/50 relative"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <Icon className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <Lock className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  </button>
                </div>
              )
            }

            return (
              <div key={index}>
                {/* Main Menu Item */}
                <div className="px-3">
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group flex ${
                      active
                        ? 'bg-orange-500 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profileCompletion={activeProfile?.profile_completion || 0}
        userName={customerProfile?.full_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'there'}
      />
    </div>
  )
}

// Memoize the entire component to prevent unnecessary re-renders
export default memo(CustomerSidebar)
