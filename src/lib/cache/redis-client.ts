/**
 * Redis Client Configuration for LOANZ 360
 * Provides caching layer for high-performance data access
 *
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Error handling
 * - Type-safe cache operations
 * - TTL management
 */

import { createClient, RedisClientType } from 'redis'

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const REDIS_PASSWORD = process.env.REDIS_PASSWORD
const REDIS_TLS_ENABLED = process.env.REDIS_TLS_ENABLED === 'true'

// Cache key prefixes
export const CACHE_PREFIXES = {
  CONTEST_LEADERBOARD: 'contest:leaderboard:',
  CONTEST_ANALYTICS: 'contest:analytics:',
  CONTEST_PARTICIPANT: 'contest:participant:',
  CONTEST_DETAILS: 'contest:details:',
  USER_PERMISSIONS: 'user:permissions:',
} as const

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  LEADERBOARD: 300, // 5 minutes
  ANALYTICS: 600, // 10 minutes
  PARTICIPANT_STATUS: 180, // 3 minutes
  CONTEST_DETAILS: 3600, // 1 hour
  USER_PERMISSIONS: 1800, // 30 minutes
} as const

// Redis client singleton
let redisClient: RedisClientType | null = null
let isConnecting = false
let isConnected = false

/**
 * Initialize Redis client
 */
async function initializeRedis(): Promise<RedisClientType> {
  if (redisClient && isConnected) {
    return redisClient
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise((resolve) => setTimeout(resolve, 100))
    return initializeRedis()
  }

  isConnecting = true

  try {
    redisClient = createClient({
      url: REDIS_URL,
      password: REDIS_PASSWORD,
      socket: {
        tls: REDIS_TLS_ENABLED,
        reconnectStrategy: (retries) => {
          // Exponential backoff: 50ms, 100ms, 200ms, ..., max 3000ms
          const delay = Math.min(50 * Math.pow(2, retries), 3000)
          return delay
        },
      },
    })

    // Event handlers
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err)
      isConnected = false
    })

    redisClient.on('connect', () => {
    })

    redisClient.on('ready', () => {
      isConnected = true
      isConnecting = false
    })

    redisClient.on('reconnecting', () => {
      isConnected = false
    })

    redisClient.on('end', () => {
      isConnected = false
    })

    // Connect to Redis
    await redisClient.connect()

    return redisClient
  } catch (error) {
    console.error('Failed to initialize Redis:', error)
    isConnecting = false
    throw error
  }
}

/**
 * Get Redis client (creates connection if needed)
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  try {
    if (!redisClient || !isConnected) {
      await initializeRedis()
    }
    return redisClient
  } catch (error) {
    console.error('Failed to get Redis client:', error)
    return null
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getRedisClient()
    if (!client) return false
    await client.ping()
    return true
  } catch (error) {
    console.error('Redis availability check failed:', error)
    return false
  }
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient()
    if (!client) return null

    const cached = await client.get(key)
    if (!cached) return null

    return JSON.parse(cached) as T
  } catch (error) {
    console.error(`Failed to get cached value for key: ${key}`, error)
    return null
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<boolean> {
  try {
    const client = await getRedisClient()
    if (!client) return false

    const serialized = JSON.stringify(value)
    await client.setEx(key, ttlSeconds, serialized)
    return true
  } catch (error) {
    console.error(`Failed to set cached value for key: ${key}`, error)
    return false
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<boolean> {
  try {
    const client = await getRedisClient()
    if (!client) return false

    await client.del(key)
    return true
  } catch (error) {
    console.error(`Failed to delete cached value for key: ${key}`, error)
    return false
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachedByPattern(pattern: string): Promise<number> {
  try {
    const client = await getRedisClient()
    if (!client) return 0

    const keys = await client.keys(pattern)
    if (keys.length === 0) return 0

    await client.del(keys)
    return keys.length
  } catch (error) {
    console.error(`Failed to delete cached values by pattern: ${pattern}`, error)
    return 0
  }
}

/**
 * Invalidate contest cache (all related keys)
 */
export async function invalidateContestCache(contestId: string): Promise<void> {
  try {
    await Promise.all([
      deleteCached(`${CACHE_PREFIXES.CONTEST_LEADERBOARD}${contestId}`),
      deleteCached(`${CACHE_PREFIXES.CONTEST_ANALYTICS}${contestId}`),
      deleteCached(`${CACHE_PREFIXES.CONTEST_DETAILS}${contestId}`),
      deleteCachedByPattern(`${CACHE_PREFIXES.CONTEST_PARTICIPANT}${contestId}:*`),
    ])
  } catch (error) {
    console.error(`Failed to invalidate contest cache for: ${contestId}`, error)
  }
}

/**
 * Get cached leaderboard
 */
export async function getCachedLeaderboard(contestId: string, limit: number = 10) {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_LEADERBOARD}${contestId}:${limit}`
  return getCached<any>(cacheKey)
}

/**
 * Set cached leaderboard
 */
export async function setCachedLeaderboard(
  contestId: string,
  limit: number,
  data: any
): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_LEADERBOARD}${contestId}:${limit}`
  return setCached(cacheKey, data, CACHE_TTL.LEADERBOARD)
}

/**
 * Get cached analytics
 */
export async function getCachedAnalytics(contestId: string) {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_ANALYTICS}${contestId}`
  return getCached<any>(cacheKey)
}

/**
 * Set cached analytics
 */
export async function setCachedAnalytics(contestId: string, data: any): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_ANALYTICS}${contestId}`
  return setCached(cacheKey, data, CACHE_TTL.ANALYTICS)
}

/**
 * Get cached participant status
 */
export async function getCachedParticipantStatus(contestId: string, userId: string) {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_PARTICIPANT}${contestId}:${userId}`
  return getCached<any>(cacheKey)
}

/**
 * Set cached participant status
 */
export async function setCachedParticipantStatus(
  contestId: string,
  userId: string,
  data: any
): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_PARTICIPANT}${contestId}:${userId}`
  return setCached(cacheKey, data, CACHE_TTL.PARTICIPANT_STATUS)
}

/**
 * Get cached contest details
 */
export async function getCachedContestDetails(contestId: string) {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_DETAILS}${contestId}`
  return getCached<any>(cacheKey)
}

/**
 * Set cached contest details
 */
export async function setCachedContestDetails(contestId: string, data: any): Promise<boolean> {
  const cacheKey = `${CACHE_PREFIXES.CONTEST_DETAILS}${contestId}`
  return setCached(cacheKey, data, CACHE_TTL.CONTEST_DETAILS)
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  try {
    if (redisClient && isConnected) {
      await redisClient.quit()
    }
  } catch (error) {
    console.error('Failed to close Redis connection:', error)
  } finally {
    redisClient = null
    isConnected = false
  }
}

/**
 * Cache statistics
 */
export async function getCacheStats() {
  try {
    const client = await getRedisClient()
    if (!client) return null

    const info = await client.info('stats')
    const memory = await client.info('memory')

    return {
      connected: isConnected,
      stats: info,
      memory: memory,
    }
  } catch (error) {
    console.error('Failed to get cache stats:', error)
    return null
  }
}

// Export types
export type { RedisClientType }
