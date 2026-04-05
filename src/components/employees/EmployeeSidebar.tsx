'use client'

import React, { useEffect, useState, useMemo, useCallback, memo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'
import { getEmployeeConfig } from '@/lib/services/employee-config-service'
import type { MenuItem, MenuSection } from '@/lib/services/employee-config-service'
import { clientLogger } from '@/lib/utils/client-logger'
import { createClient } from '@/lib/supabase/client'

// Statuses where menu gatekeeping is active (profile not yet approved)
const GATEKEEPING_STATUSES = ['PENDING_ONBOARDING', 'PENDING_PROFILE_REVIEW', 'NEEDS_PROFILE_CORRECTION']

// Menu items that are always accessible even during gatekeeping
const ALWAYS_ACCESSIBLE_LABELS = ['Dashboard', 'My Profile']
const ALWAYS_ACCESSIBLE_HREFS = ['/employees', '/employees/profile']

// Cache menu items with expiration to allow updates
interface CacheEntry {
  items: MenuItem[]
  sections?: MenuSection[]
  timestamp: number
  roleKey: string
}

const menuCache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache duration

// Mapping of role names to their proper keys (for cases where name is stored instead of key)
const ROLE_NAME_TO_KEY_MAP: Record<string, string> = {
  'TELE SALES': 'TELE_SALES',
  'CUSTOMER RELATIONSHIP OFFICER': 'CRO',
  'BUSINESS DEVELOPMENT EXECUTIVE': 'BUSINESS_DEVELOPMENT_EXECUTIVE',
  'BUSINESS DEVELOPMENT MANAGER': 'BUSINESS_DEVELOPMENT_MANAGER',
  'DIGITAL SALES': 'DIGITAL_SALES',
  'CHANNEL PARTNER EXECUTIVE': 'CHANNEL_PARTNER_EXECUTIVE',
  'CHANNEL PARTNER MANAGER': 'CHANNEL_PARTNER_MANAGER',
  'FINANCE EXECUTIVE': 'FINANCE_EXECUTIVE',
  'ACCOUNTS EXECUTIVE': 'ACCOUNTS_EXECUTIVE',
  'ACCOUNTS MANAGER': 'ACCOUNTS_MANAGER',
  'DIRECT SALES EXECUTIVE': 'DIRECT_SALES_EXECUTIVE',
  'DIRECT SALES MANAGER': 'DIRECT_SALES_MANAGER',
  'PARTNER SUPPORT EXECUTIVE': 'PARTNER_SUPPORT_EXECUTIVE',
  'PARTNER SUPPORT MANAGER': 'PARTNER_SUPPORT_MANAGER',
  'CUSTOMER SUPPORT EXECUTIVE': 'CUSTOMER_SUPPORT_EXECUTIVE',
  'CUSTOMER SUPPORT MANAGER': 'CUSTOMER_SUPPORT_MANAGER',
  'PAYOUT SPECIALIST': 'PAYOUT_SPECIALIST',
  'TECHNICAL SUPPORT EXECUTIVE': 'TECHNICAL_SUPPORT_EXECUTIVE',
  'TECHNICAL SUPPORT MANAGER': 'TECHNICAL_SUPPORT_MANAGER',
  'COMPLIANCE OFFICER': 'COMPLIANCE_OFFICER',
  'PARTNERSHIP MANAGER': 'PARTNERSHIP_MANAGER',
  'TRAINING DEVELOPMENT EXECUTIVE': 'TRAINING_DEVELOPMENT_EXECUTIVE',
  'TRAINING & DEVELOPMENT EXECUTIVE': 'TRAINING_DEVELOPMENT_EXECUTIVE',
}

// Helper to normalize role key for consistent caching
function normalizeRoleKey(role: string | undefined, subRole: string | undefined): string {
  if (!role && !subRole) return ''
  const upperRole = role?.toUpperCase().trim() || ''
  if (upperRole === 'HR') return 'HR'

  const normalizedSubRole = subRole?.toUpperCase().trim() || ''

  // Check if it's a role name that needs to be converted to a key
  if (ROLE_NAME_TO_KEY_MAP[normalizedSubRole]) {
    return ROLE_NAME_TO_KEY_MAP[normalizedSubRole]
  }

  // Replace spaces with underscores for consistency (e.g., "DIGITAL SALES" -> "DIGITAL_SALES")
  return normalizedSubRole.replace(/\s+/g, '_')
}

// Clear cache for a specific role or all roles
export function clearMenuCache(roleKey?: string): void {
  if (roleKey) {
    menuCache.delete(roleKey.toUpperCase())
  } else {
    menuCache.clear()
  }
}

function EmployeeSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuSections, setMenuSections] = useState<MenuSection[] | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Profile completion and gatekeeping state
  const [completionPercentage, setCompletionPercentage] = useState(0)
  const [employeeStatus, setEmployeeStatus] = useState<string>('ACTIVE')
  const [profileCompleted, setProfileCompleted] = useState(false)

  // Track previous role to detect changes
  const prevRoleRef = useRef<string>('')
  // Track retry attempts for menu loading
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize role key with normalization for consistent caching
  const roleKey = useMemo(() => {
    return normalizeRoleKey(user?.role, user?.sub_role)
  }, [user?.role, user?.sub_role])

  // Invalidate cache when role changes
  useEffect(() => {
    if (prevRoleRef.current && prevRoleRef.current !== roleKey) {
      // Role changed - clear old cache entry
      clearMenuCache(prevRoleRef.current)
      clientLogger.debug('Role changed, clearing menu cache', {
        from: prevRoleRef.current,
        to: roleKey
      })
    }
    prevRoleRef.current = roleKey
  }, [roleKey])

  // Load menu items based on user's role or sub_role with smart caching
  useEffect(() => {
    async function loadMenuItems() {
      if (!roleKey) {
        // Don't set loading=false if auth is still loading - role may not be resolved yet
        if (!authLoading) {
          setLoading(false)
        }
        return
      }

      // Show loading indicator when starting to fetch (important for roleKey transitions)
      setLoading(true)

      // Check cache first with expiration
      const cached = menuCache.get(roleKey)
      const now = Date.now()

      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        setMenuItems(cached.items)
        setMenuSections(cached.sections)
        setLoading(false)
        retryCountRef.current = 0
        return
      }

      try {
        const config = await getEmployeeConfig(roleKey)
        if (config) {
          setMenuItems(config.menuItems)
          setMenuSections(config.menuSections)
          // Cache with timestamp for expiration
          menuCache.set(roleKey, {
            items: config.menuItems,
            sections: config.menuSections,
            timestamp: now,
            roleKey
          })
          retryCountRef.current = 0
        }
      } catch (error) {
        clientLogger.error('Error loading employee menu config', { error: error instanceof Error ? error.message : String(error) })
      } finally {
        setLoading(false)
      }
    }

    loadMenuItems()

    // Cleanup retry timer on unmount or dependency change
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [roleKey, authLoading])

  // Retry mechanism: if auth resolved but roleKey is empty (role='EMPLOYEE' with no sub_role),
  // the employee_profile query likely timed out. Retry by refreshing auth to get the correct role.
  useEffect(() => {
    // Only retry if: auth is done loading, user exists, but roleKey is empty (meaning role wasn't properly resolved)
    if (!authLoading && user && !roleKey && menuItems.length === 0 && retryCountRef.current < 3) {
      retryTimerRef.current = setTimeout(async () => {
        retryCountRef.current += 1
        clientLogger.debug('Retrying menu load - role may not be fully resolved', {
          attempt: retryCountRef.current,
          userRole: user.role,
          userSubRole: user.sub_role
        })

        // Try to directly fetch employee profile to get the actual role
        try {
          const supabase = createClient()
          const { data: empData } = await supabase
            .from('employee_profile')
            .select('role, subrole')
            .eq('user_id', user.id)
            .maybeSingle()

          if (empData?.role) {
            const resolvedKey = normalizeRoleKey(empData.role, empData.subrole)
            if (resolvedKey) {
              clientLogger.debug('Resolved employee role via retry', { resolvedKey })
              setLoading(true)
              try {
                const config = await getEmployeeConfig(resolvedKey)
                if (config) {
                  setMenuItems(config.menuItems)
                  setMenuSections(config.menuSections)
                  menuCache.set(resolvedKey, {
                    items: config.menuItems,
                    sections: config.menuSections,
                    timestamp: Date.now(),
                    roleKey: resolvedKey
                  })
                  retryCountRef.current = 0
                }
              } catch (error) {
                clientLogger.error('Error loading menu config on retry', { error: error instanceof Error ? error.message : String(error) })
              } finally {
                setLoading(false)
              }
            }
          }
        } catch {
          clientLogger.debug('Retry employee profile fetch failed', { attempt: retryCountRef.current })
        }
      }, retryCountRef.current * 1500 + 500) // Increasing delay: 500ms, 2000ms, 3500ms
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [authLoading, user, roleKey, menuItems.length])

  // Optimized unread count fetching - DEFERRED to not block rendering
  useEffect(() => {
    if (!user?.id) return

    // DEFER initial fetch - don't block sidebar rendering
    const timer = setTimeout(() => {
      const fetchUnreadCount = async () => {
        try {
          const response = await fetch('/api/employees/notifications?count_only=true')
          const data = await response.json()
          if (response.ok) {
            setUnreadCount(data.unread_count || 0)
          }
        } catch (error) {
          clientLogger.error('Error fetching unread count', { error: error instanceof Error ? error.message : String(error) })
        }
      }

      fetchUnreadCount()
    }, 100) // Defer by 100ms to allow page to render first

    // Set up real-time subscription for updates
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null
    try {
      const supabase = createClient()

      channel = supabase
        .channel(`notification_count_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notification_recipients',
            filter: `user_id=eq.${user.id}`
          },
          async () => {
            // Refresh unread count when any notification changes
            try {
              const response = await fetch('/api/employees/notifications?count_only=true')
              const data = await response.json()
              if (response.ok) {
                setUnreadCount(data.unread_count || 0)
              }
            } catch (error) {
              clientLogger.error('Error refreshing unread count', { error: error instanceof Error ? error.message : String(error) })
            }
          }
        )
        .subscribe()
    } catch (error) {
      clientLogger.error('Error setting up real-time subscription', { error: error instanceof Error ? error.message : String(error) })
    }

    return () => {
      clearTimeout(timer)
      if (channel) {
        try {
          const supabase = createClient()
          supabase.removeChannel(channel)
        } catch (error) {
          clientLogger.error('Error removing channel', { error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
  }, [user?.id])

  // Fetch profile completion and employee status for gatekeeping
  useEffect(() => {
    if (!user?.id) return

    const fetchProfileStatus = async () => {
      try {
        const supabase = createClient()
        const { data: employee } = await supabase
          .from('employees')
          .select('employee_status, profile_completed')
          .eq('user_id', user.id)
          .maybeSingle()

        if (employee) {
          setEmployeeStatus(employee.employee_status || 'ACTIVE')
          setProfileCompleted(employee.profile_completed || false)
        }

        // Fetch completion percentage from profile API
        const response = await fetch('/api/employees/profile')
        if (response.ok) {
          const data = await response.json()
          if (data.completion?.percentage !== undefined) {
            setCompletionPercentage(data.completion.percentage)
          }
          if (data.employeeStatus) {
            setEmployeeStatus(data.employeeStatus)
          }
          if (data.profileCompleted !== undefined) {
            setProfileCompleted(data.profileCompleted)
          }
        }
      } catch (error) {
        clientLogger.error('Error fetching profile status', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    // Defer to not block initial render
    const timer = setTimeout(fetchProfileStatus, 200)
    return () => clearTimeout(timer)
  }, [user?.id])

  // Derived gatekeeping state
  const isGatekeepingActive = useMemo(() => {
    return GATEKEEPING_STATUSES.includes(employeeStatus) && !profileCompleted
  }, [employeeStatus, profileCompleted])

  // Check if a menu item should be accessible during gatekeeping
  const isMenuItemAccessible = useCallback((label: string, href: string) => {
    if (!isGatekeepingActive) return true
    if (ALWAYS_ACCESSIBLE_LABELS.includes(label)) return true
    if (ALWAYS_ACCESSIBLE_HREFS.some(h => href === h || href.startsWith(h + '/'))) return true
    return false
  }, [isGatekeepingActive])

  // Memoize isActive function
  const isActive = useCallback((href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }, [pathname])

  // Memoize toggle function
  const toggleExpanded = useCallback((label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    )
  }, [])

  // Memoize role display name with normalized role checking
  const roleDisplayName = useMemo(() => {
    const upperRole = user?.role?.toUpperCase().trim()
    if (upperRole === 'HR') return 'HR Manager'
    if (!user?.sub_role) return 'Employee'

    const displayNames: Record<string, string> = {
      'CRO': 'Customer Relationship Officer',
      'BUSINESS_DEVELOPMENT_EXECUTIVE': 'Business Development Executive',
      'BUSINESS_DEVELOPMENT_MANAGER': 'Business Development Manager',
      'DIGITAL_SALES': 'Digital Sales',
      'CHANNEL_PARTNER_EXECUTIVE': 'Channel Partner Executive',
      'CHANNEL_PARTNER_MANAGER': 'Channel Partner Manager',
      'FINANCE_EXECUTIVE': 'Finance Executive',
      'ACCOUNTS_EXECUTIVE': 'Accounts Executive',
      'ACCOUNTS_MANAGER': 'Accounts Manager',
      'DIRECT_SALES_EXECUTIVE': 'Direct Sales Executive',
      'DIRECT_SALES_MANAGER': 'Direct Sales Manager',
      'TELE_SALES': 'Tele Sales',
      'PARTNER_SUPPORT_EXECUTIVE': 'Partner Support Executive',
      'PARTNER_SUPPORT_MANAGER': 'Partner Support Manager',
      'CUSTOMER_SUPPORT_EXECUTIVE': 'Customer Support Executive',
      'CUSTOMER_SUPPORT_MANAGER': 'Customer Support Manager',
      'PAYOUT_SPECIALIST': 'Payout Specialist',
      'TECHNICAL_SUPPORT_EXECUTIVE': 'Technical Support Executive',
      'TECHNICAL_SUPPORT_MANAGER': 'Technical Support Manager',
      'COMPLIANCE_OFFICER': 'Compliance Officer',
      'PARTNERSHIP_MANAGER': 'Partnership Manager',
      'TRAINING_DEVELOPMENT_EXECUTIVE': 'Training & Development Executive',
    }

    // Normalize sub_role to underscore format for lookup
    const normalizedKey = user.sub_role.toUpperCase().trim().replace(/\s+/g, '_')
    return displayNames[normalizedKey] || displayNames[user.sub_role] || user.sub_role
  }, [user?.role, user?.sub_role])

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      {/* Golden Profile Card */}
      <GoldenProfileCard
        userName={user?.full_name || user?.email || 'Employee'}
        userId={user?.employee_id || `EMP${user?.id?.slice(0, 4).toUpperCase()}`}
        roleLabel={user?.designation || roleDisplayName}
        avatarUrl={user?.avatar_url}
        completionPercentage={completionPercentage}
        profileLink="/employees/profile"
        profileLinkLabel={isGatekeepingActive ? 'Complete Profile' : 'My Profile'}
        isProfileComplete={!isGatekeepingActive}
        enableGatekeeping={isGatekeepingActive}
        onDisabledClick={() => {
          router.push('/employees/profile')
        }}
        currentPath={pathname}
      />

      {/* Navigation Menu */}
      <nav className="py-4" role="navigation" aria-label="Employee Portal Navigation">
        {(loading || (authLoading && (!menuSections || menuSections.length === 0))) ? (
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            Loading menu...
          </div>
        ) : menuSections && menuSections.length > 0 ? (
          // Render sectioned menu with headings
          menuSections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-4">
              {/* Section Header - Skip for MAIN section */}
              {section.title !== 'MAIN' && (
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-orange-500/50"></div>
                    <h3 className="text-[10px] font-semibold tracking-wider text-orange-400/80 uppercase" id={`section-${sectionIndex}`}>
                      {section.title}
                    </h3>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
                  </div>
                </div>
              )}
              {/* Section Items */}
              {section.items.map((item, index) => {
                const Icon = item.icon
                const active = isActive(item.href, item.exact)
                const hasSubmenu = item.submenu && item.submenu.length > 0
                const isExpanded = expandedItems.includes(item.label)
                const hasActiveSubmenu = hasSubmenu && item.submenu?.some(sub => isActive(sub.href, sub.exact))
                const accessible = isMenuItemAccessible(item.label, item.href)

                return (
                  <div key={index}>
                    {/* Main Menu Item */}
                    <div className="px-3">
                      {!accessible ? (
                        /* Locked menu item during gatekeeping */
                        <div
                          className="w-full px-3 py-2.5 mb-1 rounded-lg text-left cursor-not-allowed opacity-40 relative group"
                          role="menuitem"
                          aria-disabled="true"
                          aria-label={`${item.label} - locked, complete your profile to unlock`}
                          tabIndex={0}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="w-4 h-4 text-gray-500" aria-hidden="true" />
                              <span className="text-sm font-medium text-gray-500">{item.label}</span>
                            </div>
                            <Lock className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                          </div>
                          {/* Tooltip on hover and focus */}
                          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus-within:block z-50">
                            <div className="bg-gray-900 text-gray-200 text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-lg border border-gray-700">
                              Complete your profile to unlock
                            </div>
                          </div>
                        </div>
                      ) : hasSubmenu ? (
                        <button
                          onClick={() => toggleExpanded(item.label)}
                          aria-expanded={isExpanded}
                          aria-controls={`submenu-${sectionIndex}-${index}`}
                          role="menuitem"
                          className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group ${
                            active || hasActiveSubmenu
                              ? 'bg-orange-500 text-white shadow-lg'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-4 h-4 ${active || hasActiveSubmenu ? 'text-white' : 'text-orange-400'}`} aria-hidden="true" />
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {(item.badge || (item.label === 'Notifications' && unreadCount > 0)) && (
                                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full" aria-label={`${item.label === 'Notifications' && unreadCount > 0 ? unreadCount : item.badge} pending`}>
                                  {item.label === 'Notifications' && unreadCount > 0 ? unreadCount : item.badge}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                              )}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          prefetch={false}
                          role="menuitem"
                          aria-current={active ? 'page' : undefined}
                          className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group block ${
                            active || hasActiveSubmenu
                              ? 'bg-orange-500 text-white shadow-lg'
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-4 h-4 ${active || hasActiveSubmenu ? 'text-white' : 'text-orange-400'}`} aria-hidden="true" />
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {(item.badge || (item.label === 'Notifications' && unreadCount > 0)) && (
                                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full" aria-label={`${item.label === 'Notifications' && unreadCount > 0 ? unreadCount : item.badge} pending`}>
                                  {item.label === 'Notifications' && unreadCount > 0 ? unreadCount : item.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )}
                    </div>

                    {/* Submenu Items */}
                    {hasSubmenu && isExpanded && (
                      <div className="px-3 ml-6 mb-2" id={`submenu-${sectionIndex}-${index}`} role="menu" aria-label={`${item.label} submenu`}>
                        {item.submenu?.map((subItem, subIndex) => {
                          const SubIcon = subItem.icon
                          const subActive = isActive(subItem.href, subItem.exact)

                          return (
                            <Link
                              key={subIndex}
                              href={subItem.href}
                              prefetch={false}
                              role="menuitem"
                              aria-current={subActive ? 'page' : undefined}
                              className={`w-full px-3 py-2 mb-1 rounded-lg transition-all duration-200 text-left group block ${
                                subActive
                                  ? 'bg-orange-400 text-white'
                                  : 'text-gray-400 hover:bg-gray-700'
                              }`}
                              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                            >
                              <div className="flex items-center space-x-3">
                                <SubIcon className={`w-3.5 h-3.5 ${subActive ? 'text-white' : 'text-orange-300'}`} aria-hidden="true" />
                                <span className="text-xs font-medium">{subItem.label}</span>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        ) : (
          // No menu sections loaded - show retry option
          <div className="px-3 py-4 text-center text-gray-400 text-sm">
            {retryCountRef.current > 0 && retryCountRef.current < 3 ? (
              'Loading menu...'
            ) : (
              <>
                <p>No menu items available</p>
                <button
                  onClick={async () => {
                    retryCountRef.current = 0
                    clearMenuCache()
                    setLoading(true)

                    // If roleKey exists, re-fetch directly
                    if (roleKey) {
                      try {
                        const config = await getEmployeeConfig(roleKey)
                        if (config) {
                          setMenuItems(config.menuItems)
                          setMenuSections(config.menuSections)
                          menuCache.set(roleKey, {
                            items: config.menuItems,
                            sections: config.menuSections,
                            timestamp: Date.now(),
                            roleKey
                          })
                        }
                      } catch (error) {
                        clientLogger.error('Error on manual menu retry', { error: error instanceof Error ? error.message : String(error) })
                      } finally {
                        setLoading(false)
                      }
                    } else {
                      // No roleKey - try to resolve from employee_profile directly
                      try {
                        const supabase = createClient()
                        const { data: empData } = await supabase
                          .from('employee_profile')
                          .select('role, subrole')
                          .eq('user_id', user?.id)
                          .maybeSingle()

                        if (empData?.role) {
                          const resolvedKey = normalizeRoleKey(empData.role, empData.subrole)
                          if (resolvedKey) {
                            const config = await getEmployeeConfig(resolvedKey)
                            if (config) {
                              setMenuItems(config.menuItems)
                              setMenuSections(config.menuSections)
                              menuCache.set(resolvedKey, {
                                items: config.menuItems,
                                sections: config.menuSections,
                                timestamp: Date.now(),
                                roleKey: resolvedKey
                              })
                            }
                          }
                        }
                      } catch (error) {
                        clientLogger.error('Error resolving role on manual retry', { error: error instanceof Error ? error.message : String(error) })
                      } finally {
                        setLoading(false)
                      }
                    }
                  }}
                  className="mt-2 text-orange-400 hover:text-orange-300 text-xs underline"
                >
                  Retry loading menu
                </button>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  )
}

// Memoize the entire component to prevent unnecessary re-renders
export default memo(EmployeeSidebar)
