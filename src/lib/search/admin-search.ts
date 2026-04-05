/**
 * Advanced Admin Search Library
 *
 * Features:
 * - Multi-field search with AND/OR logic
 * - Date range filters
 * - Fuzzy search support
 * - Saved search templates
 * - Search history
 * - Query builder utilities
 */

import { z } from 'zod'

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * Search filter schema
 */
export const searchFilterSchema = z.object({
  // Text search
  query: z.string().optional(),
  searchFields: z.array(z.enum(['full_name', 'email', 'phone', 'admin_unique_id', 'department', 'designation'])).optional(),

  // Filters
  roles: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'all']).optional().default('all'),
  twoFactorEnabled: z.boolean().optional(),

  // Date ranges
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  lastLoginAfter: z.string().optional(),
  lastLoginBefore: z.string().optional(),

  // Advanced
  hasPhone: z.boolean().optional(),
  failedLoginAttempts: z.number().optional(),

  // Sorting
  sortBy: z.enum(['created_at', 'updated_at', 'last_login', 'full_name', 'email']).optional().default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),

  // Pagination
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
})

export type SearchFilter = z.infer<typeof searchFilterSchema>

/**
 * Saved search template
 */
export const savedSearchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Search name is required'),
  description: z.string().optional(),
  filters: searchFilterSchema,
  isDefault: z.boolean().optional().default(false),
  createdBy: z.string().uuid().optional(),
  createdAt: z.string().optional(),
})

export type SavedSearch = z.infer<typeof savedSearchSchema>

/**
 * Search result
 */
export interface SearchResult {
  admins: any[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

// ============================================================================
// QUERY BUILDER
// ============================================================================

/**
 * Build Supabase query from search filters
 */
export function buildSearchQuery(filters: SearchFilter, baseQuery: any) {
  let query = baseQuery

  // Text search across multiple fields
  if (filters.query && filters.query.trim()) {
    const searchTerm = filters.query.trim().toLowerCase()
    const searchFields = filters.searchFields || ['full_name', 'email', 'admin_unique_id']

    // Build OR conditions for text search
    const orConditions = searchFields.map(field => {
      if (field === 'full_name') {
        return `full_name.ilike.%${searchTerm}%`
      } else if (field === 'email') {
        return `email.ilike.%${searchTerm}%`
      } else if (field === 'phone') {
        return `phone.ilike.%${searchTerm}%`
      } else if (field === 'admin_unique_id') {
        return `admin_unique_id.ilike.%${searchTerm}%`
      } else if (field === 'department') {
        return `department.ilike.%${searchTerm}%`
      } else if (field === 'designation') {
        return `designation.ilike.%${searchTerm}%`
      }
      return null
    }).filter(Boolean)

    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','))
    }
  }

  // Role filter
  if (filters.roles && filters.roles.length > 0) {
    query = query.in('role', filters.roles)
  }

  // Department filter
  if (filters.departments && filters.departments.length > 0) {
    query = query.in('department', filters.departments)
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    query = query.eq('is_active', filters.status === 'active')
  }

  // 2FA filter
  if (filters.twoFactorEnabled !== undefined) {
    query = query.eq('two_factor_enabled', filters.twoFactorEnabled)
  }

  // Date range: Created after
  if (filters.createdAfter) {
    query = query.gte('created_at', filters.createdAfter)
  }

  // Date range: Created before
  if (filters.createdBefore) {
    query = query.lte('created_at', filters.createdBefore)
  }

  // Date range: Last login after
  if (filters.lastLoginAfter) {
    query = query.gte('last_login', filters.lastLoginAfter)
  }

  // Date range: Last login before
  if (filters.lastLoginBefore) {
    query = query.lte('last_login', filters.lastLoginBefore)
  }

  // Has phone filter
  if (filters.hasPhone !== undefined) {
    if (filters.hasPhone) {
      query = query.not('phone', 'is', null)
    } else {
      query = query.is('phone', null)
    }
  }

  // Failed login attempts
  if (filters.failedLoginAttempts !== undefined) {
    query = query.gte('failed_login_attempts', filters.failedLoginAttempts)
  }

  // Always exclude deleted records
  query = query.eq('is_deleted', false)

  // Sorting
  const sortBy = filters.sortBy || 'created_at'
  const sortOrder = filters.sortOrder || 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  return query
}

// ============================================================================
// PAGINATION
// ============================================================================

/**
 * Apply pagination to query
 */
export function applyPagination(query: any, page: number, limit: number) {
  const offset = (page - 1) * limit
  return query.range(offset, offset + limit - 1)
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit)
  const hasMore = page < totalPages

  return {
    total,
    page,
    limit,
    totalPages,
    hasMore,
  }
}

// ============================================================================
// SEARCH PRESETS
// ============================================================================

/**
 * Predefined search templates for common use cases
 */
