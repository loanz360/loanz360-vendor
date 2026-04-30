// =====================================================
// API RETRY UTILITY (Enhancement H5)
// Automatic retry logic for failed API calls
// =====================================================

import { clientLogger } from './client-logger'

interface RetryOptions {
  maxRetries?: number
  retryDelay?: number
  backoffMultiplier?: number
  retryableStatuses?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2, // Exponential backoff
  retryableStatuses: [408, 429, 500, 502, 503, 504] // Network/server errors
}

/**
 * Fetch with automatic retry logic
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Promise with Response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...retryOptions }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // If response is OK or not retryable, return it
      if (response.ok || !config.retryableStatuses.includes(response.status)) {
        return response
      }

      // If we have retries left and status is retryable, continue
      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt)
        clientLogger.warn(`API call failed with status ${response.status}, retrying in ${delay}ms...`, {
          url,
          attempt: attempt + 1,
          maxRetries: config.maxRetries
        })
        await sleep(delay)
        continue
      }

      // Last attempt failed
      return response

    } catch (error) {
      lastError = error as Error

      if (attempt < config.maxRetries) {
        const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt)
        clientLogger.warn(`API call failed with error, retrying in ${delay}ms...`, {
          url,
          error: (error as Error).message,
          attempt: attempt + 1,
          maxRetries: config.maxRetries
        })
        await sleep(delay)
        continue
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error(`Failed to fetch ${url} after ${config.maxRetries} retries`)
}

/**
 * Sleep utility function
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch JSON with automatic retry
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @param retryOptions - Retry configuration
 * @returns Promise with parsed JSON data
 */
export async function fetchJSONWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options, retryOptions)

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Check if error is retryable
 * @param error - Error object
 * @returns Boolean indicating if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true
  }

  // Timeout errors
  if (error.name === 'AbortError') {
    return true
  }

  return false
}

/**
 * Create abort controller with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @returns AbortController
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller
}
