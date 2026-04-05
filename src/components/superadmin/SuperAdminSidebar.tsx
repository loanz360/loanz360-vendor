'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSuperAdminAuth } from '@/lib/auth/super-admin-auth-context'
import { menuSections, allMenuItems } from '@/config/superadmin-menu'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'
import { clientLogger } from '@/lib/utils/client-logger'

export default function SuperAdminSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useSuperAdminAuth()
  const [payoutBadgeCount, setPayoutBadgeCount] = useState(0)

  // Use real user data from super admin auth context
  const displayUser = {
    id: user?.id || 'ADM1',
    full_name: user?.fullName || 'Super Admin',
    email: user?.email || 'admin@loanz360.com',
    avatar_url: null // Super admin doesn't have avatar in the current schema
  }

  // Fetch payout statistics for badge count
  useEffect(() => {
    const fetchPayoutStats = async () => {
      try {
        const response = await fetch('/api/superadmin/payouts/stats')
        const data = await response.json()

        if (data.success && data.data?.total_pending_actions) {
          setPayoutBadgeCount(data.data.total_pending_actions)
        }
      } catch (error) {
        // Silently fail - badge will show 0
        clientLogger.error('Failed to fetch payout stats', { error: error instanceof Error ? error.message : String(error) })
      }
    }

    // Initial fetch
    fetchPayoutStats()

    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchPayoutStats, 30000)

    return () => clearInterval(interval)
  }, [])

  // Determine if a menu item is active
  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    // Check if the current path starts with the menu item's href
    // Also check if any sub-items of this menu match the current path
    const menuItem = allMenuItems.find(item => item.href === href)
    if (menuItem?.subItems) {
      const subItemMatch = menuItem.subItems.some(
        subItem => pathname === subItem.href || pathname.startsWith(subItem.href + '/')
      )
      if (subItemMatch) return true
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      {/* Golden Profile Card */}
      <GoldenProfileCard
        userName={displayUser.full_name}
        userId={displayUser.id.slice(0, 8).toUpperCase() || 'SA-00001'}
        roleLabel="Super Administrator"
        avatarUrl={displayUser.avatar_url}
        completionPercentage={100}
        profileLink="/superadmin/my-profile"
        currentPath={pathname}
      />

      {/* Navigation Menu - Flat structure without sub-menus */}
      <div className="py-4">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-2">
            {/* Section Header */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-orange-500/50"></div>
                <span className="text-[10px] font-semibold tracking-wider text-orange-400/80 uppercase">
                  {section.title}
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
              </div>
            </div>

            {/* Section Menu Items - Flat, no sub-menus */}
            {section.items.map((item, index) => {
              const Icon = item.icon
              const active = isActive(item.href, item.exact)
              const badgeCount = item.dynamicBadge ? payoutBadgeCount : item.badgeCount

              return (
                <div key={index} className="px-3">
                  <button
                    onClick={() => router.push(item.href)}
                    className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group ${
                      active
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {badgeCount !== undefined && badgeCount > 0 && (
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            active
                              ? 'bg-white text-orange-600'
                              : 'bg-orange-500 text-white'
                          }`}>
                            {badgeCount}
                          </span>
                        )}
                        {/* Show indicator if menu has sub-items (cards will be shown in main content) */}
                        {item.subItems && item.subItems.length > 0 && (
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            active ? 'bg-white' : 'bg-orange-400/60'
                          }`} />
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
