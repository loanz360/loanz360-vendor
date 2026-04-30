/**
 * Redis Caching Layer for Incentives Module
 * Enterprise-grade caching with Redis
 *
 * Features:
 * - Multi-layer caching (L1: Memory, L2: Redis)
 * - Cache invalidation strategies
 * - Cache warming
 * - TTL management
 * - Cache statistics
 */

import { createClient, RedisClientType } from 'redis';

// ===================================
// TYPE DEFINITIONS
// ===================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export interface CacheEntry<T> {
  data: T;
  ttl: number;
  createdAt: number;
  tags: string[];
}

// ===================================
// REDIS CLIENT SINGLETON
// ===================================

class RedisCache {
  private static instance: RedisCache;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  // L1 Cache (In-memory)
  private l1Cache = new Map<string, CacheEntry<any>>();
  private readonly L1_MAX_SIZE = 1000; // Max items in L1 cache
  private readonly L1_DEFAULT_TTL = 300; // 5 minutes

  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  private constructor() {
    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis: Max reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Get cache key with namespace
   */
  private getKey(key: string, namespace?: string): string {
    const ns = namespace || 'incentives';
    return `${ns}:${key}`;
  }

  /**
   * Get from cache (L1 then L2)
   */
  public async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const cacheKey = this.getKey(key, options.namespace);

    // Try L1 cache first
    const l1Entry = this.l1Cache.get(cacheKey);
    if (l1Entry && Date.now() - l1Entry.createdAt < l1Entry.ttl * 1000) {
      this.stats.hits++;
      this.updateHitRate();
      return l1Entry.data as T;
    }

    // Try L2 cache (Redis)
    if (this.isConnected && this.client) {
      try {
        const data = await this.client.get(cacheKey);
        if (data) {
          const parsed = JSON.parse(data) as T;

          // Populate L1 cache
          this.setL1(cacheKey, parsed, options.ttl || this.L1_DEFAULT_TTL, options.tags);

          this.stats.hits++;
          this.updateHitRate();
          return parsed;
        }
      } catch (error) {
        console.error('Redis GET error:', error);
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  /**
   * Set cache entry (both L1 and L2)
   */
  public async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.getKey(key, options.namespace);
    const ttl = options.ttl || 3600; // Default 1 hour

    // Set in L1 cache
    this.setL1(cacheKey, value, ttl, options.tags);

    // Set in L2 cache (Redis)
    if (this.isConnected && this.client) {
      try {
        await this.client.setEx(cacheKey, ttl, JSON.stringify(value));

        // Store tags mapping
        if (options.tags && options.tags.length > 0) {
          for (const tag of options.tags) {
            const tagKey = this.getKey(`tag:${tag}`, options.namespace);
            await this.client.sAdd(tagKey, cacheKey);
            await this.client.expire(tagKey, ttl);
          }
        }
      } catch (error) {
        console.error('Redis SET error:', error);
      }
    }

    this.stats.sets++;
  }

  /**
   * Delete cache entry
   */
  public async delete(key: string, namespace?: string): Promise<void> {
    const cacheKey = this.getKey(key, namespace);

    // Delete from L1
    this.l1Cache.delete(cacheKey);

    // Delete from L2
    if (this.isConnected && this.client) {
      try {
        await this.client.del(cacheKey);
      } catch (error) {
        console.error('Redis DELETE error:', error);
      }
    }

    this.stats.deletes++;
  }

  /**
   * Delete all entries with a specific tag
   */
  public async deleteByTag(tag: string, namespace?: string): Promise<void> {
    const tagKey = this.getKey(`tag:${tag}`, namespace);

    if (this.isConnected && this.client) {
      try {
        const keys = await this.client.sMembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys associated with tag
          await this.client.del(keys);

          // Delete from L1 cache
          for (const key of keys) {
            this.l1Cache.delete(key);
          }
        }

        // Delete tag set
        await this.client.del(tagKey);

        this.stats.deletes += keys.length;
      } catch (error) {
        console.error('Redis DELETE BY TAG error:', error);
      }
    }
  }

  /**
   * Clear all cache
   */
  public async clear(namespace?: string): Promise<void> {
    // Clear L1
    if (namespace) {
      const prefix = this.getKey('', namespace);
      for (const key of this.l1Cache.keys()) {
        if (key.startsWith(prefix)) {
          this.l1Cache.delete(key);
        }
      }
    } else {
      this.l1Cache.clear();
    }

    // Clear L2
    if (this.isConnected && this.client) {
      try {
        const pattern = namespace ? `${namespace}:*` : 'incentives:*';
        const keys = await this.client.keys(pattern);

        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } catch (error) {
        console.error('Redis CLEAR error:', error);
      }
    }
  }

  /**
   * Get or set cache (cache-aside pattern)
   */
  public async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch data
    const data = await fetchFn();

    // Set in cache
    await this.set(key, data, options);

    return data;
  }

