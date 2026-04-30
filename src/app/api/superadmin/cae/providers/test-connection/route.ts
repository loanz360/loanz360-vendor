
/**
 * CAE Provider Connection Test API
 * Tests connectivity to a configured provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Parse request body
    const body = await request.json()
    const { provider_id, api_endpoint, api_key, health_check_url } = body

    if (!provider_id && !api_endpoint) {
      return NextResponse.json(
        { success: false, error: 'Provider ID or API endpoint is required' },
        { status: 400 }
      )
    }

    // If provider_id is provided, fetch provider config
    let endpoint = api_endpoint
    let healthUrl = health_check_url
    let providerName = 'Unknown'

    if (provider_id) {
      const { data: provider, error } = await supabase
        .from('cae_providers')
        .select('*')
        .eq('id', provider_id)
        .maybeSingle()

      if (error || !provider) {
        return NextResponse.json(
          { success: false, error: 'Provider not found' },
          { status: 404 }
        )
      }

      endpoint = provider.api_endpoint
      healthUrl = provider.health_check_url || `${endpoint}/health`
      providerName = provider.provider_name || provider.name || 'Unknown'
    }

    if (!endpoint && !healthUrl) {
      return NextResponse.json(
        { success: false, error: 'No endpoint configured for this provider' },
        { status: 400 }
      )
    }

    const testUrl = healthUrl || endpoint

    // Perform connection test
    const startTime = Date.now()
    let isHealthy = false
    let statusCode = 0
    let errorMessage = ''

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(api_key && { 'Authorization': `Bearer ${api_key}` }),
        },
        signal: controller.signal,
      })

      clearTimeout(timeout)
      statusCode = response.status
      isHealthy = response.ok || statusCode === 200 || statusCode === 204

      if (!isHealthy) {
        const text = await response.text().catch(() => '')
        errorMessage = `HTTP ${statusCode}: ${text.substring(0, 200)}`
      }
    } catch (error: unknown) {
      if (error.name === 'AbortError') {
        errorMessage = 'Connection timed out after 10 seconds'
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'DNS resolution failed - hostname not found'
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - server may be down'
      } else if (error.code === 'CERT_HAS_EXPIRED') {
        errorMessage = 'SSL certificate has expired'
      } else {
        errorMessage = (error instanceof Error ? error.message : String(error)) || 'Connection failed'
      }
    }

    const latencyMs = Date.now() - startTime

    // Update provider health status in database
    if (provider_id) {
      await supabase
        .from('cae_providers')
        .update({
          is_healthy: isHealthy,
          last_health_check: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', provider_id)

      // Log the health check
      await supabase.from('cae_api_logs').insert({
        provider_id,
        request_type: 'HEALTH_CHECK',
        request_payload: { url: testUrl },
        response_payload: { is_healthy: isHealthy, status_code: statusCode },
        status_code: statusCode,
        is_success: isHealthy,
        error_message: errorMessage || null,
        latency_ms: latencyMs,
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        is_healthy: isHealthy,
        provider_name: providerName,
        test_url: testUrl,
        status_code: statusCode,
        latency_ms: latencyMs,
        error_message: errorMessage || null,
        tested_at: new Date().toISOString(),
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Connection test error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get all providers and their health status
    const { data: providers, error } = await supabase
      .from('cae_providers')
      .select('id, provider_code, provider_name, is_active, is_healthy, last_health_check, api_endpoint')
      .order('provider_type', { ascending: true })
      .order('priority', { ascending: true })

    if (error) {
      throw error
    }

    // Calculate summary stats
    const stats = {
      total: providers?.length || 0,
      active: providers?.filter(p => p.is_active).length || 0,
      healthy: providers?.filter(p => p.is_healthy).length || 0,
      unhealthy: providers?.filter(p => p.is_active && !p.is_healthy).length || 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        providers,
        stats,
      },
    })
  } catch (error: unknown) {
    apiLogger.error('Get providers error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
