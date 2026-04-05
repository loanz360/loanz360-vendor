'use client'

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Menu, MoreVertical, Plus, Search, Filter, SortAsc, Check } from 'lucide-react'

// ============================================================================
// Mobile Bottom Sheet
// ============================================================================

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  snapPoints?: number[]
  className?: string
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  snapPoints = [0.5, 0.9],
  className = ''
}: BottomSheetProps) {
  const [height, setHeight] = useState(snapPoints[0])
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragging(true)
    startY.current = e.touches[0].clientY
    startHeight.current = height
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return

    const deltaY = startY.current - e.touches[0].clientY
    const deltaPercent = deltaY / window.innerHeight
    const newHeight = Math.min(0.95, Math.max(0.1, startHeight.current + deltaPercent))
    setHeight(newHeight)
  }

  const handleTouchEnd = () => {
    setDragging(false)

    // Snap to nearest snap point
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev
    )

    if (height < 0.15) {
      onClose()
    } else {
      setHeight(nearest)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl transition-transform ${
          dragging ? '' : 'transition-all duration-300'
        } ${className}`}
        style={{ height: `${height * 100}vh` }}
      >
        {/* Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-4 pb-3 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-auto" style={{ height: 'calc(100% - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Mobile Action Sheet
// ============================================================================

interface ActionSheetOption {
  label: string
  icon?: ReactNode
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
}

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  options: ActionSheetOption[]
}

export function ActionSheet({ open, onClose, title, options }: ActionSheetProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 p-4 animate-slide-up">
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
          {title && (
            <div className="px-4 py-3 border-b text-center">
              <span className="text-sm text-gray-500">{title}</span>
            </div>
          )}
          <div className="divide-y">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  option.onClick()
                  onClose()
                }}
                disabled={option.disabled}
                className={`w-full px-4 py-3.5 flex items-center justify-center gap-3 text-center transition-colors ${
                  option.destructive
                    ? 'text-red-600 active:bg-red-50'
                    : 'text-gray-900 active:bg-gray-50'
                } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {option.icon}
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-2 bg-white rounded-2xl py-3.5 font-semibold text-blue-600 active:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Mobile Pull to Refresh
// ============================================================================

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const threshold = 80

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      setPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling || refreshing) return

    const deltaY = e.touches[0].clientY - startY.current
    if (deltaY > 0) {
      e.preventDefault()
      setPullDistance(Math.min(deltaY * 0.5, threshold * 1.5))
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true)
      await onRefresh()
      setRefreshing(false)
    }

    setPulling(false)
    setPullDistance(0)
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{ height: refreshing ? 50 : pullDistance }}
      >
        <div
          className={`transition-transform ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${pullDistance * 2}deg)` }}
        >
          <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
          </svg>
        </div>
      </div>

      {children}
    </div>
  )
}

// ============================================================================
// Mobile Swipeable Card
// ============================================================================

interface SwipeableCardProps {
  children: ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  leftAction?: ReactNode
  rightAction?: ReactNode
  threshold?: number
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  threshold = 100
}: SwipeableCardProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    setSwiping(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return

    const deltaX = e.touches[0].clientX - startX.current
    setOffsetX(deltaX)
  }

  const handleTouchEnd = () => {
    setSwiping(false)

    if (offsetX > threshold && onSwipeRight) {
      onSwipeRight()
    } else if (offsetX < -threshold && onSwipeLeft) {
      onSwipeLeft()
    }

    setOffsetX(0)
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {rightAction && (
          <div className="flex-1 flex items-center justify-start pl-4 bg-green-500">
            {rightAction}
          </div>
        )}
        {leftAction && (
          <div className="flex-1 flex items-center justify-end pr-4 bg-red-500">
            {leftAction}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="relative bg-white transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Mobile Floating Action Button
// ============================================================================

interface FABAction {
  icon: ReactNode
  label: string
  onClick: () => void
}

interface FloatingActionButtonProps {
  icon?: ReactNode
  actions?: FABAction[]
  onClick?: () => void
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left'
  className?: string
}

export function FloatingActionButton({
  icon = <Plus className="h-6 w-6" />,
  actions,
  onClick,
  position = 'bottom-right',
  className = ''
}: FloatingActionButtonProps) {
  const [expanded, setExpanded] = useState(false)

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-6 left-6'
  }

  const handleClick = () => {
    if (actions && actions.length > 0) {
      setExpanded(!expanded)
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div className={`fixed z-40 ${positionClasses[position]} ${className}`}>
      {/* Action buttons */}
      {expanded && actions && (
        <div className="absolute bottom-16 right-0 flex flex-col items-end gap-3 animate-fade-in">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => {
                action.onClick()
                setExpanded(false)
              }}
              className="flex items-center gap-3 bg-white rounded-full pl-4 pr-3 py-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <span className="text-sm font-medium text-gray-700">{action.label}</span>
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
                {action.icon}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleClick}
        className={`w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-blue-700 active:scale-95 transition-all ${
          expanded ? 'rotate-45' : ''
        }`}
      >
        {icon}
      </button>
    </div>
  )
}

// ============================================================================
// Mobile Search Bar with Filter
// ============================================================================

interface MobileSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onFilterClick?: () => void
  onSortClick?: () => void
  showFilter?: boolean
  showSort?: boolean
}

export function MobileSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  onFilterClick,
  onSortClick,
  showFilter = true,
  showSort = true
}: MobileSearchBarProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="flex items-center gap-2 p-3 bg-white border-b sticky top-0 z-10">
      <div
        className={`flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 transition-all ${
          focused ? 'ring-2 ring-blue-500 bg-white' : ''
        }`}
      >
        <Search className="h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {value && (
          <button onClick={() => onChange('')} className="p-1">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {showFilter && onFilterClick && (
        <button
          onClick={onFilterClick}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <Filter className="h-5 w-5" />
        </button>
      )}

      {showSort && onSortClick && (
        <button
          onClick={onSortClick}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <SortAsc className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

// ============================================================================
// Mobile Segmented Control
// ============================================================================

interface SegmentedControlProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({ options, value, onChange, className = '' }: SegmentedControlProps) {
  return (
    <div className={`flex bg-gray-100 rounded-xl p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ============================================================================
// Mobile Chip/Tag Select
// ============================================================================

interface ChipSelectProps {
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  multiple?: boolean
  className?: string
}

export function ChipSelect({
  options,
  selected,
  onChange,
  multiple = true,
  className = ''
}: ChipSelectProps) {
  const handleSelect = (value: string) => {
    if (multiple) {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value))
      } else {
        onChange([...selected, value])
      }
    } else {
      onChange([value])
    }
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSelected && <Check className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// Mobile Empty State
// ============================================================================

interface MobileEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function MobileEmptyState({
  icon,
  title,
  description,
  action
}: MobileEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