  /**
   * Increment counter
   */
  public async increment(
    key: string,
    amount: number = 1,
    namespace?: string
  ): Promise<number> {
    const cacheKey = this.getKey(key, namespace);

    if (this.isConnected && this.client) {
      try {
        return await this.client.incrBy(cacheKey, amount);
      } catch (error) {
        console.error('Redis INCREMENT error:', error);
      }
    }

    return 0;
  }

  /**
   * Decrement counter
   */
  public async decrement(
    key: string,
    amount: number = 1,
    namespace?: string
  ): Promise<number> {
    const cacheKey = this.getKey(key, namespace);

    if (this.isConnected && this.client) {
      try {
        return await this.client.decrBy(cacheKey, amount);
      } catch (error) {
        console.error('Redis DECREMENT error:', error);
      }
    }

    return 0;
  }

  /**
   * Check if key exists
   */
  public async exists(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.getKey(key, namespace);

    // Check L1 first
    if (this.l1Cache.has(cacheKey)) {
      return true;
    }

    // Check L2
    if (this.isConnected && this.client) {
      try {
        const exists = await this.client.exists(cacheKey);
        return exists === 1;
      } catch (error) {
        console.error('Redis EXISTS error:', error);
      }
    }

    return false;
  }

  /**
   * Set cache entry in L1
   */
  private setL1<T>(
    key: string,
    value: T,
    ttl: number,
    tags?: string[]
  ): void {
    // Enforce max size
    if (this.l1Cache.size >= this.L1_MAX_SIZE) {
      // Remove oldest entry (FIFO)
      const firstKey = this.l1Cache.keys().next().value;
      this.l1Cache.delete(firstKey);
    }

    this.l1Cache.set(key, {
      data: value,
      ttl,
      createdAt: Date.now(),
      tags: tags || [],
    });
  }

  /**
   * Start cleanup interval for L1 cache
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();

      for (const [key, entry] of this.l1Cache.entries()) {
        if (now - entry.createdAt > entry.ttl * 1000) {
          this.l1Cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Disconnect Redis client
   */
  public async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Get connection status
   */
  public isRedisConnected(): boolean {
    return this.isConnected;
  }
}

// ===================================
// CACHE UTILITY FUNCTIONS
// ===================================

/**
 * Get cache instance
 */
export function getCache(): RedisCache {
  return RedisCache.getInstance();
}

/**
 * Cache key generators for Incentives module
 */
export const CacheKeys = {
  // User incentives
  userIncentives: (userId: string) => `user:${userId}:incentives`,
  userActiveIncentives: (userId: string) => `user:${userId}:incentives:active`,
  userExpiredIncentives: (userId: string) => `user:${userId}:incentives:expired`,

  // Incentive details
  incentive: (id: string) => `incentive:${id}`,
  incentiveAllocations: (id: string) => `incentive:${id}:allocations`,
  incentiveAnalytics: (id: string) => `incentive:${id}:analytics`,

  // User progress
  userProgress: (userId: string, incentiveId: string) =>
    `user:${userId}:incentive:${incentiveId}:progress`,

  // Claims
  userClaims: (userId: string) => `user:${userId}:claims`,
  claim: (id: string) => `claim:${id}`,

  // Leaderboard
  leaderboard: (period: string) => `leaderboard:${period}`,
  userRank: (userId: string, period: string) => `user:${userId}:rank:${period}`,

  // Achievements
  userAchievements: (userId: string) => `user:${userId}:achievements`,
  userTier: (userId: string) => `user:${userId}:tier`,

  // Analytics
  analyticsSnapshot: (date: string, type: string) =>
    `analytics:${date}:${type}`,

  // Lists
  allIncentives: () => `list:all-incentives`,
  activeIncentives: () => `list:active-incentives`,
};

/**
 * Cache tags for invalidation
 */
export const CacheTags = {
  user: (userId: string) => `user:${userId}`,
  incentive: (incentiveId: string) => `incentive:${incentiveId}`,
  leaderboard: 'leaderboard',
  analytics: 'analytics',
  achievements: 'achievements',
};

/**
 * Cache TTL presets (in seconds)
 */
export const CacheTTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
  WEEK: 604800, // 7 days
};

/**
 * Invalidate user-related caches
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  const cache = getCache();
  await cache.deleteByTag(CacheTags.user(userId));
}

/**
 * Invalidate incentive-related caches
 */
export async function invalidateIncentiveCache(incentiveId: string): Promise<void> {
  const cache = getCache();
  await cache.deleteByTag(CacheTags.incentive(incentiveId));
}

/**
 * Invalidate leaderboard cache
 */
export async function invalidateLeaderboardCache(): Promise<void> {
  const cache = getCache();
  await cache.deleteByTag(CacheTags.leaderboard);
}

/**
 * Warm up cache with frequently accessed data
 */
export async function warmUpCache(
  dataLoader: () => Promise<{ key: string; data: unknown; ttl?: number }[]>
): Promise<void> {
  const cache = getCache();
  const items = await dataLoader();

  for (const item of items) {
    await cache.set(item.key, item.data, { ttl: item.ttl });
  }
}

export default RedisCache;
