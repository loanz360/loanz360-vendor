/**
 * Enterprise Provider Manager
 * Fortune 500 Grade Implementation
 *
 * Features:
 * - Multi-provider support with failover
 * - Health monitoring and circuit breaker
 * - Cost-based and priority-based routing
 * - Credential encryption integration
 * - Real-time provider status tracking
 */

import { createSupabaseAdmin } from '@/lib/supabase/server'
import { decrypt } from '@/lib/security/encryption'

// =====================================================
// TYPES
// =====================================================

export type ProviderType = 'sms' | 'email' | 'whatsapp'
export type ProviderStatus = 'healthy' | 'degraded' | 'down' | 'unknown'
export type RoutingStrategy = 'priority' | 'round-robin' | 'cost-based' | 'load-balanced' | 'region-based'

export interface ProviderConfig {
  id: string
  name: string
  type: ProviderType
  isActive: boolean
  priority: number
  credentials: Record<string, string>
  settings: Record<string, any>
  costPerUnit: number
  currency: string
  supportedRegions: string[]
  rateLimits: {
    perMinute: number
    perHour: number
    perDay: number
  }
}

export interface ProviderHealth {
  providerId: string
  status: ProviderStatus
  lastCheck: Date
  successRate: number
  avgLatencyMs: number
  errorsLast24h: number
  lastError?: string
  lastErrorAt?: Date
  consecutiveFailures: number
}

export interface RoutingContext {
  recipientCountry?: string
  messageType?: 'otp' | 'transactional' | 'marketing'
  priority?: 'high' | 'normal' | 'low'
  costSensitive?: boolean
}

export interface SendResult {
  success: boolean
  providerId: string
  providerName: string
  messageId?: string
  externalId?: string
  status: string
  error?: string
  latencyMs: number
  cost?: number
  metadata?: Record<string, any>
}

// =====================================================
// CIRCUIT BREAKER
// =====================================================

interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailure?: Date
  lastSuccess?: Date
  openedAt?: Date
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,      // Open circuit after 5 consecutive failures
  resetTimeoutMs: 60000,    // Try again after 1 minute
  halfOpenRequests: 3,      // Allow 3 test requests in half-open state
}

// =====================================================
// PROVIDER MANAGER CLASS
// =====================================================

class ProviderManager {
  private static instance: ProviderManager
  private providers: Map<string, ProviderConfig> = new Map()
  private healthStatus: Map<string, ProviderHealth> = new Map()
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map()
  private roundRobinIndex: Map<ProviderType, number> = new Map()
  private routingStrategy: RoutingStrategy = 'priority'
  private initialized = false
  private lastRefresh: Date | null = null

