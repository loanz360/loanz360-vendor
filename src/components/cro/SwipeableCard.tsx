'use client'

import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type TouchEvent,
  type MouseEvent,
} from 'react'

interface SwipeAction {
  label: string
  icon: ReactNode
  color: string
}

interface SwipeableCardProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: SwipeAction
  rightAction?: SwipeAction
}

const SWIPE_THRESHOLD = 80
const MAX_SWIPE = 120

export default function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
}: SwipeableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const isHorizontalSwipe = useRef<boolean | null>(null)

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max)

  const resetPosition = useCallback(() => {
    setIsTransitioning(true)
    setOffsetX(0)
    setTimeout(() => setIsTransitioning(false), 300)
  }, [])

  const handleSwipeEnd = useCallback(() => {
    setIsDragging(false)
    isHorizontalSwipe.current = null

    if (currentX.current <= -SWIPE_THRESHOLD && onSwipeLeft && leftAction) {
      setIsTransitioning(true)
      setOffsetX(-MAX_SWIPE)
      onSwipeLeft()
      setTimeout(() => {
        resetPosition()
      }, 400)
    } else if (
      currentX.current >= SWIPE_THRESHOLD &&
      onSwipeRight &&
      rightAction
    ) {
      setIsTransitioning(true)
      setOffsetX(MAX_SWIPE)
      onSwipeRight()
      setTimeout(() => {
        resetPosition()
      }, 400)
    } else {
      resetPosition()
    }
  }, [onSwipeLeft, onSwipeRight, leftAction, rightAction, resetPosition])

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return

      const deltaX = clientX - startX.current
      const deltaY = clientY - startY.current

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY)
        }
        return
      }

      // If vertical swipe, don't interfere with scrolling
      if (!isHorizontalSwipe.current) return

      // Limit swipe range based on available actions
      let minX = leftAction && onSwipeLeft ? -MAX_SWIPE : 0
      let maxX = rightAction && onSwipeRight ? MAX_SWIPE : 0

      const clamped = clamp(deltaX, minX, maxX)
      currentX.current = clamped

      // Apply resistance near edges
      const resistance = Math.abs(clamped) > SWIPE_THRESHOLD ? 0.4 : 1
      const resistedOffset =
        Math.abs(clamped) > SWIPE_THRESHOLD
          ? Math.sign(clamped) *
            (SWIPE_THRESHOLD +
              (Math.abs(clamped) - SWIPE_THRESHOLD) * resistance)
          : clamped

      setOffsetX(resistedOffset)
    },
    [isDragging, leftAction, rightAction, onSwipeLeft, onSwipeRight]
  )

  // Touch event handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    currentX.current = 0
    isHorizontalSwipe.current = null
    setIsDragging(true)
    setIsTransitioning(false)
  }, [])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    },
    [handleMove]
  )

  const handleTouchEnd = useCallback(() => {
    handleSwipeEnd()
  }, [handleSwipeEnd])

  // Mouse event handlers (desktop drag support)
  const handleMouseDown = useCallback((e: MouseEvent) => {
    startX.current = e.clientX
    startY.current = e.clientY
    currentX.current = 0
    isHorizontalSwipe.current = null
    setIsDragging(true)
    setIsTransitioning(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      e.preventDefault()
      handleMove(e.clientX, e.clientY)
    },
    [isDragging, handleMove]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    handleSwipeEnd()
  }, [isDragging, handleSwipeEnd])

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) return
    handleSwipeEnd()
  }, [isDragging, handleSwipeEnd])

  const absOffset = Math.abs(offsetX)
  const actionOpacity = clamp(absOffset / SWIPE_THRESHOLD, 0, 1)
  const actionScale = clamp(0.6 + (absOffset / SWIPE_THRESHOLD) * 0.4, 0.6, 1)

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left action revealed on swipe right */}
      {rightAction && onSwipeRight && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center px-6"
          style={{
            width: `${Math.max(absOffset, 0)}px`,
            backgroundColor: rightAction.color,
            opacity: offsetX > 0 ? actionOpacity : 0,
          }}
          aria-hidden="true"
        >
          <div
            className="flex flex-col items-center gap-1 text-white"
            style={{
              transform: `scale(${offsetX > 0 ? actionScale : 0})`,
              transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
            }}
          >
            {rightAction.icon}
            <span className="text-xs font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {/* Right action revealed on swipe left */}
      {leftAction && onSwipeLeft && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center px-6"
          style={{
            width: `${Math.max(absOffset, 0)}px`,
            backgroundColor: leftAction.color,
            opacity: offsetX < 0 ? actionOpacity : 0,
          }}
          aria-hidden="true"
        >
          <div
            className="flex flex-col items-center gap-1 text-white"
            style={{
              transform: `scale(${offsetX < 0 ? actionScale : 0})`,
              transition: isTransitioning ? 'transform 0.3s ease-out' : 'none',
            }}
          >
            {leftAction.icon}
            <span className="text-xs font-medium">{leftAction.label}</span>
          </div>
        </div>
      )}

      {/* Swipeable content */}
      <div
        className={`relative z-10 bg-gray-800 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isTransitioning
            ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        role="listitem"
      >
        {children}
      </div>
    </div>
  )
}
