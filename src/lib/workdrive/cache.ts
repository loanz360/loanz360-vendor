/**
 * WorkDrive Caching Layer
 * In-memory and edge caching for improved performance
 */

// Simple in-memory cache with TTL
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private defaultTTL: number = 300000) { // 5 minutes default
    // Cleanup expired entries every minute
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
    }
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { value, expiresAt })
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  has(key: string): boolean {
    const value = this.get(key)
    return value !== undefined
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Invalidate all keys matching a pattern
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'))
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cache.clear()
  }
}

// Cache instances for different data types
export const fileMetadataCache = new MemoryCache<any>(60000) // 1 minute
export const quotaCache = new MemoryCache<any>(30000) // 30 seconds
export const userProfileCache = new MemoryCache<any>(300000) // 5 minutes
export const searchCache = new MemoryCache<any>(60000) // 1 minute
export const thumbnailUrlCache = new MemoryCache<string>(3600000) // 1 hour

// Cache key generators
export const cacheKeys = {
  file: (fileId: string) => `file:${fileId}`,
  fileList: (workspaceId: string, folderId?: string) =>
    `files:${workspaceId}:${folderId || 'root'}`,
  quota: (userId: string) => `quota:${userId}`,
  userProfile: (userId: string) => `profile:${userId}`,
  search: (query: string, filters: string) => `search:${query}:${filters}`,
  thumbnail: (fileId: string) => `thumb:${fileId}`,
  storageStats: () => 'storage:stats',
  departmentStats: () => 'dept:stats',
}

// Helper to generate ETag for HTTP caching
export function generateETag(data: any): string {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`
}

// Cache headers for HTTP responses
export function getCacheHeaders(options: {
  maxAge?: number
  staleWhileRevalidate?: number
  private?: boolean
  mustRevalidate?: boolean
  etag?: string
}): Record<string, string> {
  const {
    maxAge = 60,
    staleWhileRevalidate = 300,
    private: isPrivate = true,
    mustRevalidate = false,
    etag,
  } = options

  const directives: string[] = []

  if (isPrivate) {
    directives.push('private')
  } else {
    directives.push('public')
  }

  directives.push(`max-age=${maxAge}`)

  if (staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
  }

  if (mustRevalidate) {
    directives.push('must-revalidate')
  }

  const headers: Record<string, string> = {
    'Cache-Control': directives.join(', '),
  }

  if (etag) {
    headers['ETag'] = etag
  }

  return headers
}

// CDN configuration for S3 URLs
export interface CDNConfig {
  enabled: boolean
  baseUrl: string
  ttl: number
}

// Get CDN URL for a file
export function getCDNUrl(s3Url: string, config?: CDNConfig): string {
  if (!config?.enabled || !config.baseUrl) {
    return s3Url
  }

  // Extract the S3 key from the URL
  try {
    const url = new URL(s3Url)
    const pathParts = url.pathname.split('/')
    const key = pathParts.slice(1).join('/')

    // Return CDN URL
    return `${config.baseUrl}/${key}`
  } catch {
    // Intentionally empty: invalid URL falls back to original s3Url
    return s3Url
  }
}

// Preload critical resources
export async function preloadResources(resources: {
  type: 'file' | 'thumbnail' | 'metadata'
  id: string
}[]): Promise<void> {
  // This would be implemented to preload resources in the background
  // For now, it's a placeholder for future implementation
  console.log('Preloading resources:', resources.length)
}

// Cache statistics
export function getCacheStats(): {
  fileMetadata: { size: number }
  quota: { size: number }
  userProfile: { size: number }
  search: { size: number }
  thumbnail: { size: number }
} {
  return {
    fileMetadata: { size: 0 }, // Would need internal access to cache size
    quota: { size: 0 },
    userProfile: { size: 0 },
    search: { size: 0 },
    thumbnail: { size: 0 },
  }
}

// Invalidation helpers
export function invalidateFileCache(fileId: string): void {
  fileMetadataCache.delete(cacheKeys.file(fileId))
  thumbnailUrlCache.delete(cacheKeys.thumbnail(fileId))
}

export function invalidateUserCache(userId: string): void {
  quotaCache.delete(cacheKeys.quota(userId))
  userProfileCache.delete(cacheKeys.userProfile(userId))
}

export function invalidateSearchCache(): void {
  searchCache.clear()
}

export function invalidateStorageCache(): void {
  fileMetadataCache.delete(cacheKeys.storageStats())
  fileMetadataCache.delete(cacheKeys.departmentStats())
}

// Wrapper for cached fetch
export async function cachedFetch<T>(
  key: string,
  cache: MemoryCache<T>,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Check cache first
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  // Fetch and cache
  const result = await fetcher()
  cache.set(key, result, ttl)
  return result
}

export default {
  fileMetadataCache,
  quotaCache,
  userProfileCache,
  searchCache,
  thumbnailUrlCache,
  cacheKeys,
  generateETag,
  getCacheHeaders,
  getCDNUrl,
  preloadResources,
  getCacheStats,
  invalidateFileCache,
  invalidateUserCache,
  invalidateSearchCache,
  invalidateStorageCache,
  cachedFetch,
}
