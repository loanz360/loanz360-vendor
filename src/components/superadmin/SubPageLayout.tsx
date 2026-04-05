'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'
import { BackButton } from './BackButton'
import { cn } from '@/lib/utils/cn'

interface Breadcrumb {
  label: string
  href?: string
}

interface SubPageLayoutProps {
  title: string
  description?: string
  icon?: LucideIcon
  backHref: string
  backLabel?: string
  breadcrumbs?: Breadcrumb[]
  headerActions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function SubPageLayout({
  title,
  description,
  icon: Icon,
  backHref,
  backLabel = 'Back',
  breadcrumbs,
  headerActions,
  children,
  className,
}: SubPageLayoutProps) {
  return (
    <div className={cn('min-h-full p-6', className)}>
      {/* Header with Back Button */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="text-gray-600">/</span>}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="hover:text-orange-400 transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="text-gray-300">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Title */}
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Icon className="w-6 h-6 text-orange-500" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white font-poppins">
                {title}
              </h1>
              {description && (
                <p className="text-gray-400 text-sm mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Back Button and Actions */}
        <div className="flex items-center gap-3">
          {headerActions}
          <BackButton href={backHref} label={backLabel} />
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  )
}

export default SubPageLayout
