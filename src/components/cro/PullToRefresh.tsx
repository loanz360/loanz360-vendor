'use client'

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type TouchEvent,
} from 'react'
import { Loader2, ArrowDown } from 'lucide-react'

interface PullToRefreshProps {
  children: ReactNode
  onRefresh: () => Promise<void>
  disabled?: boolean
}

const PULL_THRESHOLD = 80
const MAX_PULL = 140
const REFRESH_TIMEOUT = 10_000

type RefreshState = 'idle' | 'pulling' | 'threshold' | 'refreshing'

export default function PullToRefresh({
  children,
  onRefresh,
  disabled = false,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [state, setState] = useState<RefreshState>('idle')

  const startY = useRef(0)
  const isPulling = useRef(false)
  const isAtTop = useRef(true)

  // Check if the scroll container is at the top
  const checkScrollTop = useCallback(() => {
    if (!containerRef.current) return
    isAtTop.current = containerRef.current.scrollTop <= 0
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('scroll', checkScrollTop, { passive: true })
    return () => container.removeEventListener('scroll', checkScrollTop)
  }, [checkScrollTop])

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || state === 'refreshing') return
      checkScrollTop()
      if (!isAtTop.current) return

      startY.current = e.touches[0].clientY
      isPulling.current = true
    },
    [disabled, state, checkScrollTop]
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || disabled || state === 'refreshing') return
      if (!isAtTop.current) return

      const deltaY = e.touches[0].clientY - startY.current

      // Only activate on downward pull
      if (deltaY <= 0) {
        setPullDistance(0)
        setState('idle')
        return
      }

      // Rubber-band resistance effect: diminishing returns as pull increases
      const resistance = Math.max(0.3, 1 - deltaY / (MAX_PULL * 3))
      const distance = Math.min(deltaY * resistance, MAX_PULL)

      setPullDistance(distance)
      setState(distance >= PULL_THRESHOLD ? 'threshold' : 'pulling')
    },
    [disabled, state]
  )

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (state === 'threshold' && !disabled) {
      setState('refreshing')
      setPullDistance(PULL_THRESHOLD * 0.6) // Settle at a smaller distance while refreshing

      // Run refresh with timeout safety
      try {
        await Promise.race([
          onRefresh(),
          new Promise<void>((_, reject) =>
            setTimeout(
              () => reject(new Error('Refresh timeout')),
              REFRESH_TIMEOUT
            )
          ),
        ])
      } catch {
        // Silently handle timeout or errors
      } finally {
        setState('idle')
        setPullDistance(0)
      }
    } else {
      setState('idle')
      setPullDistance(0)
    }
  }, [state, disabled, onRefresh])

  const indicatorOpacity = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const indicatorScale = 0.5 + indicatorOpacity * 0.5
  const rotation = state === 'threshold' ? 180 : (pullDistance / PULL_THRESHOLD) * 180

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto overscroll-y-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
        style={{
          top: 0,
          height: `${pullDistance}px`,
          transition:
            state === 'idle' || state === 'refreshing'
              ? 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              : 'none',
        }}
        aria-hidden="true"
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 border border-white/10 shadow-lg"
          style={{
            opacity: indicatorOpacity,
            transform: `scale(${indicatorScale})`,
            transition:
              state === 'idle' || state === 'refreshing'
                ? 'opacity 0.3s, transform 0.3s'
                : 'none',
          }}
        >
          {state === 'refreshing' ? (
            <Loader2 className="w-5 h-5 text-[#FF6700] animate-spin" />
          ) : (
            <ArrowDown
              className="w-5 h-5 text-[#FF6700] transition-transform duration-200"
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Content area that shifts down during pull */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition:
            state === 'idle' || state === 'refreshing'
              ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
              : 'none',
        }}
      >
        {children}
      </div>

      {/* Screen reader announcement */}
      {state === 'refreshing' && (
        <div className="sr-only" role="status" aria-live="polite">
          Refreshing content...
        </div>
      )}
    </div>
  )
}
