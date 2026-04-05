/**
 * ULI Auth — JWT token management for RBIH API
 * Handles token fetch, cache, and auto-refresh
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { ULIEnvironment } from './uli-types'

interface TokenCache {
  token: string
  expiresAt: number
}

const tokenCache: Record<ULIEnvironment, TokenCache | null> = {
  SANDBOX: null,
  PRODUCTION: null,
}

/**
 * Get environment configuration from database
 */
export async function getULIConfig() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('uli_environment_config')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch ULI config: ${error.message}`)
  return data
}

/**
 * Get a valid JWT token for the active environment
 * Uses in-memory cache and auto-refreshes if expired
 */
export async function getULIToken(): Promise<string> {
  const config = await getULIConfig()
  const env = config.active_environment as ULIEnvironment

  // Check cache first
  const cached = tokenCache[env]
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token
  }

  // Check database token
  const tokenField = env === 'SANDBOX' ? 'sandbox_jwt_token' : 'production_jwt_token'
  const expiresField = env === 'SANDBOX' ? 'sandbox_jwt_expires_at' : 'production_jwt_expires_at'

  const dbToken = config[tokenField]
  const dbExpires = config[expiresField]

  if (dbToken && dbExpires && new Date(dbExpires).getTime() > Date.now() + 60000) {
    // Token is valid, cache it
    tokenCache[env] = {
      token: dbToken,
      expiresAt: new Date(dbExpires).getTime(),
    }
    return dbToken
  }

  // Token is expired or missing — attempt refresh
  const token = await refreshULIToken(env, config)
  return token
}

/**
 * Refresh JWT token by calling RBIH token endpoint
 * In sandbox mode, returns a mock token
 */
async function refreshULIToken(
  env: ULIEnvironment,
  config: Record<string, unknown>
): Promise<string> {
  const baseUrl = env === 'SANDBOX'
    ? config.sandbox_base_url
    : config.production_base_url
  const clientId = env === 'SANDBOX'
    ? config.sandbox_client_id
    : config.production_client_id
  const clientSecret = env === 'SANDBOX'
    ? config.sandbox_client_secret_encrypted
    : config.production_client_secret_encrypted

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(`ULI ${env} credentials not configured`)
  }

  try {
    const res = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    if (!res.ok) {
      throw new Error(`Token refresh failed: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    const token = data.access_token || data.token
    const expiresIn = data.expires_in || 3600

    if (!token) throw new Error('No token in response')

    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    // Cache it
    tokenCache[env] = {
      token,
      expiresAt: expiresAt.getTime(),
    }

    // Persist to database
    const supabase = createAdminClient()
    const tokenField = env === 'SANDBOX' ? 'sandbox_jwt_token' : 'production_jwt_token'
    const expiresField = env === 'SANDBOX' ? 'sandbox_jwt_expires_at' : 'production_jwt_expires_at'

    await supabase
      .from('uli_environment_config')
      .update({
        [tokenField]: token,
        [expiresField]: expiresAt.toISOString(),
      })
      .eq('id', config.id as string)

    return token
  } catch (error) {
    console.error(`ULI token refresh error (${env}):`, error)
    throw error
  }
}

/**
 * Clear cached token (useful when credentials change)
 */
export function clearTokenCache(env?: ULIEnvironment) {
  if (env) {
    tokenCache[env] = null
  } else {
    tokenCache.SANDBOX = null
    tokenCache.PRODUCTION = null
  }
}
