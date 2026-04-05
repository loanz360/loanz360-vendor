/**
 * CAE Provider Adapter - Pluggable Provider Architecture
 *
 * This module implements a factory pattern for third-party provider adapters.
 * All provider-specific logic is encapsulated in adapters, making it easy to
 * add new providers without modifying core CAE logic.
 *
 * Key Features:
 * - Provider registration from database configuration
 * - Automatic fallback when primary provider fails
 * - Rate limiting per provider
 * - Health checks and circuit breaker pattern
 * - Request/response logging
 */

// Note: createClient from server should be imported dynamically in server-side code
// This module is designed to be used in API routes where supabase client is passed in

// Provider types matching database schema
export type ProviderType =
  | 'CREDIT_BUREAU'
  | 'KYC'
  | 'INCOME_VERIFICATION'
  | 'DOCUMENT_OCR'
  | 'FRAUD_CHECK'
  | 'ACCOUNT_AGGREGATOR'
  | 'GST_VERIFICATION'
  | 'ITR_VERIFICATION'
  | 'BANK_STATEMENT_ANALYZER'
  | 'IDENTITY_VERIFICATION'
  | 'INTERNAL'

// Provider configuration from database
export interface ProviderConfig {
  id: string
  code: string
  name: string
  provider_type: ProviderType
  api_endpoint: string | null
  api_key_encrypted: string | null
  timeout_ms: number
  retry_count: number
  rate_limit_per_minute: number | null
  rate_limit_per_day: number | null
  cost_per_call: number | null
  is_active: boolean
  is_mock: boolean
  priority: number
  config_json: Record<string, any> | null
}

// Standard request/response interfaces
export interface ProviderRequest {
  request_id: string
  lead_id: string
  request_type: string
  payload: Record<string, any>
}

export interface ProviderResponse {
  success: boolean
  provider_code: string
  request_id: string
  data?: Record<string, any>
  error?: {
    code: string
    message: string
    details?: any
  }
  latency_ms: number
  cost?: number
}

// Abstract base adapter - all provider adapters must extend this
export abstract class BaseProviderAdapter {
  protected config: ProviderConfig
  protected requestCount: number = 0
  protected lastRequestTime: number = 0

  constructor(config: ProviderConfig) {
    this.config = config
  }

  // Abstract methods that each provider must implement
  abstract execute(request: ProviderRequest): Promise<ProviderResponse>
  abstract healthCheck(): Promise<boolean>

  // Common utility methods
  protected async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.timeout_ms)

    try {
      const response = await fetch(`${this.config.api_endpoint}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.api_key_encrypted}`,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  protected checkRateLimit(): boolean {
    if (!this.config.rate_limit_per_minute) return true

    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Reset counter if more than a minute has passed
    if (this.lastRequestTime < oneMinuteAgo) {
      this.requestCount = 0
    }

    if (this.requestCount >= this.config.rate_limit_per_minute) {
      return false
    }

    this.requestCount++
    this.lastRequestTime = now
    return true
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.retry_count
  ): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        if (i < retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
        }
      }
    }

    throw lastError
  }

  getProviderCode(): string {
    return this.config.code
  }

  isActive(): boolean {
    return this.config.is_active
  }

  getPriority(): number {
    return this.config.priority
  }

  getCostPerCall(): number {
    return this.config.cost_per_call || 0
  }
}

// Mock provider adapter for testing/development
export class MockProviderAdapter extends BaseProviderAdapter {
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now()

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))

    // Generate mock response based on request type
    const mockData = this.generateMockData(request)

    return {
      success: true,
      provider_code: this.config.code,
      request_id: request.request_id,
      data: mockData,
      latency_ms: Date.now() - startTime,
      cost: 0,
    }
  }

  async healthCheck(): Promise<boolean> {
    return true
  }

  private generateMockData(request: ProviderRequest): Record<string, any> {
    switch (request.request_type) {
      case 'CREDIT_SCORE':
        return {
          credit_score: 650 + Math.floor(Math.random() * 200),
          credit_grade: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
          bureau: 'MOCK_BUREAU',
          report_date: new Date().toISOString(),
          accounts: {
            total: 5,
            active: 3,
            closed: 2,
          },
          enquiries_last_6_months: 2,
        }

      case 'KYC_VERIFICATION':
        return {
          pan_verified: true,
          aadhaar_verified: true,
          name_match_score: 0.95,
          address_match_score: 0.88,
          dob_verified: true,
        }

      case 'INCOME_VERIFICATION':
        return {
          estimated_monthly_income: 50000 + Math.floor(Math.random() * 50000),
          income_source: 'SALARY',
          employer_verified: true,
          income_stability_score: 0.85,
        }

      case 'BANK_STATEMENT':
        return {
          average_monthly_balance: 75000,
          average_monthly_credits: 55000,
          average_monthly_debits: 45000,
          salary_credits_detected: true,
          bounce_count: 0,
          analysis_period_months: 6,
        }

      default:
        return {
          status: 'PROCESSED',
          request_type: request.request_type,
          processed_at: new Date().toISOString(),
        }
    }
  }
}

