'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { LucideIcon, Search, Star, Clock } from 'lucide-react'
import { NavigationCard, NavigationCardGrid, MenuPageHeader } from './NavigationCard'
import { cn } from '@/lib/utils/cn'

export interface SubMenuItemConfig {
  label: string
  href: string
  icon: LucideIcon
  description: string
  badge?: number | string
  badgeVariant?: 'default' | 'warning' | 'success' | 'error'
  disabled?: boolean
}

export interface SubMenuPageProps {
  title: string
  description?: string
  icon?: LucideIcon
  sectionTitle?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  subItems: SubMenuItemConfig[]
  showSearch?: boolean
  showRecentlyUsed?: boolean
  recentItems?: string[] // hrefs of recently used items
  children?: React.ReactNode
  headerActions?: React.ReactNode
}

export function SubMenuPage({
  title,
  description,
  icon,
  sectionTitle,
  breadcrumbs,
  subItems,
  showSearch = true,
  showRecentlyUsed = false,
  recentItems = [],
  children,
  headerActions,
}: SubMenuPageProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [favorites, setFavorites] = React.useState<string[]>([])

  // Load favorites from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem(`superadmin-favorites-${title}`)
    if (stored) {
      setFavorites(JSON.parse(stored))
    }
  }, [title])

  // Filter items based on search
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return subItems
    const query = searchQuery.toLowerCase()
    return subItems.filter(
      item =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    )
  }, [subItems, searchQuery])

  // Get recently used items
  const recentlyUsedItems = React.useMemo(() => {
    if (!showRecentlyUsed || recentItems.length === 0) return []
    return subItems.filter(item => recentItems.includes(item.href))
  }, [subItems, recentItems, showRecentlyUsed])

  // Get favorite items
  const favoriteItems = React.useMemo(() => {
    return subItems.filter(item => favorites.includes(item.href))
  }, [subItems, favorites])

  // Toggle favorite
  const toggleFavorite = (href: string) => {
    const newFavorites = favorites.includes(href)
      ? favorites.filter(f => f !== href)
      : [...favorites, href]
    setFavorites(newFavorites)
    localStorage.setItem(`superadmin-favorites-${title}`, JSON.stringify(newFavorites))
  }

  return (
    <div className="min-h-full p-6">
      {/* Page Header */}
      <MenuPageHeader
        title={title}
        description={description}
        icon={icon}
        breadcrumbs={breadcrumbs}
        actions={headerActions}
      />

      {/* Search Bar */}
      {showSearch && subItems.length > 6 && (
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-3 rounded-xl',
                'bg-gray-800/50 border border-gray-700/50',
                'text-white placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50',
                'transition-all duration-200'
              )}
            />
          </div>
        </div>
      )}

      {/* Recently Used Section */}
      {showRecentlyUsed && recentlyUsedItems.length > 0 && !searchQuery && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-300 font-poppins">Recently Used</h2>
          </div>
          <NavigationCardGrid>
            {recentlyUsedItems.slice(0, 4).map((item) => (
              <NavigationCard
                key={item.href}
                icon={item.icon}
                title={item.label}
                description={item.description}
                href={item.href}
                badge={item.badge}
                badgeVariant={item.badgeVariant}
                disabled={item.disabled}
              />
            ))}
          </NavigationCardGrid>
        </div>
      )}

      {/* Favorites Section */}
      {favoriteItems.length > 0 && !searchQuery && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h2 className="text-lg font-semibold text-gray-300 font-poppins">Favorites</h2>
          </div>
          <NavigationCardGrid>
            {favoriteItems.map((item) => (
              <NavigationCard
                key={item.href}
                icon={item.icon}
                title={item.label}
                description={item.description}
                href={item.href}
                badge={item.badge}
                badgeVariant={item.badgeVariant}
                disabled={item.disabled}
              />
            ))}
          </NavigationCardGrid>
        </div>
      )}

      {/* Main Section Title */}
      {sectionTitle && !searchQuery && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-[1px] w-4 bg-gradient-to-r from-transparent to-orange-500/50"></div>
          <h2 className="text-sm font-semibold tracking-wider text-orange-400/80 uppercase">
            {sectionTitle}
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-orange-500/50 to-transparent"></div>
        </div>
      )}

      {/* All Features Card Grid */}
      {filteredItems.length > 0 ? (
        <NavigationCardGrid>
          {filteredItems.map((item) => (
            <NavigationCard
              key={item.href}
              icon={item.icon}
              title={item.label}
              description={item.description}
              href={item.href}
              badge={item.badge}
              badgeVariant={item.badgeVariant}
              disabled={item.disabled}
            />
          ))}
        </NavigationCardGrid>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <Search className="w-12 h-12 mx-auto opacity-50" />
          </div>
          <p className="text-gray-400 text-lg">No features found matching &ldquo;{searchQuery}&rdquo;</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-orange-400 hover:text-orange-300 transition-colors"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Optional custom content */}
      {children && (
        <div className="mt-8">
          {children}
        </div>
      )}
    </div>
  )
}

export default SubMenuPage
