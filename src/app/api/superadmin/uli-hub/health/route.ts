import { parseBody } from '@/lib/utils/parse-body'
/**
 * API Route: ULI Health Check
 * GET  /api/superadmin/uli-hub/health — Get health status of all services
 * POST /api/superadmin/uli-hub/health — Run health check for a specific service
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


// GET — Get health status summary
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('uli_services')
      .select('id, service_code, service_name, category, health_status, is_healthy, last_health_check_at, avg_response_time_ms, success_rate, is_enabled')
      .eq('is_enabled', true)
      .order('category')
      .order('service_name')

    if (error) throw error

    // Aggregate health stats
    const services = data || []
    const summary = {
      total: services.length,
      healthy: services.filter(s => s.health_status === 'HEALTHY').length,
      degraded: services.filter(s => s.health_status === 'DEGRADED').length,
      down: services.filter(s => s.health_status === 'DOWN').length,
      unknown: services.filter(s => s.health_status === 'UNKNOWN').length,
    }

    return NextResponse.json({ success: true, data: { summary, services } })
  } catch (error) {
    apiLogger.error('ULI health check error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health status' },
      { status: 500 }
    )
  }
}

// POST — Run health check for a specific service
// TODO: Replace with real RBIH API ping when ULI integration is live
export async function POST(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { service_id } = body

    if (!service_id) {
      return NextResponse.json(
        { success: false, error: 'service_id is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Default health check result until real RBIH integration is available
    const responseTimeMs = 0
    const isHealthy = false
    const healthStatus = 'UNKNOWN'

    const { data, error } = await supabase
      .from('uli_services')
      .update({
        is_healthy: isHealthy,
        health_status: healthStatus,
        last_health_check_at: new Date().toISOString(),
        avg_response_time_ms: responseTimeMs,
      })
      .eq('id', service_id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        service_id: data.id,
        health_status: data.health_status,
        response_time_ms: responseTimeMs,
        checked_at: data.last_health_check_at,
      },
    })
  } catch (error) {
    apiLogger.error('ULI health check run error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run health check' },
      { status: 500 }
    )
  }
}