export const searchPresets: Record<string, Partial<SearchFilter>> = {
  active_admins: {
    status: 'active',
    sortBy: 'last_login',
    sortOrder: 'desc',
  },
  inactive_admins: {
    status: 'inactive',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  recent_signups: {
    status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
    limit: 50,
  },
  two_factor_enabled: {
    twoFactorEnabled: true,
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  two_factor_disabled: {
    twoFactorEnabled: false,
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  super_admins: {
    roles: ['super_admin'],
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'asc',
  },
  failed_logins: {
    failedLoginAttempts: 3,
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  no_phone: {
    hasPhone: false,
    status: 'active',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
}

/**
 * Get preset by key
 */
export function getSearchPreset(presetKey: string): Partial<SearchFilter> | null {
  return searchPresets[presetKey] || null
}

// ============================================================================
// FILTER UTILITIES
// ============================================================================

/**
 * Merge filters with defaults
 */
export function mergeFilters(
  filters: Partial<SearchFilter>,
  defaults: Partial<SearchFilter> = {}
): SearchFilter {
  const merged = { ...defaults, ...filters }
  const validated = searchFilterSchema.safeParse(merged)

  if (validated.success) {
    return validated.data
  } else {
    // Return defaults if validation fails
    return searchFilterSchema.parse(defaults)
  }
}

/**
 * Check if filter is empty (no search criteria)
 */
export function isEmptyFilter(filters: SearchFilter): boolean {
  return (
    !filters.query &&
    (!filters.roles || filters.roles.length === 0) &&
    (!filters.departments || filters.departments.length === 0) &&
    filters.status === 'all' &&
    filters.twoFactorEnabled === undefined &&
    !filters.createdAfter &&
    !filters.createdBefore &&
    !filters.lastLoginAfter &&
    !filters.lastLoginBefore &&
    filters.hasPhone === undefined &&
    filters.failedLoginAttempts === undefined
  )
}

/**
 * Generate human-readable filter description
 */
export function describeFilter(filters: SearchFilter): string {
  const parts: string[] = []

  if (filters.query) {
    parts.push(`Search: "${filters.query}"`)
  }

  if (filters.roles && filters.roles.length > 0) {
    parts.push(`Roles: ${filters.roles.join(', ')}`)
  }

  if (filters.departments && filters.departments.length > 0) {
    parts.push(`Departments: ${filters.departments.join(', ')}`)
  }

  if (filters.status !== 'all') {
    parts.push(`Status: ${filters.status}`)
  }

  if (filters.twoFactorEnabled !== undefined) {
    parts.push(`2FA: ${filters.twoFactorEnabled ? 'Enabled' : 'Disabled'}`)
  }

  if (filters.createdAfter || filters.createdBefore) {
    const dateRange = []
    if (filters.createdAfter) dateRange.push(`after ${new Date(filters.createdAfter).toLocaleDateString()}`)
    if (filters.createdBefore) dateRange.push(`before ${new Date(filters.createdBefore).toLocaleDateString()}`)
    parts.push(`Created: ${dateRange.join(' and ')}`)
  }

  if (filters.hasPhone !== undefined) {
    parts.push(filters.hasPhone ? 'Has phone' : 'No phone')
  }

  if (filters.failedLoginAttempts !== undefined) {
    parts.push(`Failed logins ≥ ${filters.failedLoginAttempts}`)
  }

  return parts.length > 0 ? parts.join(' • ') : 'All admins'
}

// ============================================================================
// SEARCH HISTORY
// ============================================================================

const SEARCH_HISTORY_KEY = 'admin_search_history'
const MAX_HISTORY_ITEMS = 10

/**
 * Save search to local history
 */
export function saveToHistory(filters: SearchFilter): void {
  if (typeof window === 'undefined') return

  try {
    const history = getSearchHistory()

    // Don't save empty searches
    if (isEmptyFilter(filters)) return

    // Remove duplicates
    const filtered = history.filter(
      (item) => JSON.stringify(item) !== JSON.stringify(filters)
    )

    // Add to beginning
    filtered.unshift(filters)

    // Keep only recent items
    const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS)

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Failed to save search history:', error)
  }
}

/**
 * Get search history
 */
export function getSearchHistory(): SearchFilter[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to load search history:', error)
    return []
  }
}

/**
 * Clear search history
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch (error) {
    console.error('Failed to clear search history:', error)
  }
}

// ============================================================================
// EXPORT FILTERS
// ============================================================================

/**
 * Convert filters to URL query parameters
 */
export function filtersToQueryParams(filters: SearchFilter): URLSearchParams {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        params.set(key, value.join(','))
      } else {
        params.set(key, String(value))
      }
    }
  })

  return params
}

/**
 * Parse URL query parameters to filters
 */
export function queryParamsToFilters(params: URLSearchParams): Partial<SearchFilter> {
  const filters: Partial<SearchFilter> = {}

  // Parse each parameter
  const query = params.get('query')
  if (query) filters.query = query

  const roles = params.get('roles')
  if (roles) filters.roles = roles.split(',')

  const departments = params.get('departments')
  if (departments) filters.departments = departments.split(',')

  const status = params.get('status')
  if (status === 'active' || status === 'inactive' || status === 'all') {
    filters.status = status
  }

  const twoFactorEnabled = params.get('twoFactorEnabled')
  if (twoFactorEnabled !== null) {
    filters.twoFactorEnabled = twoFactorEnabled === 'true'
  }

  const createdAfter = params.get('createdAfter')
  if (createdAfter) filters.createdAfter = createdAfter

  const createdBefore = params.get('createdBefore')
  if (createdBefore) filters.createdBefore = createdBefore

  const sortBy = params.get('sortBy')
  if (sortBy) filters.sortBy = sortBy as any

  const sortOrder = params.get('sortOrder')
  if (sortOrder === 'asc' || sortOrder === 'desc') {
    filters.sortOrder = sortOrder
  }

  const page = params.get('page')
  if (page) filters.page = parseInt(page, 10)

  const limit = params.get('limit')
  if (limit) filters.limit = parseInt(limit, 10)

  return filters
}
