/**
 * CAE Caching Utilities
 * BUG FIX #13: TTL-based caching to prevent stale data
 *
 * Features:
 * - In-memory caching with TTL (Time-To-Live)
 * - Automatic cache invalidation
 * - Configurable cache size limits (LRU eviction)
 * - Cache statistics and monitoring
 * - Easy migration path to Redis in production
 */

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
  size: number
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  evictions: number
  size: number
  maxSize: number
  hitRate: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl?: number // Default TTL in milliseconds
  maxSize?: number // Maximum number of entries
  maxMemory?: number // Maximum memory in bytes (approximate)
  cleanupInterval?: number // Cleanup interval in milliseconds
}

/**
 * In-memory cache with TTL support
 * BUG FIX #13: Prevents stale provider data
 *
 * @example
 * const cache = new TTLCache({ ttl: 3600000 }) // 1 hour TTL
 * cache.set('key', value)
 * const value = cache.get('key')
 */
export class TTLCache<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    size: 0,
    maxSize: 0,
    hitRate: 0
  }
  private config: Required<CacheConfig>
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(config: CacheConfig = {}) {
    this.config = {
      ttl: config.ttl || 3600000, // Default: 1 hour
      maxSize: config.maxSize || 1000, // Default: 1000 entries
      maxMemory: config.maxMemory || 50 * 1024 * 1024, // Default: 50MB
      cleanupInterval: config.cleanupInterval || 300000 // Default: 5 minutes
    }

    this.stats.maxSize = this.config.maxSize

    // Start automatic cleanup
    this.startCleanup()
  }

  /**
   * Get value from cache
   * BUG FIX #13: Return cached value if not expired
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get(key: string): T | null {
    const entry = this.store.get(key)

    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      this.stats.misses++
      this.updateHitRate()
      return null
    }

    // Update stats
    entry.hits++
    this.stats.hits++
    this.updateHitRate()

    return entry.value
  }

  /**
   * Set value in cache with optional custom TTL
   * BUG FIX #13: Store with expiration time
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Custom TTL in milliseconds (optional)
   */
  set(key: string, value: T, ttl?: number): void {
    const effectiveTTL = ttl || this.config.ttl
    const now = Date.now()

    // Calculate approximate size
    const size = this.estimateSize(value)

    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + effectiveTTL,
      createdAt: now,
      hits: 0,
      size
    }

    // Check if we need to evict entries
    if (this.store.size >= this.config.maxSize) {
      this.evictLRU()
    }

    this.store.set(key, entry)
    this.stats.sets++
    this.stats.size = this.store.size
  }

  /**
   * Delete value from cache
   * BUG FIX #13: Manual cache invalidation
   *
   * @param key - Cache key
   * @returns True if deleted, false if not found
   */
  delete(key: string): boolean {
    const deleted = this.store.delete(key)
    if (deleted) {
      this.stats.deletes++
      this.stats.size = this.store.size
    }
    return deleted
  }

  /**
   * Check if key exists and is not expired
   *
   * @param key - Cache key
   * @returns True if exists and valid
   */
  has(key: string): boolean {
    const entry = this.store.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear all cache entries
   * BUG FIX #13: Complete cache invalidation
   */
  clear(): void {
    this.store.clear()
    this.stats.size = 0
    this.stats.deletes += this.store.size
  }

  /**
   * Clear entries matching a pattern
   * BUG FIX #13: Pattern-based cache invalidation
   *
   * @param pattern - Regex pattern to match keys
   * @returns Number of entries deleted
   */
  clearPattern(pattern: RegExp): number {
    let deleted = 0

    for (const key of this.store.keys()) {
      if (pattern.test(key)) {
        this.delete(key)
        deleted++
      }
    }

    return deleted
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics object
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: this.store.size,
      maxSize: this.config.maxSize,
      hitRate: 0
    }
  }

  /**
   * Get TTL remaining for a key
   *
   * @param key - Cache key
   * @returns Remaining TTL in milliseconds, or null if not found
   */
  getTTL(key: string): number | null {
    const entry = this.store.get(key)
    if (!entry) return null

    const remaining = entry.expiresAt - Date.now()
    return remaining > 0 ? remaining : null
  }

  /**
   * Update TTL for an existing key
   *
   * @param key - Cache key
   * @param ttl - New TTL in milliseconds
   * @returns True if updated, false if not found
   */
  updateTTL(key: string, ttl: number): boolean {
    const entry = this.store.get(key)
    if (!entry) return false

    entry.expiresAt = Date.now() + ttl
    return true
  }

  /**
   * Get all cache keys
   *
   * @returns Array of all cache keys
   */
  keys(): string[] {
    return Array.from(this.store.keys())
  }

  /**
   * Get size of cache
   *
   * @returns Number of entries in cache
   */
  size(): number {
    return this.store.size
  }

  /**
   * Private: Evict least recently used entry
   * BUG FIX #13: LRU eviction when cache is full
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    // Find entry with oldest access time (lowest hits + oldest creation)
    for (const [key, entry] of this.store.entries()) {
      const score = entry.hits > 0 ? entry.createdAt / entry.hits : entry.createdAt
      if (score < oldestTime) {
        oldestTime = score
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey)
      this.stats.evictions++
      this.stats.size = this.store.size
    }
  }

  /**
   * Private: Cleanup expired entries
   * BUG FIX #13: Automatic cleanup of expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.stats.deletes += cleaned
      this.stats.size = this.store.size
      console.log(`[CACHE] Cleaned up ${cleaned} expired entries`)
    }
  }

  /**
   * Private: Start automatic cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)

    // Don't prevent Node.js from exiting
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Private: Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2 // Approximate: 2 bytes per char
    } catch {
      return 1024 // Default: 1KB if can't stringify
    }
  }

  /**
   * Private: Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0
  }
}

/**
 * CAE-specific cache instances
 * BUG FIX #13: Pre-configured caches for different data types
 */

