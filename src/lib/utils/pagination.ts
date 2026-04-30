/**
 * Pagination Utilities
 * Provides safe pagination with configurable limits to prevent memory issues
 */

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  maxPage?: number
}

const DEFAULT_CONFIG: Required<PaginationConfig> = {
  defaultLimit: 20,
  maxLimit: 1000,
  maxPage: 10000,
}

/**
 * Parse and validate pagination parameters from URL search params
 * Prevents memory exhaustion from unlimited pagination
 *
 * @param searchParams - URL search params or query object
 * @param config - Optional configuration overrides
 * @returns Safe pagination parameters
 *
 * @example
 * const { page, limit, offset } = parsePaginationParams(request.nextUrl.searchParams)
 */
export function parsePaginationParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  config: PaginationConfig = {}
): PaginationParams {
  const {
    defaultLimit,
    maxLimit,
    maxPage,
  } = { ...DEFAULT_CONFIG, ...config }

  // Parse page number
  let page = parseInt(searchParams.get('page') || '1', 10)
  if (isNaN(page) || page < 1) {
    page = 1
  }
  if (page > maxPage) {
    page = maxPage
  }

  // Parse limit
  let limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10)
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit
  }
  if (limit > maxLimit) {
    limit = maxLimit
  }

  // Calculate offset
  const offset = (page - 1) * limit

  return { page, limit, offset }
}

/**
 * Validate pagination parameters and throw error if invalid
 * Use this when you want to return 400 error for invalid params
 *
 * @param page - Page number
 * @param limit - Items per page
 * @param config - Optional configuration
 * @throws Error if parameters are invalid
 */
export function validatePaginationParams(
  page: number,
  limit: number,
  config: PaginationConfig = {}
): void {
  const { maxLimit, maxPage } = { ...DEFAULT_CONFIG, ...config }

  if (limit > maxLimit) {
    throw new Error(
      `Limit cannot exceed ${maxLimit}. Requested: ${limit}. ` +
      `For large datasets, use cursor-based pagination or export functionality.`
    )
  }

  if (page > maxPage) {
    throw new Error(
      `Page number cannot exceed ${maxPage}. Requested: ${page}. ` +
      `Use filters or search to narrow down results.`
    )
  }

  if (page < 1) {
    throw new Error('Page number must be at least 1')
  }

  if (limit < 1) {
    throw new Error('Limit must be at least 1')
  }
}

/**
 * Calculate pagination metadata for API responses
 *
 * @param page - Current page number
 * @param limit - Items per page
 * @param totalCount - Total number of items
 * @returns Pagination metadata
 */
export function calculatePaginationMeta(
  page: number,
  limit: number,
  totalCount: number
) {
  const totalPages = Math.ceil(totalCount / limit)
  const hasNextPage = page < totalPages
  const hasPreviousPage = page > 1

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    nextPage: hasNextPage ? page + 1 : null,
    previousPage: hasPreviousPage ? page - 1 : null,
  }
}

/**
 * Generate Supabase range parameters from pagination
 *
 * @param page - Page number
 * @param limit - Items per page
 * @returns Range parameters [from, to] for Supabase .range()
 *
 * @example
 * const [from, to] = getSupabaseRange(2, 20) // [20, 39]
 * const { data } = await supabase.from('table').select().range(from, to)
 */
export function getSupabaseRange(page: number, limit: number): [number, number] {
  const offset = (page - 1) * limit
  return [offset, offset + limit - 1]
}

/**
 * Create complete paginated API response
 *
 * @param data - Array of items for current page
 * @param page - Current page number
 * @param limit - Items per page
 * @param totalCount - Total number of items
 * @returns Standardized paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  totalCount: number
) {
  return {
    success: true,
    data,
    pagination: calculatePaginationMeta(page, limit, totalCount),
  }
}

/**
 * Cursor-based pagination utilities
 * Use for infinite scroll or when offset pagination is too slow
 */

export interface CursorPaginationParams {
  limit: number
  cursor?: string
}

/**
 * Encode cursor from record ID and timestamp
 */
export function encodeCursor(id: string, timestamp: string | Date): string {
  const ts = timestamp instanceof Date ? timestamp.toISOString() : timestamp
  const data = JSON.stringify({ id, timestamp: ts })
  return Buffer.from(data).toString('base64url')
}

/**
 * Decode cursor to extract ID and timestamp
 */
export function decodeCursor(cursor: string): { id: string; timestamp: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
    const data = JSON.parse(decoded)
    if (!data.id || !data.timestamp) return null
    return data
  } catch {
    return null
  }
}

/**
 * Parse cursor pagination parameters
 */
export function parseCursorPaginationParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  config: PaginationConfig = {}
): CursorPaginationParams {
  const { defaultLimit, maxLimit } = { ...DEFAULT_CONFIG, ...config }

  let limit = parseInt(searchParams.get('limit') || String(defaultLimit), 10)
  if (isNaN(limit) || limit < 1) limit = defaultLimit
  if (limit > maxLimit) limit = maxLimit

  const cursor = searchParams.get('cursor') || undefined

  return { limit, cursor }
}

/**
 * Create cursor pagination metadata
 */
export function createCursorPaginationMeta<T extends { id: string; [key: string]: unknown }>(
  data: T[],
  limit: number,
  timestampField: string = 'created_at'
) {
  const hasMore = data.length === limit
  const nextCursor = hasMore && data.length > 0
    ? encodeCursor(data[data.length - 1].id, data[data.length - 1][timestampField])
    : null

  return {
    limit,
    hasMore,
    nextCursor,
    count: data.length,
  }
}

/**
 * Create cursor-based paginated response
 */
export function createCursorPaginatedResponse<T extends { id: string; [key: string]: unknown }>(
  data: T[],
  limit: number,
  timestampField: string = 'created_at'
) {
  return {
    success: true,
    data,
    pagination: createCursorPaginationMeta(data, limit, timestampField),
  }
}
