'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Loader2, Inbox, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────

export interface DataTableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  width?: string
  className?: string
  headerClassName?: string
  render?: (value: unknown, row: T, index: number) => React.ReactNode
}

export interface DataTablePagination {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  pagination?: DataTablePagination
  onPageChange?: (page: number) => void
  onPerPageChange?: (perPage: number) => void
  onSort?: (key: string, direction: 'asc' | 'desc') => void
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  isLoading?: boolean
  emptyMessage?: string
  emptyDescription?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  selectedRows?: string[]
  onRowSelect?: (id: string) => void
  onSelectAll?: (selected: boolean) => void
  bulkActions?: React.ReactNode
  headerActions?: React.ReactNode
  className?: string
  stickyHeader?: boolean
  perPageOptions?: number[]
}

// ─── Component ────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  pagination,
  onPageChange,
  onPerPageChange,
  onSort,
  sortKey,
  sortDirection,
  isLoading = false,
  emptyMessage = 'No data found',
  emptyDescription = 'Try adjusting your search or filter criteria.',
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  selectedRows = [],
  onRowSelect,
  onSelectAll,
  bulkActions,
  headerActions,
  className,
  stickyHeader = false,
  perPageOptions = [10, 20, 50, 100],
}: DataTableProps<T>) {
  const hasSelection = !!onRowSelect
  const allSelected = data.length > 0 && selectedRows.length === data.length
  const someSelected = selectedRows.length > 0 && selectedRows.length < data.length

  const handleSort = useCallback((key: string) => {
    if (!onSort) return
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(key, newDirection)
  }, [onSort, sortKey, sortDirection])

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-orange-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-orange-400" />
  }

  return (
    <div className={cn('bg-[#1a1a1a] rounded-xl border border-gray-800/50 overflow-hidden', className)}>
      {/* Header bar with search and actions */}
      {(onSearchChange || headerActions || (selectedRows.length > 0 && bulkActions)) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-gray-800/50">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {onSearchChange && (
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className={cn(
                    'w-full pl-9 pr-3 py-2 rounded-lg text-sm',
                    'bg-gray-800/50 border border-gray-700/50',
                    'text-white placeholder-gray-500',
                    'focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50',
                    'transition-all'
                  )}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            {selectedRows.length > 0 && bulkActions && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-orange-400 font-medium whitespace-nowrap">
                  {selectedRows.length} selected
                </span>
                {bulkActions}
              </div>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead className={cn(
            'bg-gray-800/50',
            stickyHeader && 'sticky top-0 z-10'
          )}>
            <tr>
              {hasSelection && (
                <th className="px-4 py-3 w-12" scope="col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 bg-gray-700"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-gray-200 transition-colors',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={sortKey === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {hasSelection && (
                    <td className="px-4 py-4">
                      <div className="w-4 h-4 bg-gray-800 rounded animate-pulse" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <div className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={columns.length + (hasSelection ? 1 : 0)} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Inbox className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400 font-medium mb-1">{emptyMessage}</p>
                    <p className="text-gray-500 text-sm">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data rows
              data.map((row, rowIndex) => {
                const rowKey = keyExtractor(row)
                const isSelected = selectedRows.includes(rowKey)

                return (
                  <tr
                    key={rowKey}
                    className={cn(
                      'transition-colors',
                      isSelected ? 'bg-orange-900/10' : 'hover:bg-gray-800/30'
                    )}
                  >
                    {hasSelection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onRowSelect?.(rowKey)}
                          className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 bg-gray-700"
                          aria-label={`Select row ${rowIndex + 1}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3 text-sm text-gray-300', col.className)}>
                        {col.render
                          ? col.render(row[col.key], row, rowIndex)
                          : String(row[col.key] ?? '-')
                        }
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-800/50 bg-gray-900/30">
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>
              Showing {Math.min((pagination.page - 1) * pagination.perPage + 1, pagination.total)} to{' '}
              {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total}
            </span>
            {onPerPageChange && (
              <select
                value={pagination.perPage}
                onChange={(e) => onPerPageChange(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                aria-label="Rows per page"
              >
                {perPageOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt} / page</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-sm text-gray-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange?.(pagination.totalPages)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DataTable
