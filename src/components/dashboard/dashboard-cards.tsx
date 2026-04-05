'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

// Main Welcome Hero Card
interface WelcomeHeroProps {
  title?: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
}

export function WelcomeHero({
  title = "Welcome to Your Loan Management Hub",
  subtitle = "Monitor loan applications, track approvals, manage customer portfolios, and oversee your entire lending ecosystem with ease.",
  children,
  className
}: WelcomeHeroProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg bg-gradient-to-r from-gray-800 to-gray-700 p-8 mb-6",
      className
    )}>
      {/* Background pattern/logo */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
        <div className="text-8xl font-bold text-orange-500">360</div>
      </div>

      <div className="relative z-10">
        <h1 className="text-3xl font-bold mb-3 font-poppins">{title}</h1>
        <p className="text-gray-300 text-lg mb-6 max-w-2xl">{subtitle}</p>

        {/* Action buttons */}
        <div className="flex gap-4">
          <div className="bg-orange-500 text-white px-6 py-3 rounded-lg">
            <div className="text-sm font-medium">Active Loans</div>
            <div className="text-2xl font-bold">2417</div>
            <div className="text-xs opacity-90">applications</div>
          </div>
          <div className="bg-orange-600 text-white px-6 py-3 rounded-lg">
            <div className="text-sm font-medium">Pending Approvals</div>
            <div className="text-2xl font-bold">158</div>
            <div className="text-xs opacity-90">pending review</div>
          </div>
        </div>
      </div>

      {children}
    </div>
  )
}

// Organization Overview Cards
interface OrganizationCardProps {
  label: string
  value: string | number
  change?: string
  icon?: React.ReactNode
  className?: string
}

export function OrganizationCard({
  label,
  value,
  change,
  icon,
  className
}: OrganizationCardProps) {
  return (
    <div className={cn(
      "bg-brand-ash rounded-lg p-6 relative overflow-hidden",
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className="text-white text-3xl font-bold mt-2">{value}</p>
          {change && (
            <p className="text-orange-500 text-sm mt-1">{change}</p>
          )}
        </div>
        {icon && (
          <div className="text-orange-500 opacity-80">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// System Activity Cards
interface SystemActivityCardProps {
  label: string
  value: string | number
  subtitle?: string
  className?: string
}

export function SystemActivityCard({
  label,
  value,
  subtitle,
  className
}: SystemActivityCardProps) {
  return (
    <div className={cn(
      "bg-brand-ash rounded-lg p-6",
      className
    )}>
      <p className="text-gray-400 text-sm font-medium mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-white text-2xl font-bold">{value}</span>
        {subtitle && (
          <span className="text-orange-500 text-sm">{subtitle}</span>
        )}
      </div>
    </div>
  )
}

// Loan Portfolio Cards
interface LoanPortfolioCardProps {
  label: string
  value: string
  subtitle: string
  className?: string
}

export function LoanPortfolioCard({
  label,
  value,
  subtitle,
  className
}: LoanPortfolioCardProps) {
  return (
    <div className={cn(
      "bg-brand-ash rounded-lg p-6",
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        <div className="text-orange-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
      <p className="text-green-500 text-sm mt-1">{subtitle}</p>
    </div>
  )
}

// Activity Feed Item
interface ActivityFeedItemProps {
  type: 'success' | 'pending' | 'rejected' | 'info' | 'warning'
  title: string
  user: string
  amount?: string
  time: string
  className?: string
}

export function ActivityFeedItem({
  type,
  title,
  user,
  amount,
  time,
  className
}: ActivityFeedItemProps) {
  const getStatusColor = () => {
    switch (type) {
      case 'success': return 'text-green-500'
      case 'pending': return 'text-yellow-500'
      case 'rejected': return 'text-red-500'
      case 'info': return 'text-blue-500'
      case 'warning': return 'text-orange-500'
      default: return 'text-gray-500'
    }
  }

  const getStatusBg = () => {
    switch (type) {
      case 'success': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'rejected': return 'bg-red-500'
      case 'info': return 'bg-blue-500'
      case 'warning': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 bg-brand-ash rounded-lg border border-gray-700",
      className
    )}>
      <div className={cn("w-2 h-2 rounded-full", getStatusBg())}></div>
      <div className="flex-1">
        <p className="text-white text-sm font-medium">{title}</p>
        <p className="text-gray-400 text-xs">{user}</p>
        {amount && (
          <p className="text-gray-300 text-xs">{amount}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-gray-400 text-xs">{time}</p>
        <div className={cn("text-xs px-2 py-1 rounded", getStatusColor())}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </div>
      </div>
    </div>
  )
}

// Real-time Activity Feed
interface ActivityFeedProps {
  activities?: Array<{
    type: 'success' | 'pending' | 'rejected' | 'info' | 'warning'
    title: string
    user: string
    amount?: string
    time: string
  }>
  className?: string
}

export function ActivityFeed({
  activities = [],
  className
}: ActivityFeedProps) {
  const defaultActivities = [
    {
      type: 'pending' as const,
      title: 'New loan application submitted',
      user: 'Rajesh Kumar',
      amount: '₹5,50,000',
      time: '2 minutes ago'
    },
    {
      type: 'success' as const,
      title: 'Loan sanctioned successfully',
      user: 'Priya Sharma',
      amount: '₹3,25,000',
      time: '5 minutes ago'
    },
    {
      type: 'info' as const,
      title: 'Business Associate joined',
      user: 'Arjit Singh',
      amount: '',
      time: '12 minutes ago'
    },
    {
      type: 'rejected' as const,
      title: 'Loan application rejected',
      user: 'Sneha Patel',
      amount: '₹2,75,000',
      time: '18 minutes ago'
    },
    {
      type: 'success' as const,
      title: 'Loan amount disbursed',
      user: 'Vikram Gupta',
      amount: '₹4,85,000',
      time: '25 minutes ago'
    }
  ]

  const feedItems = activities.length > 0 ? activities : defaultActivities

  return (
    <div className={cn("bg-brand-ash rounded-lg p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold font-poppins">Real-Time Activity Feed</h3>
        <button className="text-orange-500 text-sm hover:text-orange-400">
          View All Activities
        </button>
      </div>

      <div className="space-y-3">
        {feedItems.map((activity, index) => (
          <ActivityFeedItem
            key={index}
            type={activity.type}
            title={activity.title}
            user={activity.user}
            amount={activity.amount}
            time={activity.time}
          />
        ))}
      </div>
    </div>
  )
}

// Performance Cards (Bottom section)
interface PerformanceCardProps {
  label: string
  value: string | number
  subtitle?: string
  className?: string
}

export function PerformanceCard({
  label,
  value,
  subtitle,
  className
}: PerformanceCardProps) {
  return (
    <div className={cn(
      "bg-brand-ash rounded-lg p-6 text-center",
      className
    )}>
      <p className="text-gray-400 text-sm font-medium mb-2">{label}</p>
      <p className="text-white text-xl font-bold mb-1">{value}</p>
      {subtitle && (
        <p className="text-gray-500 text-xs">{subtitle}</p>
      )}
    </div>
  )
}