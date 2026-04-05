/**
 * Simple In-Memory Cache
 *
 * Provides fast caching for frequently accessed data like banners.
 * Cache is cleared on server restart, which is acceptable for banner data.
 */

interface CacheEntry<T> {
  data: T
  expires: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>>
  private defaultTTL: number

  constructor(defaultTTL: number = 300000) { // 5 minutes default
    this.cache = new Map()
    this.defaultTTL = defaultTTL
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached value with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expires = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { data, expires })
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries (called periodically)
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    }
  }
}

// Create singleton instance
export const memoryCache = new MemoryCache()

// Clear expired entries every 5 minutes
setInterval(() => {
  memoryCache.clearExpired()
}, 300000)