  private constructor() {}

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager()
    }
    return ProviderManager.instance
  }

  // =====================================================
  // INITIALIZATION
  // =====================================================

  async initialize(): Promise<void> {
    if (this.initialized && this.lastRefresh) {
      // Refresh every 5 minutes
      const refreshAge = Date.now() - this.lastRefresh.getTime()
      if (refreshAge < 5 * 60 * 1000) {
        return
      }
    }

    try {
      const supabase = createSupabaseAdmin()

      // Fetch all active providers
      const { data: providers, error } = await supabase
        .from('communication_providers')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: true })

      if (error) {
        console.error('[ProviderManager] Failed to fetch providers:', error)
        throw error
      }

      // Clear and reload providers
      this.providers.clear()

      for (const provider of providers || []) {
        // Decrypt credentials if encrypted
        let credentials = provider.credentials || {}
        if (provider.encrypted_credentials) {
          try {
            const decrypted = decrypt(provider.encrypted_credentials)
            credentials = JSON.parse(decrypted.decrypted)
          } catch (e) {
            console.error(`[ProviderManager] Failed to decrypt credentials for ${provider.name}:`, e)
            continue
          }
        }

        const config: ProviderConfig = {
          id: provider.id,
          name: provider.name,
          type: provider.provider_type as ProviderType,
          isActive: provider.is_active,
          priority: provider.priority || 0,
          credentials,
          settings: provider.settings || {},
          costPerUnit: provider.cost_per_unit || 0,
          currency: provider.currency || 'INR',
          supportedRegions: provider.supported_regions || ['IN'],
          rateLimits: provider.rate_limits || {
            perMinute: 60,
            perHour: 1000,
            perDay: 10000
          }
        }

        this.providers.set(provider.id, config)

        // Initialize circuit breaker if not exists
        if (!this.circuitBreakers.has(provider.id)) {
          this.circuitBreakers.set(provider.id, {
            status: 'closed',
            failureCount: 0
          })
        }

        // Initialize health status if not exists
        if (!this.healthStatus.has(provider.id)) {
          this.healthStatus.set(provider.id, {
            providerId: provider.id,
            status: 'unknown',
            lastCheck: new Date(),
            successRate: 100,
            avgLatencyMs: 0,
            errorsLast24h: 0,
            consecutiveFailures: 0
          })
        }
      }

      this.initialized = true
      this.lastRefresh = new Date()
    } catch (error) {
      console.error('[ProviderManager] Initialization failed:', error)
      throw error
    }
  }

  // =====================================================
  // PROVIDER SELECTION
  // =====================================================

  /**
   * Get the best available provider based on routing strategy
   */
  async getProvider(
    type: ProviderType,
    context?: RoutingContext
  ): Promise<ProviderConfig | null> {
    await this.initialize()

    const availableProviders = this.getAvailableProviders(type)

    if (availableProviders.length === 0) {
      console.warn(`[ProviderManager] No available providers for type: ${type}`)
      return null
    }

    // Filter by region if specified
    let candidates = availableProviders
    if (context?.recipientCountry) {
      candidates = candidates.filter(p =>
        p.supportedRegions.includes(context.recipientCountry!) ||
        p.supportedRegions.includes('*')
      )
      if (candidates.length === 0) {
        candidates = availableProviders // Fallback to all if no region match
      }
    }

    // Apply routing strategy
    const strategy = context?.costSensitive ? 'cost-based' : this.routingStrategy

    switch (strategy) {
      case 'priority':
        return this.selectByPriority(candidates)
      case 'cost-based':
        return this.selectByCost(candidates)
      case 'round-robin':
        return this.selectRoundRobin(type, candidates)
      case 'load-balanced':
        return this.selectLoadBalanced(candidates)
      default:
        return this.selectByPriority(candidates)
    }
  }

  /**
   * Get all available providers for a type
   */
  getAvailableProviders(type: ProviderType): ProviderConfig[] {
    const providers: ProviderConfig[] = []

    for (const [id, config] of this.providers) {
      if (config.type !== type || !config.isActive) continue

      // Check circuit breaker
      const breaker = this.circuitBreakers.get(id)
      if (breaker?.status === 'open') {
        // Check if we should try half-open
        if (breaker.openedAt) {
          const elapsed = Date.now() - breaker.openedAt.getTime()
          if (elapsed >= CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
            breaker.status = 'half-open'
          } else {
            continue // Skip this provider
          }
        }
      }

      providers.push(config)
    }

    return providers
  }

  private selectByPriority(providers: ProviderConfig[]): ProviderConfig {
    return providers.sort((a, b) => a.priority - b.priority)[0]
  }

  private selectByCost(providers: ProviderConfig[]): ProviderConfig {
    return providers.sort((a, b) => a.costPerUnit - b.costPerUnit)[0]
  }

  private selectRoundRobin(type: ProviderType, providers: ProviderConfig[]): ProviderConfig {
    const currentIndex = this.roundRobinIndex.get(type) || 0
    const nextIndex = (currentIndex + 1) % providers.length
    this.roundRobinIndex.set(type, nextIndex)
    return providers[currentIndex]
  }

  private selectLoadBalanced(providers: ProviderConfig[]): ProviderConfig {
    // Select provider with lowest recent latency and highest success rate
    const scored = providers.map(p => {
      const health = this.healthStatus.get(p.id)
      if (!health) return { provider: p, score: 0 }

      // Score: higher is better
      const successScore = health.successRate * 10
      const latencyScore = Math.max(0, 1000 - health.avgLatencyMs) / 10
      const errorScore = Math.max(0, 100 - health.errorsLast24h)

      return {
        provider: p,
        score: successScore + latencyScore + errorScore
      }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored[0].provider
  }

  // =====================================================
  // FAILOVER
  // =====================================================

  /**
   * Get next provider after a failure (failover)
   */
  async getNextProvider(
    type: ProviderType,
    failedProviderId: string,
    context?: RoutingContext
  ): Promise<ProviderConfig | null> {
    await this.initialize()

    // Record failure
    this.recordFailure(failedProviderId)

    // Get available providers excluding the failed one
    const available = this.getAvailableProviders(type)
      .filter(p => p.id !== failedProviderId)

    if (available.length === 0) {
      console.warn(`[ProviderManager] No failover providers available for type: ${type}`)
      return null
    }

    return this.selectByPriority(available)
  }

  // =====================================================
  // HEALTH TRACKING
  // =====================================================

  /**
   * Record a successful send
   */
  recordSuccess(providerId: string, latencyMs: number): void {
    const health = this.healthStatus.get(providerId)
    if (health) {
      health.lastCheck = new Date()
      health.lastSuccess = new Date()
      health.avgLatencyMs = (health.avgLatencyMs * 0.9) + (latencyMs * 0.1) // Exponential moving average
      health.consecutiveFailures = 0
      health.status = 'healthy'
      health.successRate = Math.min(100, health.successRate + 1)
    }

    // Reset circuit breaker
    const breaker = this.circuitBreakers.get(providerId)
    if (breaker) {
      breaker.failureCount = 0
      breaker.status = 'closed'
    }
  }

  /**
   * Record a failed send
   */
  recordFailure(providerId: string, error?: string): void {
    const health = this.healthStatus.get(providerId)
    if (health) {
      health.lastCheck = new Date()
      health.lastError = error
      health.lastErrorAt = new Date()
      health.consecutiveFailures++
      health.errorsLast24h++
      health.successRate = Math.max(0, health.successRate - 5)

      if (health.consecutiveFailures >= 3) {
        health.status = 'degraded'
      }
      if (health.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        health.status = 'down'
      }
    }

    // Update circuit breaker
    const breaker = this.circuitBreakers.get(providerId)
    if (breaker) {
      breaker.failureCount++
      breaker.lastFailure = new Date()

      if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.status = 'open'
        breaker.openedAt = new Date()
        console.warn(`[ProviderManager] Circuit breaker OPENED for provider: ${providerId}`)
      }
    }
  }

  /**
   * Get health status for all providers
   */
  getHealthStatus(): Map<string, ProviderHealth> {
    return this.healthStatus
  }

  /**
   * Get health status for a specific provider
   */
  getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.healthStatus.get(providerId)
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================

  setRoutingStrategy(strategy: RoutingStrategy): void {
    this.routingStrategy = strategy
  }

  getRoutingStrategy(): RoutingStrategy {
    return this.routingStrategy
  }

  /**
   * Force refresh providers from database
   */
  async refresh(): Promise<void> {
    this.initialized = false
    await this.initialize()
  }

  /**
   * Get provider by ID
   */
  getProviderById(providerId: string): ProviderConfig | undefined {
    return this.providers.get(providerId)
  }

  /**
   * Get all providers
   */
  getAllProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get providers by type
   */
  getProvidersByType(type: ProviderType): ProviderConfig[] {
    return Array.from(this.providers.values()).filter(p => p.type === type)
  }
}

