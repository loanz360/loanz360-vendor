'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/auth-context'
import { usePartnerConfig } from '@/lib/contexts/partner-config-context'
import GoldenProfileCard from '@/components/shared/GoldenProfileCard'

export function BASidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { config, loading } = usePartnerConfig()

  const displayUser = {
    id: user?.id || 'BA001',
    full_name: user?.full_name || 'Business Associate',
    email: user?.email || 'ba@loanz360.com',
    avatar_url: user?.avatar_url || null
  }

  // Calculate profile completion percentage based on available user fields
  const completionPercentage = React.useMemo(() => {
    if (!user) return 0
    let pct = 0
    // full_name set and not just derived from email
    if (user.full_name && user.full_name !== user.email?.split('@')[0]) pct += 20
    // email present
    if (user.email) pct += 20
    // phone/mobile present
    if (user.phone) pct += 15
    // avatar uploaded
    if (user.avatar_url) pct += 15
    // email verified
    if (user.email_verified) pct += 15
    // mobile verified
    if (user.mobile_verified) pct += 15
    return pct
  }, [user])

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    // For non-exact matches, check if pathname starts with href
    // AND either pathname === href OR the next character is a '/'
    // This prevents /partners/ba from matching /partners/ba-other
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }

  return (
    <div className="w-full frosted-sidebar pb-6 pt-[70px]">
      {/* Golden Profile Card */}
      <GoldenProfileCard
        userName={displayUser.full_name}
        userId={displayUser.id.slice(0, 8).toUpperCase()}
        roleLabel="Business Associate"
        avatarUrl={displayUser.avatar_url}
        completionPercentage={completionPercentage}
        profileLink="/partners/ba/profile"
        currentPath={pathname}
      />

      {/* Navigation Menu - Organized by Sections */}
      <div className="py-4">
        {loading ? (
          <div className="px-3 py-8 text-center">
            <p className="text-gray-400 text-sm">Loading menu...</p>
          </div>
        ) : config?.menuSections ? (
          // Render sections if available (new structure)
          config.menuSections.map((section, sectionIndex) => (
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

              {/* Section Menu Items */}
              {section.items.map((item, index) => {
                const Icon = item.icon
                const active = isActive(item.href, item.exact)

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
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        ) : (
          // Fallback to flat menu items (backward compatibility)
          config?.menuItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.href, item.exact)

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
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-orange-400'}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
