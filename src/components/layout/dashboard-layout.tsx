'use client'

import React from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth/auth-context'
import { DashboardSidebar } from './dashboard-sidebar'
import { DashboardHeader } from './dashboard-header'
import { cn } from '@/lib/utils/cn'

interface DashboardLayoutProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
}

export function DashboardLayout({
  children,
  className,
  title = "Dashboard",
  subtitle = "Welcome back! Here's what's happening today."
}: DashboardLayoutProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return <DashboardLoadingState />
  }

  if (!user) {
    return null // This should be handled by route protection
  }

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader title={title} subtitle={subtitle} />

        {/* Content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-black p-6",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}

// Loading state component
function DashboardLoadingState() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center flex flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted border-t-primary mx-auto" />
        <div className="flex flex-col gap-2">
          <div className="h-4 bg-muted animate-pulse rounded w-24 mx-auto" />
          <div className="h-3 bg-muted animate-pulse rounded w-32 mx-auto" />
        </div>
      </div>
    </div>
  )
}


// Banner component for the 1200x300 banner requirement
export function DashboardBanner({
  imageUrl,
  title,
  description,
  ctaText,
  ctaAction,
  className
}: {
  imageUrl?: string
  title?: string
  description?: string
  ctaText?: string
  ctaAction?: () => void
  className?: string
}) {
  return (
    <div className={cn("banner mb-6", className)}>
      {imageUrl ? (
        <div className="relative overflow-hidden rounded-lg">
          <Image
            src={imageUrl}
            alt={title || 'Dashboard Banner'}
            width={1200}
            height={300}
            className="w-full h-full object-cover"
          />
          {(title || description || ctaText) && (
            <div className="absolute inset-0 bg-black/40 flex items-center">
              <div className="container-app">
                <div className="max-w-2xl flex flex-col gap-4 text-white">
                  {title && (
                    <h2 className="text-3xl font-bold font-poppins">{title}</h2>
                  )}
                  {description && (
                    <p className="text-lg opacity-90">{description}</p>
                  )}
                  {ctaText && ctaAction && (
                    <button
                      onClick={ctaAction}
                      className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
                    >
                      {ctaText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gradient-dark rounded-lg p-8 text-center">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {title && (
              <h2 className="text-3xl font-bold text-primary font-poppins">{title}</h2>
            )}
            {description && (
              <p className="text-lg text-muted-foreground">{description}</p>
            )}
            {ctaText && ctaAction && (
              <button
                onClick={ctaAction}
                className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                {ctaText}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Page wrapper for consistent spacing and banner placement
export function DashboardPage({
  children,
  banner,
  title,
  description,
  className,
  actions
}: {
  children: React.ReactNode
  banner?: React.ReactNode
  title?: string
  description?: string
  className?: string
  actions?: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Banner */}
      {banner}

      {/* Page Header */}
      {(title || description || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            {title && (
              <h1 className="text-2xl font-bold text-foreground font-poppins">{title}</h1>
            )}
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Page Content */}
      <div>{children}</div>
    </div>
  )
}

// Quick stats component for dashboard overviews
export function DashboardStats({
  stats,
  className
}: {
  stats: Array<{
    label: string
    value: string | number
    change?: string
    changeType?: 'positive' | 'negative' | 'neutral'
    icon?: React.ReactNode
  }>
  className?: string
}) {
  return (
    <div className={cn("grid-dashboard", className)}>
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-card border border-border rounded-lg p-6 hover:shadow-card-hover transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-primary mt-2">
                {stat.value}
              </p>
              {stat.change && (
                <div className="flex items-center mt-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      stat.changeType === 'positive' && "text-success",
                      stat.changeType === 'negative' && "text-error",
                      stat.changeType === 'neutral' && "text-muted-foreground"
                    )}
                  >
                    {stat.changeType === 'positive' && "↗"}{" "}
                    {stat.changeType === 'negative' && "↘"}{" "}
                    {stat.change}
                  </span>
                </div>
              )}
            </div>
            {stat.icon && (
              <div className="text-primary opacity-80">
                {stat.icon}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default DashboardLayout