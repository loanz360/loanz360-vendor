/**
 * ULI Client — HTTP client for RBIH API calls
 * Handles auth, retry, timeout, and automatic logging
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getULIConfig, getULIToken } from './uli-auth'
import type { ULIService, ULIEnvironment } from './uli-types'

export interface ULICallOptions {
  /** The service to call (from uli_services table) */
  service: ULIService
  /** Request payload to send */
  payload: Record<string, unknown>
  /** Optional context for logging */
  context?: {
    lead_id?: string
    appraisal_id?: string
    triggered_by_user_id?: string
    triggered_by_module?: string
  }
  /** Override timeout (defaults to service timeout) */
  timeout_ms?: number
}

export interface ULICallResult {
  success: boolean
  data: Record<string, unknown>
  http_status: number
  response_time_ms: number
  request_id: string | null
  error?: string
}

/**
 * Execute a ULI API call with retry, logging, and error handling
 */
export async function callULIService(options: ULICallOptions): Promise<ULICallResult> {
  const { service, payload, context, timeout_ms } = options
  const config = await getULIConfig()
  const env = config.active_environment as ULIEnvironment
  const baseUrl = env === 'SANDBOX' ? config.sandbox_base_url : config.production_base_url
  const effectiveTimeout = timeout_ms || service.timeout_ms || config.default_timeout_ms || 30000
  const maxRetries = service.retry_count || config.default_retry_count || 2

  const requestId = crypto.randomUUID()
  const requestUrl = `${baseUrl}${service.uli_api_path || ''}`
  const startTime = Date.now()

  let lastError: string | null = null
  let httpStatus = 0
  let responsePayload: Record<string, unknown> = {}
  let success = false

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = await getULIToken()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout)

      const res = await fetch(requestUrl, {
        method: service.uli_api_method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      httpStatus = res.status
      responsePayload = await res.json().catch(() => ({}))

      if (res.ok) {
        success = true
        break
      }

      lastError = `HTTP ${res.status}: ${JSON.stringify(responsePayload)}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = `Request timed out after ${effectiveTimeout}ms`
      }
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = service.retry_delay_ms * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  const responseTimeMs = Date.now() - startTime

  // Log the call
  if (config.enable_request_logging) {
    await logULICall({
      service,
      environment: env,
      requestId,
      requestUrl,
      requestPayload: payload,
      responsePayload,
      httpStatus,
      responseTimeMs,
      success,
      error: lastError,
      cost: success && config.enable_cost_tracking ? service.cost_per_call : 0,
      context,
    })
  }

  return {
    success,
    data: responsePayload,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
    request_id: requestId,
    error: lastError || undefined,
  }
}

/**
 * Log a ULI API call to the uli_api_logs table
 */
async function logULICall(params: {
  service: ULIService
  environment: ULIEnvironment
  requestId: string
  requestUrl: string
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
  httpStatus: number
  responseTimeMs: number
  success: boolean
  error: string | null
  cost: number
  context?: ULICallOptions['context']
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('uli_api_logs').insert({
      service_id: params.service.id,
      service_code: params.service.service_code,
      category: params.service.category,
      environment: params.environment,
      request_id: params.requestId,
      request_url: params.requestUrl,
      request_method: params.service.uli_api_method,
      request_payload: params.requestPayload,
      request_timestamp: new Date().toISOString(),
      response_payload: params.responsePayload,
      response_timestamp: new Date().toISOString(),
      response_time_ms: params.responseTimeMs,
      http_status_code: params.httpStatus,
      is_success: params.success,
      error_message: params.error,
      cost: params.cost,
      lead_id: params.context?.lead_id || null,
      appraisal_id: params.context?.appraisal_id || null,
      triggered_by_user_id: params.context?.triggered_by_user_id || null,
      triggered_by_module: params.context?.triggered_by_module || null,
    })

    // Update service stats if cost tracking is enabled
    if (params.cost > 0) {
      await supabase.rpc('increment_uli_service_stats', {
        p_service_id: params.service.id,
        p_cost: params.cost,
      }).catch(() => {
        // Non-critical — just update manually
      })
    }
  } catch (err) {
    console.error('Failed to log ULI call:', err)
  }
}
