'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

// ============================================================================
// ENTERPRISE PAGINATION COMPONENT
// Reusable pagination UI with multiple display modes
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount?: number
  limit?: number
  onPageChange: (page: number) => void
  onLimitChange?: (limit: number) => void
  showPageSize?: boolean
  showTotalCount?: boolean
  showQuickJumper?: boolean
  pageSizeOptions?: number[]
  maxVisiblePages?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'minimal' | 'simple'
  className?: string
  disabled?: boolean
}

export interface SimplePaginationProps {
  hasMore: boolean
  hasPrevious: boolean
  onNext: () => void
  onPrevious: () => void
  loading?: boolean
  className?: string
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = []
  const halfVisible = Math.floor((maxVisible - 3) / 2)

  // Always show first page
  pages.push(1)

  if (currentPage <= halfVisible + 2) {
    // Near start
    for (let i = 2; i <= Math.min(maxVisible - 2, totalPages - 1); i++) {
      pages.push(i)
    }
    if (totalPages > maxVisible - 1) pages.push('ellipsis')
  } else if (currentPage >= totalPages - halfVisible - 1) {
    // Near end
    pages.push('ellipsis')
    for (let i = Math.max(totalPages - maxVisible + 3, 2); i <= totalPages - 1; i++) {
      pages.push(i)
    }
  } else {
    // Middle
    pages.push('ellipsis')
    for (let i = currentPage - halfVisible; i <= currentPage + halfVisible; i++) {
      pages.push(i)
    }
    pages.push('ellipsis')
  }

  // Always show last page
  if (totalPages > 1) {
    pages.push(totalPages)
  }

  return pages
}

// ============================================================================
// PAGINATION COMPONENT
// ============================================================================

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  limit = 20,
  onPageChange,
  onLimitChange,
  showPageSize = false,
  showTotalCount = true,
  showQuickJumper = false,
  pageSizeOptions = [10, 20, 50, 100],
  maxVisiblePages = 7,
  size = 'md',
  variant = 'default',
  className = '',
  disabled = false
}: PaginationProps) {
  const pages = generatePageNumbers(currentPage, totalPages, maxVisiblePages)

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const buttonSizeClasses = {
    sm: 'h-7 w-7 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base'
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && !disabled) {
      onPageChange(page)
    }
  }

  if (totalPages <= 1 && variant === 'minimal') {
    return null
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 ${sizeClasses[size]} ${className}`}>
      {/* Left side - Total count */}
      {showTotalCount && totalCount !== undefined && (
        <div className="text-gray-400">
          Showing {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalCount)} of {totalCount.toLocaleString()}
        </div>
      )}

      {/* Center - Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        {variant === 'default' && (
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || disabled}
            className={`${buttonSizeClasses[size]} flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        )}

        {/* Previous page */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || disabled}
          className={`${buttonSizeClasses[size]} flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {variant !== 'simple' && (
          <div className="flex items-center gap-1">
            {pages.map((page, index) => (
              page === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-500">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  disabled={disabled}
                  className={`${buttonSizeClasses[size]} flex items-center justify-center rounded-lg transition-colors ${
                    page === currentPage
                      ? 'bg-orange-500 text-white'
                      : 'border border-white/10 hover:bg-white/5'
                  } disabled:cursor-not-allowed`}
                >
                  {page}
                </button>
              )
            ))}
          </div>
        )}

        {/* Simple variant: show current/total */}
        {variant === 'simple' && (
          <span className="px-3 text-gray-300">
            {currentPage} / {totalPages}
          </span>
        )}

        {/* Next page */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || disabled}
          className={`${buttonSizeClasses[size]} flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last page */}
        {variant === 'default' && (
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || disabled}
            className={`${buttonSizeClasses[size]} flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Right side - Page size selector and quick jumper */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {showPageSize && onLimitChange && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Show:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(parseInt(e.target.value))}
              disabled={disabled}
              className="bg-black/50 text-white px-3 py-1.5 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none disabled:opacity-50"
            >
              {pageSizeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick jumper */}
        {showQuickJumper && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              disabled={disabled}
              className="w-16 bg-black/50 text-white px-2 py-1.5 rounded-lg border border-white/10 focus:border-orange-500 focus:outline-none disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = parseInt((e.target as HTMLInputElement).value)
                  if (value >= 1 && value <= totalPages) {
                    handlePageChange(value)
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SIMPLE PAGINATION (for infinite scroll / load more)
// ============================================================================

export function SimplePagination({
  hasMore,
  hasPrevious,
  onNext,
  onPrevious,
  loading = false,
  className = ''
}: SimplePaginationProps) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <button
        onClick={onPrevious}
        disabled={!hasPrevious || loading}
        className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>
      <button
        onClick={onNext}
        disabled={!hasMore || loading}
        className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ============================================================================
// LOAD MORE BUTTON
// ============================================================================

interface LoadMoreProps {
  onClick: () => void
  loading?: boolean
  hasMore: boolean
  loadedCount?: number
  totalCount?: number
  className?: string
}

export function LoadMoreButton({
  onClick,
  loading = false,
  hasMore,
  loadedCount,
  totalCount,
  className = ''
}: LoadMoreProps) {
  if (!hasMore) {
    return loadedCount !== undefined && totalCount !== undefined ? (
      <div className={`text-center text-gray-400 text-sm py-4 ${className}`}>
        Showing all {totalCount.toLocaleString()} items
      </div>
    ) : null
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <button
        onClick={onClick}
        disabled={loading}
        className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-orange-500 rounded-full animate-spin" />
            Loading...
          </>
        ) : (
          'Load More'
        )}
      </button>
      {loadedCount !== undefined && totalCount !== undefined && (
        <span className="text-gray-400 text-sm">
          {loadedCount.toLocaleString()} of {totalCount.toLocaleString()} items
        </span>
      )}
    </div>
  )
}

// ============================================================================
// PAGINATION INFO
// ============================================================================

interface PaginationInfoProps {
  currentPage: number
  limit: number
  totalCount: number
  className?: string
}

export function PaginationInfo({
  currentPage,
  limit,
  totalCount,
  className = ''
}: PaginationInfoProps) {
  const start = ((currentPage - 1) * limit) + 1
  const end = Math.min(currentPage * limit, totalCount)

  return (
    <div className={`text-gray-400 text-sm ${className}`}>
      Showing <span className="text-white font-medium">{start.toLocaleString()}</span> to{' '}
      <span className="text-white font-medium">{end.toLocaleString()}</span> of{' '}
      <span className="text-white font-medium">{totalCount.toLocaleString()}</span> results
    </div>
  )
}

export default Pagination
