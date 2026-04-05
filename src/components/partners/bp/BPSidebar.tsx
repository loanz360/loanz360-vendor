'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { ChevronDown } from 'lucide-react'
import { usePartnerConfig } from '@/lib/contexts/partner-config-context'
import type { MenuItem, MenuSection } from '@/lib/services/partner-config-service'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'

export function BPSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { config, loading } = usePartnerConfig()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const displayUser = {
    id: user?.id || 'BP001',
    full_name: user?.full_name || 'Business Partner',
    email: user?.email || '',
    avatar_url: user?.avatar_url || null
  }

  // Calculate profile completion percentage based on available user fields
  const completionPercentage = React.useMemo(() => {
    if (!user) return 0
    let pct = 0
    if (user.full_name && user.full_name !== user.email?.split('@')[0]) pct += 20
    if (user.email) pct += 20
    if (user.phone) pct += 15
    if (user.avatar_url) pct += 15
    if (user.email_verified) pct += 15
    if (user.mobile_verified) pct += 15
    return pct
  }, [user])

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    // For non-exact matches, check if pathname starts with href
    // AND either pathname === href OR the next character is a '/'
    // This prevents /partners/bp from matching /partners/bp-other
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }

  // Check if any subitem is active
  const isSubItemActive = (item: MenuItem) => {
    if (!item.subItems) return false
    return item.subItems.some(subItem => isActive(subItem.href))
  }

  // Toggle expanded state for menu items with subitems
  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? [] // Close if already open (close all)
        : [label] // Open only this one
    )
  }

  // Get all menu items from sections for auto-expand logic
  const getAllMenuItems = useCallback((): MenuItem[] => {
    if (config?.menuSections) {
      return config.menuSections.flatMap(section => section.items)
    }
    return config?.menuItems || []
  }, [config?.menuSections, config?.menuItems])

  // Auto-expand active parent menu on mount and pathname change
  useEffect(() => {
    const menuItems = getAllMenuItems()
    if (menuItems.length === 0) return

    // Find menu item with active subitem
    const activeItem = menuItems.find(item =>
      item.subItems && item.subItems.some(subItem =>
        pathname === subItem.href || pathname.startsWith(subItem.href + '/')
      )
    )

    if (activeItem) {
      setExpandedItems([activeItem.label])
    }
  }, [pathname, getAllMenuItems])

  // Render a single menu item
  const renderMenuItem = (item: MenuItem, index: number) => {
    const Icon = item.icon
    const hasSubItems = item.subItems && item.subItems.length > 0
    const isExpanded = expandedItems.includes(item.label)
    const parentActive = isActive(item.href, item.exact) || isSubItemActive(item)

    return (
      <div key={index}>
        {/* Main Menu Item */}
        <div className="px-3">
          <button
            onClick={() => {
              if (hasSubItems) {
                toggleExpanded(item.label)
              } else {
                router.push(item.href)
              }
            }}
            className={`w-full px-3 py-2.5 mb-1 rounded-lg transition-all duration-200 text-left group ${
              parentActive && !hasSubItems
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                : parentActive && hasSubItems
                ? 'bg-gray-700/80 text-white'
                : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${parentActive && !hasSubItems ? 'text-white' : 'text-orange-400'}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {hasSubItems && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  } ${parentActive ? 'text-orange-400' : 'text-gray-500'}`}
                />
              )}
            </div>
          </button>
        </div>

        {/* Sub Menu Items */}
        {hasSubItems && isExpanded && item.subItems && (
          <div className="px-3 mb-2 space-y-1">
            <div className="ml-6 border-l-2 border-gray-700/50 pl-2">
              {item.subItems.map((subItem, subIndex) => {
                const SubIcon = subItem.icon
                const subActive = isActive(subItem.href)

                return (
                  <button
                    key={subIndex}
                    onClick={() => router.push(subItem.href)}
                    className={`w-full px-3 py-2 rounded-lg transition-all duration-200 text-left ${
                      subActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {SubIcon && (
                        <SubIcon className={`w-3.5 h-3.5 ${subActive ? 'text-white' : 'text-orange-400/70'}`} />
                      )}
                      <span className="text-sm font-medium">{subItem.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render section header (like Super Admin)
  const renderSectionHeader = (title: string) => (
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center gap-2">
        <div className="h-[1px] w-2 bg-gradient-to-r from-transparent to-orange-500/50"></div>
        <span className="text-[10px] font-semibold tracking-wider text-orange-400/80 uppercase">
          {title}
        </span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
      </div>
    </div>
  )

  // Render menu sections
  const renderMenuSections = (sections: MenuSection[]) => (
    <>
      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="mb-2">
          {/* Section Header */}
          {renderSectionHeader(section.title)}

          {/* Section Menu Items */}
          {section.items.map((item, itemIndex) => renderMenuItem(item, itemIndex))}
        </div>
      ))}
    </>
  )

  // Render flat menu items (fallback for non-sectioned config)
  const renderFlatMenu = (items: MenuItem[]) => (
    <>
      {items.map((item, index) => renderMenuItem(item, index))}
    </>
  )

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      {/* Golden Profile Card */}
      <GoldenProfileCard
        userName={displayUser.full_name}
        userId={displayUser.id.slice(0, 8).toUpperCase()}
        roleLabel="Business Partner"
        avatarUrl={displayUser.avatar_url}
        completionPercentage={completionPercentage}
        profileLink="/partners/bp/profile"
        currentPath={pathname}
      />

      {/* Navigation Menu */}
      <div className="py-4">
        {loading ? (
          <div className="px-3 py-8 text-center">
            <p className="text-gray-400 text-sm">Loading menu...</p>
          </div>
        ) : config?.menuSections ? (
          // Use sectioned menu structure if available
          renderMenuSections(config.menuSections)
        ) : config?.menuItems ? (
          // Fallback to flat menu structure
          renderFlatMenu(config.menuItems)
        ) : (
          <div className="px-3 py-8 text-center">
            <p className="text-gray-400 text-sm">No menu items available</p>
          </div>
        )}
      </div>
    </div>
  )
}
