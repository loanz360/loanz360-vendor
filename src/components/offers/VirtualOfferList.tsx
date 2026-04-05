'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Offer, OfferPermissions } from '@/types/offers'

interface OfferWithStats extends Offer {
  view_count?: number
  share_count?: number
  conversion_count?: number
  is_favorite?: boolean
  recommendation_score?: number
}

interface VirtualOfferListProps {
  offers: OfferWithStats[]
  itemHeight?: number
  overscan?: number // Number of items to render above/below viewport
  permissions: OfferPermissions
  favorites: Set<string>
  viewMode: 'grid' | 'list'
  onView: (offer: OfferWithStats) => void
  onShare?: (offer: OfferWithStats) => void
  onFavorite?: (offerId: string) => void
  onEdit?: (offer: OfferWithStats) => void
  onDelete?: (offerId: string) => void
  renderItem: (props: RenderItemProps) => React.ReactNode
}

interface RenderItemProps {
  offer: OfferWithStats
  index: number
  style: React.CSSProperties
  permissions: OfferPermissions
  isFavorite: boolean
  onView: () => void
  onShare?: () => void
  onFavorite?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

interface VirtualItem {
  index: number
  offer: OfferWithStats
  top: number
  height: number
}

const DEFAULT_ITEM_HEIGHT_LIST = 120
const DEFAULT_ITEM_HEIGHT_GRID = 380
const DEFAULT_OVERSCAN = 5
const GRID_COLUMNS = 3
const GRID_GAP = 24

export default function VirtualOfferList({
  offers,
  itemHeight,
  overscan = DEFAULT_OVERSCAN,
  permissions,
  favorites,
  viewMode,
  onView,
  onShare,
  onFavorite,
  onEdit,
  onDelete,
  renderItem
}: VirtualOfferListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  // Calculate actual item height based on view mode
  const actualItemHeight = itemHeight || (viewMode === 'list' ? DEFAULT_ITEM_HEIGHT_LIST : DEFAULT_ITEM_HEIGHT_GRID)

  // Calculate columns for grid view
  const columns = useMemo(() => {
    if (viewMode === 'list') return 1
    if (containerWidth === 0) return GRID_COLUMNS
    // Responsive columns based on width
    if (containerWidth < 768) return 1
    if (containerWidth < 1024) return 2
    return 3
  }, [viewMode, containerWidth])

  // Calculate row count
  const rowCount = Math.ceil(offers.length / columns)

  // Calculate total height
  const totalHeight = useMemo(() => {
    return rowCount * (actualItemHeight + GRID_GAP) - GRID_GAP
  }, [rowCount, actualItemHeight])

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / (actualItemHeight + GRID_GAP)) - overscan)
    const endRow = Math.min(
      rowCount,
      Math.ceil((scrollTop + containerHeight) / (actualItemHeight + GRID_GAP)) + overscan
    )
    return { startRow, endRow }
  }, [scrollTop, containerHeight, actualItemHeight, rowCount, overscan])

  // Calculate visible items
  const visibleItems: VirtualItem[] = useMemo(() => {
    const items: VirtualItem[] = []
    const { startRow, endRow } = visibleRange

    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col
        if (index >= offers.length) break

        items.push({
          index,
          offer: offers[index],
          top: row * (actualItemHeight + GRID_GAP),
          height: actualItemHeight
        })
      }
    }

    return items
  }, [offers, visibleRange, columns, actualItemHeight])

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(container)
    setContainerHeight(container.clientHeight)
    setContainerWidth(container.clientWidth)

    return () => resizeObserver.disconnect()
  }, [])

  // Calculate item width for grid
  const itemWidth = useMemo(() => {
    if (viewMode === 'list') return '100%'
    if (containerWidth === 0) return 'calc(33.333% - 16px)'
    const gap = GRID_GAP * (columns - 1)
    return `${(containerWidth - gap) / columns}px`
  }, [viewMode, containerWidth, columns])

  // Render empty state
  if (offers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No offers found
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto"
      style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
      onScroll={handleScroll}
    >
      {/* Total height container for proper scrollbar */}
      <div
        style={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Render visible items */}
        <AnimatePresence mode="popLayout">
          {visibleItems.map(({ index, offer, top, height }) => {
            const col = index % columns
            const computedItemWidth = containerWidth > 0 ? (containerWidth - GRID_GAP * (columns - 1)) / columns : 300
            const left = viewMode === 'list' ? 0 : col * (computedItemWidth + GRID_GAP)

            return (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: 'absolute',
                  top,
                  left: viewMode === 'list' ? 0 : left,
                  width: itemWidth,
                  height
                }}
              >
                {renderItem({
                  offer,
                  index,
                  style: { height: '100%' },
                  permissions,
                  isFavorite: favorites.has(offer.id),
                  onView: () => onView(offer),
                  onShare: onShare ? () => onShare(offer) : undefined,
                  onFavorite: onFavorite ? () => onFavorite(offer.id) : undefined,
                  onEdit: onEdit ? () => onEdit(offer) : undefined,
                  onDelete: onDelete ? () => onDelete(offer.id) : undefined
                })}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Scroll to top button */}
      {scrollTop > 500 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => {
            containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="fixed bottom-6 right-6 p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg z-50 transition-all"
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </motion.button>
      )}
    </div>
  )
}

// Simpler infinite scroll hook for standard pagination
interface UseInfiniteScrollOptions {
  threshold?: number
  onLoadMore: () => void
  hasMore: boolean
  loading: boolean
}

export function useInfiniteScroll({
  threshold = 200,
  onLoadMore,
  hasMore,
  loading
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (loading || !hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore()
        }
      },
      {
        rootMargin: `${threshold}px`
      }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loading, onLoadMore, threshold])

  return loadMoreRef
}

// Loading skeleton for offers
export function OfferSkeletons({ count = 6, viewMode = 'grid' }: { count?: number; viewMode?: 'grid' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-lg p-4 animate-pulse"
          >
            <div className="flex gap-4">
              <div className="w-24 h-24 bg-gray-700 rounded-lg" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-700 rounded w-3/4" />
                <div className="h-4 bg-gray-700 rounded w-1/4" />
                <div className="h-4 bg-gray-700 rounded w-full" />
                <div className="h-4 bg-gray-700 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white/5 border border-white/10 rounded-lg overflow-hidden animate-pulse"
        >
          <div className="h-48 bg-gray-700" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-700 rounded w-1/2" />
            <div className="h-4 bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-700 rounded w-2/3" />
            <div className="flex justify-between">
              <div className="h-4 bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-700 rounded w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