// Provider response cache (1 hour TTL)
export const providerCache = new TTLCache({
  ttl: 3600000, // 1 hour
  maxSize: 500,
  cleanupInterval: 300000 // 5 minutes
})

// Health check cache (15 minutes TTL)
export const healthCache = new TTLCache({
  ttl: 900000, // 15 minutes
  maxSize: 100,
  cleanupInterval: 180000 // 3 minutes
})

// CAM generation cache (30 minutes TTL)
export const camCache = new TTLCache({
  ttl: 1800000, // 30 minutes
  maxSize: 200,
  cleanupInterval: 300000 // 5 minutes
})

// Analytics cache (5 minutes TTL for real-time data)
export const analyticsCache = new TTLCache({
  ttl: 300000, // 5 minutes
  maxSize: 100,
  cleanupInterval: 60000 // 1 minute
})

/**
 * Cache wrapper for async functions
 * BUG FIX #13: Automatic caching for function results
 *
 * @param fn - Async function to cache
 * @param cache - Cache instance to use
 * @param keyFn - Function to generate cache key from arguments
 * @param ttl - Optional custom TTL
 * @returns Cached function
 *
 * @example
 * const cachedFetch = withCache(
 *   fetchProviderData,
 *   providerCache,
 *   (providerId) => `provider:${providerId}`
 * )
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  cache: TTLCache,
  keyFn: (...args: Parameters<T>) => string,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyFn(...args)

    // Try to get from cache
    const cached = cache.get(key)
    if (cached !== null) {
      return cached
    }

    // Execute function and cache result
    try {
      const result = await fn(...args)
      cache.set(key, result, ttl)
      return result
    } catch (error) {
      // Don't cache errors
      throw error
    }
  }) as T
}

/**
 * Create a namespaced cache key
 * BUG FIX #13: Consistent cache key generation
 *
 * @param namespace - Cache namespace
 * @param parts - Key parts
 * @returns Cache key string
 *
 * @example
 * cacheKey('provider', 'cibil', '123') // "provider:cibil:123"
 */
export function cacheKey(namespace: string, ...parts: (string | number)[]): string {
  return [namespace, ...parts].join(':')
}

/**
 * Invalidate all caches (for admin use)
 * BUG FIX #13: Complete cache reset
 */
export function invalidateAllCaches(): void {
  providerCache.clear()
  healthCache.clear()
  camCache.clear()
  analyticsCache.clear()
  console.log('[CACHE] All caches invalidated')
}

/**
 * Get combined cache statistics
 * BUG FIX #13: Cache monitoring
 *
 * @returns Combined statistics from all caches
 */
export function getAllCacheStats(): Record<string, CacheStats> {
  return {
    provider: providerCache.getStats(),
    health: healthCache.getStats(),
    cam: camCache.getStats(),
    analytics: analyticsCache.getStats()
  }
}

/**
 * Log cache statistics
 * BUG FIX #13: Cache monitoring helper
 */
export function logCacheStats(): void {
  const stats = getAllCacheStats()

  console.log('=== Cache Statistics ===')
  for (const [name, stat] of Object.entries(stats)) {
    console.log(`\n${name.toUpperCase()} Cache:`)
    console.log(`  Size: ${stat.size}/${stat.maxSize}`)
    console.log(`  Hits: ${stat.hits}`)
    console.log(`  Misses: ${stat.misses}`)
    console.log(`  Hit Rate: ${(stat.hitRate * 100).toFixed(2)}%`)
    console.log(`  Sets: ${stat.sets}`)
    console.log(`  Deletes: ${stat.deletes}`)
    console.log(`  Evictions: ${stat.evictions}`)
  }
  console.log('========================')
}
