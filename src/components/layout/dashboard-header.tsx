'use client'

import React from 'react'
import Image from 'next/image'
import { SearchInput } from '@/components/ui/input'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils/cn'

interface DashboardHeaderProps {
  title?: string
  subtitle?: string
  className?: string
}

export function DashboardHeader({
  title = "Dashboard",
  subtitle = "Welcome back! Here's what's happening today.",
  className
}: DashboardHeaderProps) {
  const { user } = useAuth()

  return (
    <header className={cn(
      "bg-black border-b border-gray-800 px-6 py-4",
      className
    )}>
      <div className="flex items-center justify-between">
        {/* Left side - Title and subtitle */}
        <div>
          <h1 className="text-2xl font-bold font-poppins">{title}</h1>
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        </div>

        {/* Right side - Search and profile */}
        <div className="flex items-center space-x-4">
          {/* Search bar */}
          <div className="w-80">
            <SearchInput
              placeholder="Search..."
              className="bg-brand-ash border-gray-700 text-white placeholder-gray-500"
              variant="filled"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <NotificationIcon />
            <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full"></span>
          </button>

          {/* Profile section */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {user?.full_name?.charAt(0) || 'J'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

const NotificationIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)