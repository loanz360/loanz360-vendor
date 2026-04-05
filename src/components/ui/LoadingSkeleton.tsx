'use client'

import React from 'react'

interface SkeletonProps {
  className?: string
}

/** Base skeleton pulse element */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
  )
}

/** Card skeleton with header + body lines */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

/** Stats card row skeleton (e.g., dashboard stats) */
export function StatsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-800 bg-[#141414] p-4 space-y-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-2 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/** Table skeleton */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#141414] overflow-hidden">
      {/* Header */}
      <div className="grid gap-4 p-4 border-b border-gray-800" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-3/4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="grid gap-4 p-4 border-b border-gray-800/50" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className={`h-3 ${colIdx === 0 ? 'w-full' : 'w-2/3'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Full page skeleton for customer portal pages */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stats row */}
      <StatsRowSkeleton />
      {/* Content cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={3} />
      </div>
      <CardSkeleton lines={5} />
    </div>
  )
}

export default Skeleton
