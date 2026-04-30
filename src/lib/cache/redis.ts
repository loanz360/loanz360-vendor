/**
 * Redis Caching Layer
 *
 * Enterprise-grade caching system with Redis
 * Features:
 * - Connection pooling
 * - Automatic serialization
 * - TTL management
 * - Cache invalidation patterns
 * - Fallback to in-memory cache
 */

import { createClient, RedisClientType } from 'redis'

// Cache configuration
interface CacheConfig {
  url?: string
  prefix?: string
  defaultTTL?: number
  maxRetries?: number
  connectTimeout?: number
}

// Cache entry interface
interface CacheEntry<T> {
  data: T
  createdAt: number
  expiresAt: number
}

// In-memory fallback cache
const memoryCache = new Map<string, CacheEntry<unknown>>()

// Redis client singleton
let redisClient: RedisClientType | null = null
let isRedisAvailable = false

// Default configuration
const defaultConfig: CacheConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  prefix: 'crm:',
  defaultTTL: 300, // 5 minutes
  maxRetries: 3,
  connectTimeout: 5000,
}

/**
 * Initialize Redis connection
 */
export async function initializeRedis(config: CacheConfig = {}): Promise<boolean> {
  const finalConfig = { ...defaultConfig, ...config }

  try {
    redisClient = createClient({
      url: finalConfig.url,
      socket: {
        connectTimeout: finalConfig.connectTimeout,
        reconnectStrategy: (retries) => {
          if (retries >= (finalConfig.maxRetries || 3)) {
            console.warn('Redis: Max retries reached, using memory cache fallback')
            return false
          }
          return Math.min(retries * 100, 3000)
        },
      },
    })

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err)
      isRedisAvailable = false
    })

    redisClient.on('connect', () => {
      isRedisAvailable = true
    })

    redisClient.on('disconnect', () => {
      isRedisAvailable = false
    })

    await redisClient.connect()
    isRedisAvailable = true
    return true
  } catch (error) {
    console.warn('Redis: Failed to connect, using memory cache fallback', error)
    isRedisAvailable = false
    return false
  }
}

/**
 * Get prefixed key
 */
function getKey(key: string): string {
  return `${defaultConfig.prefix}${key}`
}

/**
 * Set cache value
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = defaultConfig.defaultTTL || 300
): Promise<void> {
  const prefixedKey = getKey(key)
  const now = Date.now()
  const entry: CacheEntry<T> = {
    data: value,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  }

  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.setEx(
        prefixedKey,
        ttlSeconds,
        JSON.stringify(entry)
      )
      return
    } catch (error) {
      console.error('Redis SET error:', error)
    }
  }

  // Fallback to memory cache
  memoryCache.set(prefixedKey, entry)

  // Clean up expired entries periodically
  if (memoryCache.size > 1000) {
    cleanupMemoryCache()
  }
}

/**
 * Get cache value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const prefixedKey = getKey(key)

  if (isRedisAvailable && redisClient) {
    try {
      const value = await redisClient.get(prefixedKey)
      if (value) {
        const entry: CacheEntry<T> = JSON.parse(value)
        return entry.data
      }
      return null
    } catch (error) {
      console.error('Redis GET error:', error)
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(prefixedKey) as CacheEntry<T> | undefined
  if (entry) {
    if (entry.expiresAt > Date.now()) {
      return entry.data
    }
    memoryCache.delete(prefixedKey)
  }

  return null
}

/**
 * Delete cache value
 */
export async function cacheDelete(key: string): Promise<void> {
  const prefixedKey = getKey(key)

  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(prefixedKey)
    } catch (error) {
      console.error('Redis DEL error:', error)
    }
  }

  memoryCache.delete(prefixedKey)
}

