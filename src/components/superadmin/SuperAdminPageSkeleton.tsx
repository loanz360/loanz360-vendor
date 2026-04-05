'use client'

/**
 * E16: Reusable skeleton loading states for SuperAdmin pages
 * Provides consistent loading UX across all modules
 */

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
}

/** Skeleton for stat cards (dashboard, analytics) */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <Pulse className="h-4 w-24 mb-3" />
          <Pulse className="h-8 w-16 mb-2" />
          <Pulse className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for data tables */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-800 p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Pulse key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="border-b border-gray-800/50 p-4 flex gap-4">
          {Array.from({ length: cols }).map((_, col) => (
            <Pulse key={col} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Skeleton for card grid pages (SubMenuPage style) */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Pulse className="h-8 w-48" />
        <Pulse className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Pulse className="h-10 w-10 rounded-lg" />
              <Pulse className="h-5 w-32" />
            </div>
            <Pulse className="h-3 w-full mb-2" />
            <Pulse className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for form pages */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
      <Pulse className="h-6 w-40 mb-6" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Pulse className="h-4 w-24" />
          <Pulse className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Pulse className="h-10 w-24 rounded-lg" />
        <Pulse className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/** Skeleton for chart/analytics pages */
export function ChartSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <Pulse className="h-5 w-32" />
        <Pulse className="h-8 w-24 rounded-lg" />
      </div>
      <Pulse className="h-64 w-full rounded-lg" />
    </div>
  )
}

/** Combined skeleton for dashboard pages (stats + chart + table) */
export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Pulse className="h-8 w-64" />
        <div className="flex gap-3">
          <Pulse className="h-10 w-32 rounded-lg" />
          <Pulse className="h-10 w-32 rounded-lg" />
        </div>
      </div>
      <StatCardsSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  )
}