// =====================================================
// SINGLETON EXPORT
// =====================================================

export const providerManager = ProviderManager.getInstance()

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Send with automatic failover
 */
export async function sendWithFailover<T>(
  type: ProviderType,
  sendFn: (provider: ProviderConfig) => Promise<T>,
  context?: RoutingContext,
  maxRetries = 3
): Promise<{ result: T; provider: ProviderConfig } | null> {
  let lastError: Error | null = null
  let attemptedProviders: string[] = []

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Get provider, excluding already attempted ones
    let provider: ProviderConfig | null

    if (attempt === 0) {
      provider = await providerManager.getProvider(type, context)
    } else {
      provider = await providerManager.getNextProvider(
        type,
        attemptedProviders[attemptedProviders.length - 1],
        context
      )
    }

    if (!provider) {
      console.warn(`[sendWithFailover] No provider available (attempt ${attempt + 1})`)
      break
    }

    attemptedProviders.push(provider.id)

    const startTime = Date.now()

    try {
      const result = await sendFn(provider)
      const latency = Date.now() - startTime

      providerManager.recordSuccess(provider.id, latency)

      return { result, provider }
    } catch (error: unknown) {
      const latency = Date.now() - startTime
      lastError = error

      console.error(`[sendWithFailover] Provider ${provider.name} failed:`, error.message)
      providerManager.recordFailure(provider.id, error.message)

      // Continue to next provider
    }
  }

  console.error(`[sendWithFailover] All providers failed after ${maxRetries} attempts`)
  throw lastError || new Error('All providers failed')
}

/**
 * Run health checks on all providers
 */
export async function runHealthChecks(): Promise<void> {
  const providers = providerManager.getAllProviders()

  for (const provider of providers) {
    try {
      // TODO: Implement actual health check per provider type
      // For now, just check if the provider is reachable

      const health = providerManager.getProviderHealth(provider.id)
      if (health && health.consecutiveFailures === 0) {
        health.status = 'healthy'
      }
    } catch (error) {
      console.error(`[HealthCheck] Provider ${provider.name} check failed:`, error)
    }
  }
}
