'use client'

import React from 'react'

interface CROPageSkeletonProps {
  type?: 'table' | 'cards' | 'detail'
  rows?: number
  /** When true, only render the content rows (no stats/filter chrome). Use when stats & filters are already on the page. */
  compact?: boolean
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={`bg-gray-800 rounded animate-pulse ${className || ''}`} />
  )
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5">
      <ShimmerBar className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <ShimmerBar className="h-4 w-1/3" />
        <ShimmerBar className="h-3 w-1/2" />
      </div>
      <ShimmerBar className="h-6 w-20 rounded-full" />
      <ShimmerBar className="h-4 w-16" />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <ShimmerBar className="h-5 w-1/3" />
        <ShimmerBar className="h-5 w-16 rounded-full" />
      </div>
      <ShimmerBar className="h-3 w-2/3" />
      <ShimmerBar className="h-3 w-1/2" />
      <div className="flex gap-2 mt-2">
        <ShimmerBar className="h-8 w-20 rounded-lg" />
        <ShimmerBar className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-4">
          <ShimmerBar className="w-16 h-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <ShimmerBar className="h-6 w-1/3" />
            <ShimmerBar className="h-4 w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <ShimmerBar className="h-3 w-1/2" />
              <ShimmerBar className="h-5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-3">
        <ShimmerBar className="h-5 w-1/4 mb-4" />
        {[1, 2, 3].map(i => (
          <ShimmerBar key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  )
}

export default function CROPageSkeleton({ type = 'table', rows = 5, compact = false }: CROPageSkeletonProps) {
  if (type === 'detail') {
    return <DetailSkeleton />
  }

  if (type === 'cards') {
    if (compact) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )
    }
    return (
      <div className="space-y-6">
        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <ShimmerBar className="h-3 w-1/2 mb-2" />
              <ShimmerBar className="h-7 w-1/3" />
            </div>
          ))}
        </div>
        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Table skeleton (default)
  if (compact) {
    // Only render the table rows, no stats or filter bar
    return (
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <ShimmerBar className="h-3 w-1/2 mb-2" />
            <ShimmerBar className="h-7 w-1/3" />
          </div>
        ))}
      </div>
      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <ShimmerBar className="h-10 flex-1 rounded-lg" />
        <ShimmerBar className="h-10 w-32 rounded-lg" />
        <ShimmerBar className="h-10 w-32 rounded-lg" />
      </div>
      {/* Table rows skeleton */}
      <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
