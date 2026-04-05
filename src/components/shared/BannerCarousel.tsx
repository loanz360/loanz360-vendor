'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, AlertCircle, Sparkles, Bell, Calendar } from 'lucide-react'

interface Banner {
  id: string
  title: string
  banner_text: string | null
  image_url: string
  click_url: string | null
  display_order: number
  alt_text?: string | null
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  banner_type?: 'PROMOTIONAL' | 'INFORMATIONAL' | 'ANNOUNCEMENT' | 'ALERT' | 'FESTIVE' | 'SEASONAL'
  is_ab_test?: boolean
  ab_test_variant?: 'A' | 'B'
}

interface BannerCarouselProps {
  /** Callback when banner loading is complete */
  onLoadComplete?: () => void
  /** Show type badges on banners */
  showBadges?: boolean
  /** Auto-play interval in milliseconds (default: 5000) */
  autoPlayInterval?: number
  /** Maximum number of banners to display (default: 5) */
  maxBanners?: number
}

// Cache banners in memory to avoid refetching on every mount
let bannersCache: Banner[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Badge styling based on banner type
const TYPE_BADGES: Record<string, { icon: any; color: string; label: string }> = {
  PROMOTIONAL: { icon: Sparkles, color: 'bg-purple-500', label: 'Promo' },
  INFORMATIONAL: { icon: Bell, color: 'bg-blue-500', label: 'Info' },
  ANNOUNCEMENT: { icon: Bell, color: 'bg-green-500', label: 'New' },
  ALERT: { icon: AlertCircle, color: 'bg-red-500', label: 'Alert' },
  FESTIVE: { icon: Sparkles, color: 'bg-pink-500', label: 'Festive' },
  SEASONAL: { icon: Calendar, color: 'bg-orange-500', label: 'Season' }
}

function BannerCarousel({
  onLoadComplete,
  showBadges = true,
  autoPlayInterval = 5000,
  maxBanners = 5
}: BannerCarouselProps = {}) {
  const [banners, setBanners] = useState<Banner[]>(() => bannersCache || [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(!bannersCache)
  const [autoPlay, setAutoPlay] = useState(true)
  const [manualInteractionTimeout, setManualInteractionTimeout] = useState<NodeJS.Timeout | null>(null)
  const [viewedBanners, setViewedBanners] = useState<Set<string>>(new Set())
  const [imageError, setImageError] = useState<Record<string, boolean>>({})

  // Fetch banners only if cache is empty or expired
  useEffect(() => {
    const now = Date.now()
    const cacheExpired = now - cacheTimestamp > CACHE_DURATION

    if (!bannersCache || cacheExpired) {
      fetchBanners()
    } else {
      // Use cached data, complete loading immediately
      setLoading(false)
      onLoadComplete?.()
    }
  }, [onLoadComplete])

  const fetchBanners = async () => {
    try {
      const response = await fetch('/api/banners?forUser=true')
      const data = await response.json()
      if (data.banners && data.banners.length > 0) {
        // Sort by priority (URGENT first) and then by display_order
        const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        const sortedBanners = [...data.banners].sort((a, b) => {
          const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2
          const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2
          if (priorityA !== priorityB) return priorityA - priorityB
          return (a.display_order || 0) - (b.display_order || 0)
        })

        const limitedBanners = sortedBanners.slice(0, maxBanners)
        setBanners(limitedBanners)
        bannersCache = limitedBanners
        cacheTimestamp = Date.now()
      }
    } catch (error) {
      console.error('Error fetching banners:', error)
    } finally {
      setLoading(false)
      onLoadComplete?.()
    }
  }

  // Debounced banner view logging - only log once per banner
  const logBannerView = useCallback((bannerId: string) => {
    if (viewedBanners.has(bannerId)) return

    setViewedBanners(prev => new Set(prev).add(bannerId))

    // Fire and forget - don't wait for response
    fetch('/api/banners/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_id: bannerId, action_type: 'view' }),
      keepalive: true // Ensure request completes even if page unloads
    }).catch(err => console.error('Error logging banner view:', err))
  }, [viewedBanners])

  const logBannerClick = async (bannerId: string) => {
    // Fire and forget
    fetch('/api/banners/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banner_id: bannerId, action_type: 'click' }),
      keepalive: true
    }).catch(err => console.error('Error logging banner click:', err))
  }

  // Log view only when banner changes
  useEffect(() => {
    if (banners.length > 0 && banners[currentIndex]) {
      logBannerView(banners[currentIndex].id)
    }
  }, [currentIndex, banners, logBannerView])

  // Auto-play with cleanup
  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, autoPlayInterval)

    return () => clearInterval(interval)
  }, [autoPlay, banners.length, autoPlayInterval])

  const handleManualInteraction = useCallback((callback: () => void) => {
    // Clear existing timeout
    if (manualInteractionTimeout) {
      clearTimeout(manualInteractionTimeout)
    }

    // Pause auto-play
    setAutoPlay(false)
    callback()

    // Resume auto-play after 10 seconds of inactivity
    const timeout = setTimeout(() => {
      setAutoPlay(true)
    }, 10000)

    setManualInteractionTimeout(timeout)
  }, [manualInteractionTimeout])

  const handlePrevious = useCallback(() => {
    handleManualInteraction(() => {
      setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
    })
  }, [banners.length, handleManualInteraction])

  const handleNext = useCallback(() => {
    handleManualInteraction(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    })
  }, [banners.length, handleManualInteraction])

  const handleDotClick = useCallback((index: number) => {
    handleManualInteraction(() => {
      setCurrentIndex(index)
    })
  }, [handleManualInteraction])

  const handleBannerClick = useCallback(() => {
    const currentBanner = banners[currentIndex]
    if (currentBanner?.click_url) {
      logBannerClick(currentBanner.id)
      window.open(currentBanner.click_url, '_blank')
    }
  }, [banners, currentIndex])

  // Don't render if no banners
  if (!loading && banners.length === 0) {
    return null
  }

  // Minimal loading state
  if (loading) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-gray-900/50 h-[300px] animate-pulse" />
    )
  }

  const currentBanner = banners[currentIndex]

  // Get badge info for current banner
  const badgeInfo = currentBanner.banner_type ? TYPE_BADGES[currentBanner.banner_type] : null
  const BadgeIcon = badgeInfo?.icon

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageError(prev => ({ ...prev, [currentBanner.id]: true }))
  }, [currentBanner.id])

  return (
    <div className="relative rounded-xl overflow-hidden group">
      {/* Banner Image */}
      <div
        className={`relative h-[300px] ${currentBanner?.click_url ? 'cursor-pointer' : ''}`}
        onClick={currentBanner?.click_url ? handleBannerClick : undefined}
        role={currentBanner?.click_url ? 'link' : undefined}
        tabIndex={currentBanner?.click_url ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && currentBanner?.click_url) {
            handleBannerClick()
          }
        }}
      >
        {imageError[currentBanner.id] ? (
          // Fallback for failed images
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
            <div className="text-center text-white">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm opacity-75">Image unavailable</p>
            </div>
          </div>
        ) : (
          <Image
            src={currentBanner.image_url}
            alt={currentBanner.alt_text || currentBanner.title}
            fill
            className="object-cover"
            priority={currentIndex === 0}
            loading={currentIndex === 0 ? 'eager' : 'lazy'}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
            onError={handleImageError}
          />
        )}

        {/* Type Badge */}
        {showBadges && badgeInfo && BadgeIcon && (
          <div className={`absolute top-4 left-4 ${badgeInfo.color} text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 shadow-lg`}>
            <BadgeIcon className="w-4 h-4" />
            <span>{badgeInfo.label}</span>
          </div>
        )}

        {/* Priority Badge for URGENT */}
        {currentBanner.priority === 'URGENT' && (
          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse shadow-lg">
            URGENT
          </div>
        )}

        {/* Overlay for better text visibility */}
        {(currentBanner.banner_text || currentBanner.title) && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        )}

        {/* Banner Text */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2 drop-shadow-lg">{currentBanner.title}</h2>
          {currentBanner.banner_text && (
            <p className="text-gray-200 drop-shadow-md line-clamp-2">{currentBanner.banner_text}</p>
          )}
          {currentBanner.click_url && (
            <span className="inline-block mt-2 text-sm text-white/80 hover:text-white underline underline-offset-2">
              Learn more →
            </span>
          )}
        </div>
      </div>

      {/* Navigation Arrows - only show if multiple banners */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Next banner"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                onClick={() => handleDotClick(index)}
                className={`w-2 h-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white ${
                  index === currentIndex
                    ? 'bg-white w-8'
                    : 'bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to banner ${index + 1}: ${banner.title}`}
                aria-current={index === currentIndex ? 'true' : undefined}
              />
            ))}
          </div>

          {/* Auto-play indicator */}
          <div className="absolute bottom-4 right-4 text-white/60 text-xs flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${autoPlay ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
            <span>{autoPlay ? 'Auto' : 'Paused'}</span>
          </div>
        </>
      )}
    </div>
  )
}

// Memoize to prevent unnecessary re-renders
export default memo(BannerCarousel)
