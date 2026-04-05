import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Verify the request is from a super_admin user.
 */
async function verifySuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: 'Unauthorized', status: 401 }
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (userError || userData?.role !== 'super_admin') {
    return { user: null, error: 'Forbidden', status: 403 }
  }

  return { user }
}

/**
 * GET /api/superadmin/integrations/health
 * Get health status overview (count by health_status)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const supabase = createSupabaseAdmin()

    const { data: providers, error } = await supabase
      .from('integration_providers')
      .select('id, provider_name, display_name, category, status, health_status, last_health_check_at')
      .neq('status', 'deleted')

    if (error) {
      apiLogger.error('Error fetching health overview', { error })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch health overview' },
        { status: 500 }
      )
    }

    // Count by health_status
    const healthCounts: Record<string, number> = {}
    const providersByHealth: Record<string, Array<{ id: string; provider_name: string; display_name: string; category: string; last_health_check_at: string | null }>> = {}

    for (const p of providers || []) {
      const hs = p.health_status || 'unknown'
      healthCounts[hs] = (healthCounts[hs] || 0) + 1

      if (!providersByHealth[hs]) {
        providersByHealth[hs] = []
      }
      providersByHealth[hs].push({
        id: p.id,
        provider_name: p.provider_name,
        display_name: p.display_name,
        category: p.category,
        last_health_check_at: p.last_health_check_at,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        total_providers: (providers || []).length,
        health_counts: healthCounts,
        providers_by_health: providersByHealth,
      },
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/superadmin/integrations/health', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/superadmin/integrations/health
 * Trigger health check for a specific provider.
 * Simulates a health check: records in integration_logs, updates last_health_check_at.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifySuperAdmin()
    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      )
    }

    const body = await request.json()

    if (!body.provider_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: provider_id' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    // Verify provider exists
    const { data: provider } = await supabase
      .from('integration_providers')
      .select('id, provider_name, display_name, base_url, health_status')
      .eq('id', body.provider_id)
      .neq('status', 'deleted')
      .maybeSingle()

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'Provider not found' },
        { status: 404 }
      )
    }

    // Simulate health check
    const now = new Date().toISOString()
    const simulatedResponseTime = Math.floor(Math.random() * 500) + 50 // 50-550ms
    const simulatedHealthy = Math.random() > 0.1 // 90% chance healthy
    const newHealthStatus = simulatedHealthy ? 'healthy' : 'degraded'
    const simulatedStatusCode = simulatedHealthy ? 200 : 503

    // Record the health check in integration_logs
    const { error: logError } = await supabase
      .from('integration_logs')
      .insert({
        provider_id: body.provider_id,
        event_type: 'health_check',
        endpoint: provider.base_url ? `${provider.base_url}/health` : '/health',
        method: 'GET',
        status_code: simulatedStatusCode,
        response_time_ms: simulatedResponseTime,
        request_payload: { triggered_by: auth.user.id },
        response_payload: {
          status: newHealthStatus,
          response_time_ms: simulatedResponseTime,
          checked_at: now,
        },
        created_at: now,
      })

    if (logError) {
      apiLogger.error('Error recording health check log', { error: logError })
    }

    // Update the provider's health status and last check time
    const { data: updatedProvider, error: updateError } = await supabase
      .from('integration_providers')
      .update({
        health_status: newHealthStatus,
        last_health_check_at: now,
        updated_at: now,
      })
      .eq('id', body.provider_id)
      .select('id, provider_name, display_name, health_status, last_health_check_at')
      .single()

    if (updateError) {
      apiLogger.error('Error updating provider health status', { error: updateError })
      return NextResponse.json(
        { success: false, error: 'Failed to update health status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        provider: updatedProvider,
        health_check: {
          status_code: simulatedStatusCode,
          response_time_ms: simulatedResponseTime,
          health_status: newHealthStatus,
          checked_at: now,
          previous_status: provider.health_status,
        },
      },
    })
  } catch (error) {
    apiLogger.error('Error in POST /api/superadmin/integrations/health', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
