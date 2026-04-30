'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Offer } from '@/types/offers'

interface OfferWithStats extends Offer {
  view_count?: number
  share_count?: number
  conversion_count?: number
  is_favorite?: boolean
  recommendation_score?: number
}

interface OffersState {
  offers: OfferWithStats[]
  loading: boolean
  error: string | null
  total: number
  page: number
  totalPages: number
}

interface OffersCache {
  data: OfferWithStats[]
  timestamp: number
  status: string
}

interface UseOffersOptions {
  status?: 'active' | 'expired' | 'draft' | 'scheduled'
  forUser?: boolean
  enhanced?: boolean
  page?: number
  limit?: number
  autoFetch?: boolean
  cacheTime?: number // Cache time in milliseconds (default: 5 minutes)
  staleTime?: number // Stale time in milliseconds (default: 30 seconds)
}

interface UseOffersReturn extends OffersState {
  refetch: () => Promise<void>
  invalidateCache: () => void
  isStale: boolean
  isFetching: boolean
}

// Simple in-memory cache
const cache = new Map<string, OffersCache>()
const CACHE_TIME = 5 * 60 * 1000 // 5 minutes
const STALE_TIME = 30 * 1000 // 30 seconds

function getCacheKey(options: UseOffersOptions): string {
  return `offers-${options.status || 'active'}-${options.page || 1}-${options.limit || 20}-${options.forUser}`
}

