// ============================================================================
// HR Module Shared Helpers
// Utility functions for all HR sub-role pages
// ============================================================================

import { NextResponse } from 'next/server'
import { HR_STATUS_COLORS, HR_STATUS_DOT_COLORS } from '@/lib/constants/hr'

/**
 * Get Tailwind CSS classes for a status badge
 */
export function getHRStatusColor(status: string): string {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') || 'default'
  return HR_STATUS_COLORS[normalized] || HR_STATUS_COLORS.default
}

/**
 * Get dot color for a status indicator
 */
export function getHRStatusDotColor(status: string): string {
  const normalized = status?.toLowerCase().replace(/\s+/g, '_') || 'default'
  return HR_STATUS_DOT_COLORS[normalized] || HR_STATUS_DOT_COLORS.default
}

/**
 * Safely extract a string error message from any error shape
 * Handles: string, Error, { error: string }, { message: string }, unknown
 */
export function safeErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    if ('error' in error && typeof (error as Record<string, unknown>).error === 'string') {
      return (error as Record<string, unknown>).error as string
    }
    if ('message' in error && typeof (error as Record<string, unknown>).message === 'string') {
      return (error as Record<string, unknown>).message as string
    }
  }
  return 'An unexpected error occurred'
}

/**
 * Build API URL with query parameters, skipping empty/null values
 */
export function buildApiUrl(base: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(base, window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.pathname + url.search
}

/**
 * Format a date string for display (Indian format)
 */
export function formatHRDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Format a date string with time
 */
export function formatHRDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/**
 * Calculate tenure in human-readable format
 */
export function calculateTenure(joiningDate: string, lastDate?: string): string {
  const start = new Date(joiningDate)
  const end = lastDate ? new Date(lastDate) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const years = Math.floor(diffDays / 365)
  const months = Math.floor((diffDays % 365) / 30)

  if (years > 0 && months > 0) return `${years}y ${months}m`
  if (years > 0) return `${years}y`
  if (months > 0) return `${months}m`
  return `${diffDays}d`
}

/**
 * Get initials from a name (2 chars max)
 */
export function getNameInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].substring(0, 2).toUpperCase()
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Capitalize first letter and replace underscores with spaces
 */
export function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

// ============================================================================
// Standardized API Response Helpers
// ============================================================================

/**
 * Return a success JSON response
 */
export function apiSuccess(data: any, meta?: Record<string, any>, status: number = 200) {
  return NextResponse.json({ success: true, data, ...meta ? { meta } : {} }, { status })
}

/**
 * Return an error JSON response
 */
export function apiError(error: string, status: number = 500, details?: any) {
  return NextResponse.json({ success: false, error, ...details ? { details } : {} }, { status })
}

/**
 * Return a 201 Created JSON response
 */
export function apiCreated(data: any, message: string = 'Created successfully') {
  return NextResponse.json({ success: true, data, message }, { status: 201 })
}

/**
 * Return a paginated JSON response
 */
export function apiPaginated(data: any[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  })
}
