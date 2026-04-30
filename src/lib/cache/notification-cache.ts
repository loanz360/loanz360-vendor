/**
 * Notification System - Redis Caching Layer
 *
 * Implements intelligent caching for notification queries to reduce database load
 * Uses Redis for distributed caching across multiple server instances
 *
 * Features:
 * - User notification count caching
 * - Template caching with auto-invalidation
 * - Analytics caching for dashboard queries
 * - Hot notification caching (trending, recent)
 * - Automatic cache invalidation on updates
 */

import { createClient as createRedisClient } from 'redis'

// =====================================================
// Redis Client Setup
// =====================================================

let redisClient: ReturnType<typeof createRedisClient> | null = null

export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  // Initialize Redis client
  redisClient = createRedisClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 10000,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis] Max reconnection attempts reached')
          return new Error('Max reconnection attempts reached')
        }
        return Math.min(retries * 100, 3000)
      }
    }
  })

  redisClient.on('error', (err) => {
    console.error('[Redis] Client Error:', err)
  })

  redisClient.on('connect', () => {
  })

  redisClient.on('reconnecting', () => {
  })

  await redisClient.connect()
  return redisClient
}

// =====================================================
// Cache Key Generators
// =====================================================

const CACHE_PREFIXES = {
  USER_UNREAD_COUNT: 'notif:user:unread',
  USER_NOTIFICATIONS: 'notif:user:list',
  NOTIFICATION_DETAIL: 'notif:detail',
  TEMPLATE_LIST: 'notif:templates',
  TEMPLATE_DETAIL: 'notif:template',
  ANALYTICS_STATS: 'notif:analytics:stats',
  ANALYTICS_TRENDING: 'notif:analytics:trending',
  RATE_LIMIT: 'notif:ratelimit'
}

const CACHE_TTL = {
  USER_UNREAD_COUNT: 60, // 1 minute
  USER_NOTIFICATIONS: 300, // 5 minutes
  NOTIFICATION_DETAIL: 600, // 10 minutes
  TEMPLATE_LIST: 1800, // 30 minutes
  TEMPLATE_DETAIL: 1800, // 30 minutes
  ANALYTICS_STATS: 1800, // 30 minutes
  ANALYTICS_TRENDING: 600, // 10 minutes
  RATE_LIMIT: 3600 // 1 hour (will be reset by rate limit logic)
}

function getCacheKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`
}

// =====================================================
// User Notification Caching
// =====================================================

/**
 * Get user's unread notification count from cache or database
 */
export async function getCachedUnreadCount(userId: string): Promise<number | null> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.USER_UNREAD_COUNT, userId)
    const cached = await redis.get(key)

    if (cached !== null) {
      return parseInt(cached, 10)
    }

    return null
  } catch (error) {
    console.error('[Cache] Error getting unread count:', error)
    return null
  }
}

/**
 * Set user's unread notification count in cache
 */
export async function setCachedUnreadCount(
  userId: string,
  count: number
): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.USER_UNREAD_COUNT, userId)
    await redis.setEx(key, CACHE_TTL.USER_UNREAD_COUNT, count.toString())
  } catch (error) {
    console.error('[Cache] Error setting unread count:', error)
  }
}

/**
 * Invalidate user's notification cache
 */
export async function invalidateUserNotificationCache(userId: string): Promise<void> {
  try {
    const redis = await getRedisClient()

    const keys = [
      getCacheKey(CACHE_PREFIXES.USER_UNREAD_COUNT, userId),
      getCacheKey(CACHE_PREFIXES.USER_NOTIFICATIONS, userId, '*')
    ]

    // Delete all matching keys
    for (const pattern of keys) {
      if (pattern.includes('*')) {
        const matchingKeys = await redis.keys(pattern)
        if (matchingKeys.length > 0) {
          await redis.del(matchingKeys)
        }
      } else {
        await redis.del(pattern)
      }
    }
  } catch (error) {
    console.error('[Cache] Error invalidating user cache:', error)
  }
}

// =====================================================
// Notification Detail Caching
// =====================================================

/**
 * Get notification details from cache
 */
export async function getCachedNotification(notificationId: string): Promise<any | null> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.NOTIFICATION_DETAIL, notificationId)
    const cached = await redis.get(key)

    if (cached) {
      return JSON.parse(cached)
    }

    return null
  } catch (error) {
    console.error('[Cache] Error getting notification:', error)
    return null
  }
}

/**
 * Set notification details in cache
 */
export async function setCachedNotification(
  notificationId: string,
  notification: unknown): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.NOTIFICATION_DETAIL, notificationId)
    await redis.setEx(
      key,
      CACHE_TTL.NOTIFICATION_DETAIL,
      JSON.stringify(notification)
    )
  } catch (error) {
    console.error('[Cache] Error setting notification:', error)
  }
}

/**
 * Invalidate notification cache
 */
export async function invalidateNotificationCache(notificationId: string): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.NOTIFICATION_DETAIL, notificationId)
    await redis.del(key)
  } catch (error) {
    console.error('[Cache] Error invalidating notification:', error)
  }
}

// =====================================================
// Template Caching
// =====================================================

/**
 * Get all templates from cache
 */
export async function getCachedTemplates(): Promise<any[] | null> {
  try {
    const redis = await getRedisClient()
    const key = CACHE_PREFIXES.TEMPLATE_LIST
    const cached = await redis.get(key)

    if (cached) {
      return JSON.parse(cached)
    }

    return null
  } catch (error) {
    console.error('[Cache] Error getting templates:', error)
    return null
  }
}

/**
 * Set templates in cache
 */
export async function setCachedTemplates(templates: unknown[]): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = CACHE_PREFIXES.TEMPLATE_LIST
    await redis.setEx(key, CACHE_TTL.TEMPLATE_LIST, JSON.stringify(templates))
  } catch (error) {
    console.error('[Cache] Error setting templates:', error)
  }
}

/**
 * Invalidate all template caches
 */
export async function invalidateTemplateCache(): Promise<void> {
  try {
    const redis = await getRedisClient()
    const keys = await redis.keys(`${CACHE_PREFIXES.TEMPLATE_LIST}*`)
    keys.push(...(await redis.keys(`${CACHE_PREFIXES.TEMPLATE_DETAIL}:*`)))

    if (keys.length > 0) {
      await redis.del(keys)
    }
  } catch (error) {
    console.error('[Cache] Error invalidating template cache:', error)
  }
}

// =====================================================
// Analytics Caching
// =====================================================

/**
 * Get analytics statistics from cache
 */
export async function getCachedAnalyticsStats(
  startDate: string,
  endDate: string
): Promise<any | null> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.ANALYTICS_STATS, startDate, endDate)
    const cached = await redis.get(key)

    if (cached) {
      return JSON.parse(cached)
    }

    return null
  } catch (error) {
    console.error('[Cache] Error getting analytics stats:', error)
    return null
  }
}

/**
 * Set analytics statistics in cache
 */
export async function setCachedAnalyticsStats(
  startDate: string,
  endDate: string,
  stats: unknown): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = getCacheKey(CACHE_PREFIXES.ANALYTICS_STATS, startDate, endDate)
    await redis.setEx(key, CACHE_TTL.ANALYTICS_STATS, JSON.stringify(stats))
  } catch (error) {
    console.error('[Cache] Error setting analytics stats:', error)
  }
}

/**
 * Get trending notifications from cache
 */
export async function getCachedTrendingNotifications(): Promise<any[] | null> {
  try {
    const redis = await getRedisClient()
    const key = CACHE_PREFIXES.ANALYTICS_TRENDING
    const cached = await redis.get(key)

    if (cached) {
      return JSON.parse(cached)
    }

    return null
  } catch (error) {
    console.error('[Cache] Error getting trending notifications:', error)
    return null
  }
}

/**
 * Set trending notifications in cache
 */
export async function setCachedTrendingNotifications(notifications: unknown[]): Promise<void> {
  try {
    const redis = await getRedisClient()
    const key = CACHE_PREFIXES.ANALYTICS_TRENDING
    await redis.setEx(
      key,
      CACHE_TTL.ANALYTICS_TRENDING,
      JSON.stringify(notifications)
    )
  } catch (error) {
    console.error('[Cache] Error setting trending notifications:', error)
  }
}

/**
 * Invalidate all analytics caches
 */
export async function invalidateAnalyticsCache(): Promise<void> {
  try {
    const redis = await getRedisClient()
    const keys = await redis.keys(`${CACHE_PREFIXES.ANALYTICS_STATS}*`)
    keys.push(...(await redis.keys(`${CACHE_PREFIXES.ANALYTICS_TRENDING}*`)))

    if (keys.length > 0) {
      await redis.del(keys)
    }
  } catch (error) {
    console.error('[Cache] Error invalidating analytics cache:', error)
  }
}

// =====================================================
// Rate Limiting Cache
// =====================================================

/**
 * Check and increment rate limit counter
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  window: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const redis = await getRedisClient()
    const rateLimitKey = getCacheKey(CACHE_PREFIXES.RATE_LIMIT, key)

    // Get current count
    const current = await redis.get(rateLimitKey)
    const count = current ? parseInt(current, 10) : 0

    if (count >= limit) {
      const ttl = await redis.ttl(rateLimitKey)
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + ttl * 1000
      }
    }

    // Increment counter
    const newCount = await redis.incr(rateLimitKey)

    // Set expiry on first increment
    if (newCount === 1) {
      await redis.expire(rateLimitKey, window)
    }

    const ttl = await redis.ttl(rateLimitKey)

    return {
      allowed: true,
      remaining: limit - newCount,
      resetAt: Date.now() + ttl * 1000
    }
  } catch (error) {
    console.error('[Cache] Error checking rate limit:', error)
    // Fail open - allow request if Redis is down
    return {
      allowed: true,
      remaining: 0,
      resetAt: Date.now() + window * 1000
    }
  }
}

// =====================================================
// Bulk Cache Operations
// =====================================================

/**
 * Invalidate all notification caches (use with caution!)
 */
export async function invalidateAllNotificationCaches(): Promise<void> {
  try {
    const redis = await getRedisClient()
    const keys = await redis.keys('notif:*')

    if (keys.length > 0) {
      await redis.del(keys)
    }
  } catch (error) {
    console.error('[Cache] Error invalidating all caches:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean
  keys: number
  memory: string
  hitRate?: number
}> {
  try {
    const redis = await getRedisClient()

    // Get number of notification cache keys
    const keys = await redis.keys('notif:*')

    // Get memory info
    const info = await redis.info('memory')
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/)
    const memory = memoryMatch ? memoryMatch[1] : 'unknown'

    return {
      connected: true,
      keys: keys.length,
      memory
    }
  } catch (error) {
    console.error('[Cache] Error getting cache stats:', error)
    return {
      connected: false,
      keys: 0,
      memory: 'N/A'
    }
  }
}

/**
 * Close Redis connection (call on app shutdown)
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit()
    }
  } catch (error) {
    console.error('[Redis] Error closing connection:', error)
  }
}

// =====================================================
// Cache Warming
// =====================================================

/**
 * Warm cache with frequently accessed data
 * Call this on app startup or after cache clear
 */
export async function warmNotificationCache(): Promise<void> {
  try {

    // This would be called from your app initialization
    // Add logic to pre-load hot data:
    // - Common templates
    // - Recent notifications
    // - Analytics for current month
    // etc.

  } catch (error) {
    console.error('[Cache] Error warming cache:', error)
  }
}
