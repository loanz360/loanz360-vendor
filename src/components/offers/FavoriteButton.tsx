'use client'

import { useState, useEffect } from 'react'
import { Heart, Star, Bookmark } from 'lucide-react'
import { toast } from 'sonner'

interface FavoriteButtonProps {
  offerId: string
  offerTitle?: string
  initialFavorited?: boolean
  initialStarred?: boolean
  variant?: 'heart' | 'star' | 'bookmark'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  onFavoriteChange?: (favorited: boolean) => void
  className?: string
}

export default function FavoriteButton({
  offerId,
  offerTitle = 'this offer',
  initialFavorited = false,
  initialStarred = false,
  variant = 'heart',
  size = 'md',
  showLabel = false,
  onFavoriteChange,
  className = ''
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited)
  const [isStarred, setIsStarred] = useState(initialStarred)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsFavorited(initialFavorited)
    setIsStarred(initialStarred)
  }, [initialFavorited, initialStarred])

  // Get icon component based on variant
  const Icon = variant === 'star' ? Star : variant === 'bookmark' ? Bookmark : Heart

  // Get size classes
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const buttonSizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5'
  }

  // Handle favorite toggle
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        const response = await fetch(`/api/offers/favorites?offer_id=${offerId}`, {
          method: 'DELETE'
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to remove from favorites')
        }

        setIsFavorited(false)
        toast.success(`Removed from favorites`, {
          description: offerTitle,
          duration: 2000
        })

        onFavoriteChange?.(false)
      } else {
        // Add to favorites
        const response = await fetch('/api/offers/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offer_id: offerId,
            collection_name: 'default'
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add to favorites')
        }

        setIsFavorited(true)
        toast.success(`Added to favorites`, {
          description: offerTitle,
          duration: 2000
        })

        onFavoriteChange?.(true)
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error('Failed to update favorite', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle star toggle (only if already favorited)
  const handleToggleStar = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isFavorited) {
      toast.error('Please add to favorites first')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/offers/favorites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offerId,
          action: 'toggle_star'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle star')
      }

      setIsStarred(data.is_starred)
      toast.success(data.is_starred ? 'Starred' : 'Unstarred', {
        description: offerTitle,
        duration: 2000
      })
    } catch (error) {
      console.error('Error toggling star:', error)
      toast.error('Failed to update star', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 3000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = variant === 'star' && isFavorited
    ? handleToggleStar
    : handleToggleFavorite

  const isActive = variant === 'star' ? isStarred : isFavorited

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        ${buttonSizeClasses[size]}
        rounded-lg transition-all duration-200
        hover:scale-110 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${isActive
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-400 hover:text-red-500'
        }
        ${className}
      `}
      title={
        variant === 'star'
          ? (isStarred ? 'Unstar' : 'Star')
          : (isFavorited ? 'Remove from favorites' : 'Add to favorites')
      }
      aria-label={
        variant === 'star'
          ? (isStarred ? 'Unstar' : 'Star')
          : (isFavorited ? 'Remove from favorites' : 'Add to favorites')
      }
    >
      <div className="relative">
        {/* Outer glow effect when active */}
        {isActive && (
          <div className="absolute inset-0 animate-pulse">
            <Icon
              className={`${sizeClasses[size]} blur-sm opacity-50`}
              fill="currentColor"
            />
          </div>
        )}

        {/* Main icon */}
        <Icon
          className={`${sizeClasses[size]} relative transition-all`}
          fill={isActive ? 'currentColor' : 'none'}
          strokeWidth={isActive ? 0 : 2}
        />
      </div>

      {showLabel && (
        <span className="ml-2 text-sm">
          {variant === 'star'
            ? (isStarred ? 'Starred' : 'Star')
            : (isFavorited ? 'Favorited' : 'Favorite')
          }
        </span>
      )}
    </button>
  )
}

/**
 * Compact Favorites Indicator
 * Shows favorite status with count
 */
export function FavoritesIndicator({
  count,
  className = ''
}: {
  count: number
  className?: string
}) {
  if (count === 0) return null

  return (
    <div className={`flex items-center gap-1 text-xs text-gray-400 ${className}`}>
      <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
      <span>{count}</span>
    </div>
  )
}