export function useOffers(options: UseOffersOptions = {}): UseOffersReturn {
  const {
    status = 'active',
    forUser = true,
    enhanced = false,
    page = 1,
    limit = 20,
    autoFetch = true,
    cacheTime = CACHE_TIME,
    staleTime = STALE_TIME
  } = options

  const [state, setState] = useState<OffersState>({
    offers: [],
    loading: true,
    error: null,
    total: 0,
    page: 1,
    totalPages: 1
  })

  const [isFetching, setIsFetching] = useState(false)
  const [isStale, setIsStale] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const cacheKey = useMemo(() => getCacheKey({ status, forUser, page, limit }), [status, forUser, page, limit])

  // Check if cache is valid
  const getCachedData = useCallback(() => {
    const cached = cache.get(cacheKey)
    if (!cached) return null

    const now = Date.now()
    const age = now - cached.timestamp

    // If cache is expired, remove it
    if (age > cacheTime) {
      cache.delete(cacheKey)
      return null
    }

    // Check if data is stale
    const stale = age > staleTime
    setIsStale(stale)

    return cached.data
  }, [cacheKey, cacheTime, staleTime])

  // Fetch offers from API
  const fetchOffers = useCallback(async (backgroundRefresh = false) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    // Check cache first (unless background refresh)
    if (!backgroundRefresh) {
      const cachedData = getCachedData()
      if (cachedData && cachedData.length > 0) {
        setState(prev => ({
          ...prev,
          offers: cachedData,
          loading: false,
          error: null
        }))

        // If data is stale, do background refresh
        if (isStale) {
          fetchOffers(true)
        }
        return
      }
    }

    if (!backgroundRefresh) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    }
    setIsFetching(true)

    try {
      const params = new URLSearchParams({
        status,
        forUser: String(forUser),
        enhanced: String(enhanced),
        page: String(page),
        limit: String(limit)
      })

      const response = await fetch(`/api/offers?${params}`, {
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch offers (${response.status})`)
      }

      const data = await response.json()
      const offers = data.offers || []

      // Update cache
      cache.set(cacheKey, {
        data: offers,
        timestamp: Date.now(),
        status
      })

      setState({
        offers,
        loading: false,
        error: null,
        total: data.total || offers.length,
        page: data.page || page,
        totalPages: data.totalPages || Math.ceil((data.total || offers.length) / limit)
      })

      setIsStale(false)
    } catch (error) {
      // Don't update state if request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      if (!backgroundRefresh) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch offers'
        }))
      }
    } finally {
      setIsFetching(false)
    }
  }, [status, forUser, enhanced, page, limit, cacheKey, getCachedData, isStale])

  // Invalidate cache
  const invalidateCache = useCallback(() => {
    cache.delete(cacheKey)
    setIsStale(true)
  }, [cacheKey])

  // Refetch function
  const refetch = useCallback(async () => {
    invalidateCache()
    await fetchOffers()
  }, [invalidateCache, fetchOffers])

  // Auto-fetch on mount and option changes
  useEffect(() => {
    if (autoFetch) {
      fetchOffers()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [autoFetch, fetchOffers])

  // Set up background refresh interval
  useEffect(() => {
    if (!autoFetch) return

    const interval = setInterval(() => {
      const cached = cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp > staleTime) {
        setIsStale(true)
        fetchOffers(true)
      }
    }, staleTime)

    return () => clearInterval(interval)
  }, [cacheKey, staleTime, autoFetch, fetchOffers])

  return {
    ...state,
    refetch,
    invalidateCache,
    isStale,
    isFetching
  }
}

// Hook for managing favorites with optimistic updates
interface UseFavoritesReturn {
  favorites: Set<string>
  loading: boolean
  toggleFavorite: (offerId: string) => Promise<void>
  isFavorite: (offerId: string) => boolean
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const previousFavoritesRef = useRef<Set<string>>(new Set())

  // Fetch initial favorites
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const response = await fetch('/api/offers/favorites')
        if (response.ok) {
          const data = await response.json()
          const favSet = new Set<string>(data.favorites?.map((f: unknown) => f.offer_id) || [])
          setFavorites(favSet)
        }
      } catch (error) {
        console.warn('Error fetching favorites:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFavorites()
  }, [])

  // Toggle favorite with optimistic update
  const toggleFavorite = useCallback(async (offerId: string) => {
    const isFav = favorites.has(offerId)

    // Save previous state for rollback
    previousFavoritesRef.current = new Set(favorites)

    // Optimistic update
    setFavorites(prev => {
      const newSet = new Set(prev)
      if (isFav) {
        newSet.delete(offerId)
      } else {
        newSet.add(offerId)
      }
      return newSet
    })

    try {
      const response = await fetch('/api/offers/favorites', {
        method: isFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId })
      })

      if (!response.ok) {
        throw new Error('Failed to update favorite')
      }
    } catch (error) {
      // Rollback on error
      console.error('Error toggling favorite:', error)
      setFavorites(previousFavoritesRef.current)
    }
  }, [favorites])

  const isFavorite = useCallback((offerId: string) => favorites.has(offerId), [favorites])

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite
  }
}

// Hook for offer stats
interface OfferStats {
  total_offers: number
  active_offers: number
  my_shares: number
  my_conversions: number
  trending_offers: number
  draft_offers: number
  scheduled_offers: number
}

interface UseOfferStatsReturn {
  stats: OfferStats
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useOfferStats(isCRO: boolean = false): UseOfferStatsReturn {
  const [stats, setStats] = useState<OfferStats>({
    total_offers: 0,
    active_offers: 0,
    my_shares: 0,
    my_conversions: 0,
    trending_offers: 0,
    draft_offers: 0,
    scheduled_offers: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const endpoint = isCRO ? '/api/cro/offers/stats' : '/api/offers/analytics'
      const response = await fetch(endpoint)

      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()

      if (isCRO) {
        setStats(prev => ({ ...prev, ...data.stats }))
      } else {
        setStats({
          total_offers: data.analytics?.total_offers || 0,
          active_offers: data.analytics?.active_offers || 0,
          my_shares: 0,
          my_conversions: 0,
          trending_offers: 0,
          draft_offers: data.analytics?.draft_offers || 0,
          scheduled_offers: data.analytics?.scheduled_offers || 0
        })
      }
    } catch (err) {
      console.warn('Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }, [isCRO])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  }
}

// Hook for recording offer views
export function useOfferViews() {
  const recordView = useCallback(async (offerId: string) => {
    try {
      await fetch('/api/offers/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId })
      })
    } catch (error) {
      console.warn('Error recording view:', error)
    }
  }, [])

  return { recordView }
}

// Prefetch offers for better UX
export function prefetchOffers(status: string) {
  const cacheKey = `offers-${status}-1-20-true`
  const cached = cache.get(cacheKey)

  // Don't prefetch if we have fresh data
  if (cached && Date.now() - cached.timestamp < STALE_TIME) {
    return
  }

  // Prefetch in background
  fetch(`/api/offers?status=${status}&forUser=true&page=1&limit=20`)
    .then(res => res.json())
    .then(data => {
      cache.set(cacheKey, {
        data: data.offers || [],
        timestamp: Date.now(),
        status
      })
    })
    .catch(() => {
      // Silently fail for prefetch
    })
}

export default useOffers