/**
 * Delete cache values by pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const prefixedPattern = getKey(pattern)
  let deleted = 0

  if (isRedisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(prefixedPattern)
      if (keys.length > 0) {
        deleted = await redisClient.del(keys)
      }
    } catch (error) {
      console.error('Redis DEL pattern error:', error)
    }
  }

  // Also clean memory cache
  const regex = new RegExp(prefixedPattern.replace('*', '.*'))
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key)
      deleted++
    }
  }

  return deleted
}

/**
 * Check if key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  const prefixedKey = getKey(key)

  if (isRedisAvailable && redisClient) {
    try {
      return (await redisClient.exists(prefixedKey)) === 1
    } catch (error) {
      console.error('Redis EXISTS error:', error)
    }
  }

  const entry = memoryCache.get(prefixedKey)
  if (entry) {
    return (entry as CacheEntry<unknown>).expiresAt > Date.now()
  }

  return false
}

/**
 * Get or set cache value with callback
 */
export async function cacheGetOrSet<T>(
  key: string,
  callback: () => Promise<T>,
  ttlSeconds: number = defaultConfig.defaultTTL || 300
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) {
    return cached
  }

  const value = await callback()
  await cacheSet(key, value, ttlSeconds)
  return value
}

/**
 * Increment counter
 */
export async function cacheIncrement(
  key: string,
  amount: number = 1
): Promise<number> {
  const prefixedKey = getKey(key)

  if (isRedisAvailable && redisClient) {
    try {
      return await redisClient.incrBy(prefixedKey, amount)
    } catch (error) {
      console.error('Redis INCR error:', error)
    }
  }

  // Fallback to memory
  const entry = memoryCache.get(prefixedKey) as CacheEntry<number> | undefined
  const newValue = ((entry?.data as number) || 0) + amount
  await cacheSet(key, newValue)
  return newValue
}

/**
 * Clean up expired entries from memory cache
 */
function cleanupMemoryCache(): void {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if ((entry as CacheEntry<unknown>).expiresAt < now) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Clear all cache
 */
export async function cacheClear(): Promise<void> {
  if (isRedisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(`${defaultConfig.prefix}*`)
      if (keys.length > 0) {
        await redisClient.del(keys)
      }
    } catch (error) {
      console.error('Redis CLEAR error:', error)
    }
  }

  memoryCache.clear()
}

/**
 * Get cache statistics
 */
export async function cacheStats(): Promise<{
  isRedisAvailable: boolean
  memoryEntries: number
  redisKeys?: number
}> {
  const stats = {
    isRedisAvailable,
    memoryEntries: memoryCache.size,
    redisKeys: undefined as number | undefined,
  }

  if (isRedisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(`${defaultConfig.prefix}*`)
      stats.redisKeys = keys.length
    } catch {
      // Ignore
    }
  }

  return stats
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    isRedisAvailable = false
  }
}

// Cache key generators for common patterns
export const cacheKeys = {
  leads: (userId: string, page: number, filters?: string) =>
    `leads:${userId}:${page}:${filters || 'all'}`,

  lead: (leadId: string) => `lead:${leadId}`,

  contacts: (userId: string, page: number) =>
    `contacts:${userId}:${page}`,

  contact: (contactId: string) => `contact:${contactId}`,

  deals: (userId: string, page: number) =>
    `deals:${userId}:${page}`,

  deal: (dealId: string) => `deal:${dealId}`,

  stats: (userId: string, type: string) =>
    `stats:${userId}:${type}`,

  search: (userId: string, query: string) =>
    `search:${userId}:${Buffer.from(query).toString('base64')}`,

  user: (userId: string) => `user:${userId}`,
}

// Cache invalidation patterns
export const invalidationPatterns = {
  userLeads: (userId: string) => `leads:${userId}:*`,
  userContacts: (userId: string) => `contacts:${userId}:*`,
  userDeals: (userId: string) => `deals:${userId}:*`,
  userStats: (userId: string) => `stats:${userId}:*`,
  userSearch: (userId: string) => `search:${userId}:*`,
  allUser: (userId: string) => `*:${userId}:*`,
}

export default {
  initialize: initializeRedis,
  get: cacheGet,
  set: cacheSet,
  delete: cacheDelete,
  deletePattern: cacheDeletePattern,
  exists: cacheExists,
  getOrSet: cacheGetOrSet,
  increment: cacheIncrement,
  clear: cacheClear,
  stats: cacheStats,
  disconnect: disconnectRedis,
  keys: cacheKeys,
  invalidate: invalidationPatterns,
}