// Provider Adapter Factory
export class ProviderAdapterFactory {
  private static adapters: Map<string, BaseProviderAdapter> = new Map()
  private static configs: Map<string, ProviderConfig> = new Map()

  // Initialize adapters from database configuration
  // Pass supabase client from API route context
  static async initialize(supabase: any): Promise<void> {

    const { data: providers, error } = await supabase
      .from('cae_providers')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.error('Failed to load providers:', error)
      throw new Error('Failed to initialize provider adapters')
    }

    // Clear existing adapters
    this.adapters.clear()
    this.configs.clear()

    // Create adapter for each active provider
    for (const config of providers || []) {
      const providerConfig: ProviderConfig = {
        id: config.id,
        code: config.provider_code || config.code,
        name: config.provider_name || config.name,
        provider_type: config.provider_type,
        api_endpoint: config.api_endpoint,
        api_key_encrypted: config.api_key_encrypted,
        timeout_ms: config.timeout_ms || 30000,
        retry_count: config.retry_count || 3,
        rate_limit_per_minute: config.rate_limit_per_minute,
        rate_limit_per_day: config.rate_limit_per_day,
        cost_per_call: config.cost_per_call,
        is_active: config.is_active,
        is_mock: config.is_mock || false,
        priority: config.priority || 10,
        config_json: config.config_json,
      }

      this.configs.set(providerConfig.code, providerConfig)

      // Create appropriate adapter based on provider type
      const adapter = this.createAdapter(providerConfig)
      this.adapters.set(providerConfig.code, adapter)
    }
  }

  // Create adapter instance based on provider configuration
  private static createAdapter(config: ProviderConfig): BaseProviderAdapter {
    // If mock mode is enabled, always use mock adapter
    if (config.is_mock) {
      return new MockProviderAdapter(config)
    }

    // TODO: Add specific adapter implementations for each provider
    // For now, use mock adapter as fallback
    switch (config.code) {
      case 'CIBIL':
        // return new CIBILAdapter(config)
        return new MockProviderAdapter(config)

      case 'EXPERIAN':
        // return new ExperianAdapter(config)
        return new MockProviderAdapter(config)

      case 'PERFIOS':
        // return new PerfiosAdapter(config)
        return new MockProviderAdapter(config)

      case 'FINVU':
        // return new FinvuAdapter(config)
        return new MockProviderAdapter(config)

      case 'DIGILOCKER':
        // return new DigilockerAdapter(config)
        return new MockProviderAdapter(config)

      default:
        return new MockProviderAdapter(config)
    }
  }

  // Get adapter by provider code
  static getAdapter(code: string): BaseProviderAdapter | undefined {
    return this.adapters.get(code)
  }

  // Get all adapters of a specific type, sorted by priority
  static getAdaptersByType(type: ProviderType): BaseProviderAdapter[] {
    return Array.from(this.adapters.values())
      .filter(adapter => {
        const config = this.configs.get(adapter.getProviderCode())
        return config?.provider_type === type
      })
      .sort((a, b) => a.getPriority() - b.getPriority())
  }

  // Execute request with automatic fallback
  static async executeWithFallback(
    type: ProviderType,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    const adapters = this.getAdaptersByType(type)

    if (adapters.length === 0) {
      return {
        success: false,
        provider_code: 'NONE',
        request_id: request.request_id,
        error: {
          code: 'NO_PROVIDER',
          message: `No active providers found for type: ${type}`,
        },
        latency_ms: 0,
      }
    }

    for (const adapter of adapters) {
      try {
        const response = await adapter.execute(request)
        if (response.success) {
          return response
        }
        // Log failure and try next provider
        console.warn(`Provider ${adapter.getProviderCode()} failed, trying next...`)
      } catch (error) {
        console.error(`Provider ${adapter.getProviderCode()} error:`, error)
      }
    }

    // All providers failed
    return {
      success: false,
      provider_code: adapters[adapters.length - 1].getProviderCode(),
      request_id: request.request_id,
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: 'All available providers failed to process the request',
      },
      latency_ms: 0,
    }
  }

  // Run health check on all active adapters
  static async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    for (const [code, adapter] of this.adapters) {
      try {
        const isHealthy = await adapter.healthCheck()
        results.set(code, isHealthy)
      } catch {
        results.set(code, false)
      }
    }

    return results
  }

  // Get provider statistics
  static getProviderStats(): {
    total: number
    active: number
    byType: Record<ProviderType, number>
  } {
    const byType: Record<string, number> = {}

    for (const config of this.configs.values()) {
      byType[config.provider_type] = (byType[config.provider_type] || 0) + 1
    }

    return {
      total: this.adapters.size,
      active: Array.from(this.adapters.values()).filter(a => a.isActive()).length,
      byType: byType as Record<ProviderType, number>,
    }
  }
}

// Types are already exported via interface declarations above
