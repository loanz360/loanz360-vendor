'use client'

import { ReactNode, useState, useEffect, createContext, useContext } from 'react'
import { Menu, X, ChevronLeft, Bell, Settings, User } from 'lucide-react'

// ============================================================================
// Responsive Context
// ============================================================================

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'

interface ResponsiveContextType {
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
}

const ResponsiveContext = createContext<ResponsiveContextType | null>(null)

export function useResponsive() {
  const context = useContext(ResponsiveContext)
  if (!context) {
    // Return safe defaults for SSR
    return {
      breakpoint: 'desktop' as Breakpoint,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isWide: false,
      width: 1280,
      height: 720,
      orientation: 'landscape' as const
    }
  }
  return context
}

interface ResponsiveProviderProps {
  children: ReactNode
}

export function ResponsiveProvider({ children }: ResponsiveProviderProps) {
  const [state, setState] = useState<ResponsiveContextType>({
    breakpoint: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isWide: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
    orientation: 'landscape'
  })

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight

      let breakpoint: Breakpoint = 'desktop'
      if (width < 640) breakpoint = 'mobile'
      else if (width < 1024) breakpoint = 'tablet'
      else if (width >= 1536) breakpoint = 'wide'

      setState({
        breakpoint,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop' || breakpoint === 'wide',
        isWide: breakpoint === 'wide',
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait'
      })
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    window.addEventListener('orientationchange', updateSize)

    return () => {
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('orientationchange', updateSize)
    }
  }, [])

  return (
    <ResponsiveContext.Provider value={state}>
      {children}
    </ResponsiveContext.Provider>
  )
}

// ============================================================================
// Mobile-First Page Layout
// ============================================================================

interface MobilePageLayoutProps {
  children: ReactNode
  title?: string
  showBack?: boolean
  onBack?: () => void
  headerActions?: ReactNode
  footer?: ReactNode
  noPadding?: boolean
  className?: string
}

export function MobilePageLayout({
  children,
  title,
  showBack = false,
  onBack,
  headerActions,
  footer,
  noPadding = false,
  className = ''
}: MobilePageLayoutProps) {
  const { isMobile } = useResponsive()

  if (!isMobile) {
    // Desktop layout
    return <div className={className}>{children}</div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      {title && (
        <header className="sticky top-0 z-30 bg-white border-b safe-area-top">
          <div className="flex items-center h-14 px-4">
            {showBack && (
              <button
                onClick={onBack || (() => window.history.back())}
                className="p-2 -ml-2 mr-2 text-gray-600"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <h1 className="flex-1 text-lg font-semibold text-gray-900 truncate">
              {title}
            </h1>
            {headerActions && (
              <div className="flex items-center gap-1">{headerActions}</div>
            )}
          </div>
        </header>
      )}

      {/* Content */}
      <main className={`flex-1 ${noPadding ? '' : 'p-4'} ${className}`}>
        {children}
      </main>

      {/* Footer */}
      {footer && (
        <footer className="sticky bottom-0 bg-white border-t safe-area-bottom">
          {footer}
        </footer>
      )}
    </div>
  )
}

// ============================================================================
// Mobile Bottom Navigation
// ============================================================================

interface BottomNavItem {
  icon: ReactNode
  activeIcon?: ReactNode
  label: string
  href: string
  badge?: number
}

interface MobileBottomNavProps {
  items: BottomNavItem[]
  activeHref: string
  onNavigate: (href: string) => void
}

export function MobileBottomNav({ items, activeHref, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-area-bottom">
      <div className="flex items-stretch justify-around h-16">
        {items.map((item) => {
          const isActive = activeHref === item.href
          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <div className="relative">
                {isActive && item.activeIcon ? item.activeIcon : item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ============================================================================
// Mobile Slide-in Drawer
// ============================================================================

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  side?: 'left' | 'right'
  title?: string
  width?: string
}

export function MobileDrawer({
  open,
  onClose,
  children,
  side = 'left',
  title,
  width = '80%'
}: MobileDrawerProps) {
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

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`absolute top-0 bottom-0 bg-white shadow-xl transition-transform duration-300 ${
          side === 'left' ? 'left-0' : 'right-0'
        } ${
          open
            ? 'translate-x-0'
            : side === 'left'
            ? '-translate-x-full'
            : 'translate-x-full'
        }`}
        style={{ width, maxWidth: '100%' }}
      >
        {title && (
          <div className="flex items-center justify-between h-14 px-4 border-b safe-area-top">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-auto" style={{ height: title ? 'calc(100% - 56px)' : '100%' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Responsive Grid
// ============================================================================

interface ResponsiveGridProps {
  children: ReactNode
  cols?: {
    mobile?: number
    tablet?: number
    desktop?: number
    wide?: number
  }
  gap?: number
  className?: string
}

export function ResponsiveGrid({
  children,
  cols = { mobile: 1, tablet: 2, desktop: 3, wide: 4 },
  gap = 4,
  className = ''
}: ResponsiveGridProps) {
  const { breakpoint } = useResponsive()

  const getColumns = () => {
    switch (breakpoint) {
      case 'mobile': return cols.mobile || 1
      case 'tablet': return cols.tablet || 2
      case 'wide': return cols.wide || 4
      default: return cols.desktop || 3
    }
  }

  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${getColumns()}, minmax(0, 1fr))`,
        gap: `${gap * 4}px`
      }}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Responsive Container
// ============================================================================

interface ResponsiveContainerProps {
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  className?: string
  padding?: boolean
}

export function ResponsiveContainer({
  children,
  maxWidth = 'xl',
  className = '',
  padding = true
}: ResponsiveContainerProps) {
  const maxWidths = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full'
  }

  return (
    <div className={`mx-auto w-full ${maxWidths[maxWidth]} ${padding ? 'px-4 sm:px-6 lg:px-8' : ''} ${className}`}>
      {children}
    </div>
  )
}

// ============================================================================
// Hide/Show on Breakpoint
// ============================================================================

interface ResponsiveVisibilityProps {
  children: ReactNode
  show?: Breakpoint[]
  hide?: Breakpoint[]
}

export function ResponsiveVisibility({ children, show, hide }: ResponsiveVisibilityProps) {
  const { breakpoint } = useResponsive()

  if (show && !show.includes(breakpoint)) {
    return null
  }

  if (hide && hide.includes(breakpoint)) {
    return null
  }

  return <>{children}</>
}

// ============================================================================
// Touch-Friendly Button
// ============================================================================

interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function TouchButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: TouchButtonProps) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
    ghost: 'text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
  }

  const sizes = {
    sm: 'h-9 px-3 text-sm min-w-[44px]',
    md: 'h-11 px-4 text-base min-w-[44px]',
    lg: 'h-14 px-6 text-lg min-w-[44px]'
  }

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        variants[variant]
      } ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
}
