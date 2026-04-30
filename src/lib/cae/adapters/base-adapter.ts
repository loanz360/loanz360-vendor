/**
 * Base CAE Provider Adapter
 * Abstract class that all CAE provider adapters must extend
 */

import { CAEProviderAdapter, CAEProviderType, CAERequest, CAEResponse, CAEProviderConfig } from '../types'

export abstract class BaseCAEAdapter implements CAEProviderAdapter {
  abstract provider: CAEProviderType
  abstract name: string

  protected config: CAEProviderConfig

  constructor(config: CAEProviderConfig) {
    this.config = config
  }

  abstract processAppraisal(request: CAERequest): Promise<CAEResponse>
  abstract getStatus(requestId: string): Promise<CAEResponse>

  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const start = Date.now()
    try {
      // Default health check - override in specific adapters
      return {
        healthy: true,
        latency_ms: Date.now() - start,
      }
    } catch (error) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  protected generateRequestId(): string {
    return `${this.provider}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  protected logRequest(request: CAERequest, requestId: string): void {
  }

  protected logResponse(response: CAEResponse): void {
  }

  protected createErrorResponse(requestId: string, error: string, errorCode?: string): CAEResponse {
    return {
      success: false,
      provider: this.provider,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      processing_time_ms: 0,
      error,
      error_code: errorCode,
    }
  }
}
