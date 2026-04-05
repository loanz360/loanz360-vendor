'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface NavigationCardProps {
  icon: LucideIcon
  title: string
  description: string
  href: string
  badge?: number | string
  badgeVariant?: 'default' | 'warning' | 'success' | 'error'
  disabled?: boolean
  className?: string
}

export function NavigationCard({
  icon: Icon,
  title,
  description,
  href,
  badge,
  badgeVariant = 'default',
  disabled = false,
  className,
}: NavigationCardProps) {
  const router = useRouter()

  const handleClick = () => {
    if (!disabled) {
      router.push(href)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault()
      router.push(href)
    }
  }

  const badgeColors = {
    default: 'bg-orange-500 text-white',
    warning: 'bg-yellow-500 text-gray-900',
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative overflow-hidden rounded-xl transition-all duration-300',
        'bg-gradient-to-br from-gray-800/80 to-gray-900/80',
        'border border-gray-700/50',
        'p-6',
        !disabled && [
          'cursor-pointer',
          'hover:border-orange-500/50',
          'hover:shadow-lg hover:shadow-orange-500/10',
          'hover:scale-[1.02]',
          'focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-gray-900',
        ],
        disabled && [
          'opacity-50',
          'cursor-not-allowed',
        ],
        className
      )}
      aria-disabled={disabled}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-600/0 group-hover:from-orange-500/5 group-hover:to-orange-600/10 transition-all duration-300" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            'p-3 rounded-xl transition-all duration-300',
            'bg-gradient-to-br from-orange-500/20 to-orange-600/10',
            'group-hover:from-orange-500/30 group-hover:to-orange-600/20',
            'group-hover:scale-110',
          )}>
            <Icon className="w-6 h-6 text-orange-400 group-hover:text-orange-300 transition-colors" />
          </div>

          {badge !== undefined && (
            <span className={cn(
              'px-2.5 py-1 text-xs font-bold rounded-full',
              badgeColors[badgeVariant],
              'animate-pulse',
            )}>
              {badge}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-white mb-2 group-hover:text-orange-50 transition-colors font-poppins">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors line-clamp-2">
          {description}
        </p>

        {/* Arrow indicator */}
        <div className="mt-auto pt-4 flex items-center text-orange-400 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-0 group-hover:translate-x-1">
          <span className="text-sm font-medium">Open</span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export interface NavigationCardGridProps {
  children: React.ReactNode
  className?: string
}

export function NavigationCardGrid({ children, className }: NavigationCardGridProps) {
  return (
    <div className={cn(
      'grid gap-4',
      'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      className
    )}>
      {children}
    </div>
  )
}

export interface MenuPageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
}

export function MenuPageHeader({
  title,
  description,
  icon: Icon,
  breadcrumbs,
  actions,
}: MenuPageHeaderProps) {
  const router = useRouter()

  return (
    <div className="mb-8">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm mb-4" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {crumb.href ? (
                <button
                  onClick={() => router.push(crumb.href!)}
                  className="text-gray-400 hover:text-orange-400 transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-orange-400 font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Header content */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          {Icon && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10">
              <Icon className="w-8 h-8 text-orange-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white font-poppins">{title}</h1>
            {description && (
              <p className="text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
