import { parseBody } from '@/lib/utils/parse-body'
/**
 * API Route: Super Admin Go-Live Checklist
 * GET  — Returns saved checklist state
 * POST — Runs automated health checks in parallel
 * PUT  — Saves checklist state with user info
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiLogger } from '@/lib/utils/logger'


// Health check endpoints for auto-verification
const AUTO_CHECK_ENDPOINTS = [
  { id: 'api-health', endpoint: '/api/health', label: 'Health Check' },
  { id: 'api-feature-flags', endpoint: '/api/feature-flags', label: 'Feature Flags API' },
  { id: 'api-loan-categories', endpoint: '/api/loan-categories', label: 'Loan Categories API' },
  { id: 'db-migrations', endpoint: '/api/health', label: 'Database Migrations' },
]

// GET — Retrieve saved checklist state
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Try to fetch from feature_flags metadata (using a special flag key)
    const { data, error } = await supabase
      .from('feature_flags')
      .select('metadata, updated_at')
      .eq('flag_key', '_go-live-checklist-state')
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      apiLogger.error('Go-live checklist fetch error', error)
    }

    if (data?.metadata) {
      return NextResponse.json({
        success: true,
        data: {
          state: data.metadata,
          lastSaved: data.updated_at,
        },
      })
    }

    // No saved state found — return empty
    return NextResponse.json({
      success: true,
      data: { state: null, lastSaved: null },
    })
  } catch (error) {
    apiLogger.error('Go-live checklist GET error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch checklist state' },
      { status: 500 }
    )
  }
}

// POST — Run auto-checks in parallel
export async function POST(request: NextRequest) {
  try {
    const baseUrl = request.nextUrl.origin
    const timeout = 10000 // 10 seconds per check

    const results = await Promise.allSettled(
      AUTO_CHECK_ENDPOINTS.map(async (check) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await fetch(`${baseUrl}${check.endpoint}`, {
            signal: controller.signal,
            cache: 'no-store',
            headers: { 'X-Auto-Check': 'true' },
          })
          clearTimeout(timeoutId)

          return {
            id: check.id,
            status: response.ok ? 'pass' as const : 'fail' as const,
            statusCode: response.status,
            label: check.label,
          }
        } catch (err) {
          clearTimeout(timeoutId)
          const isTimeout = err instanceof DOMException && err.name === 'AbortError'
          return {
            id: check.id,
            status: 'fail' as const,
            statusCode: 0,
            label: check.label,
            error: isTimeout ? 'Timeout (10s)' : 'Connection failed',
          }
        }
      })
    )

    const checkResults = results.map((result) => {
      if (result.status === 'fulfilled') return result.value
      return {
        id: 'unknown',
        status: 'fail' as const,
        statusCode: 0,
        label: 'Unknown',
        error: 'Check failed',
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        results: checkResults,
        checkedAt: new Date().toISOString(),
        passCount: checkResults.filter((r) => r.status === 'pass').length,
        failCount: checkResults.filter((r) => r.status === 'fail').length,
        totalChecks: checkResults.length,
      },
    })
  } catch (error) {
    apiLogger.error('Go-live auto-check error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run auto-checks' },
      { status: 500 }
    )
  }
}

// PUT — Save checklist state
export async function PUT(request: NextRequest) {
  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const supabase = createAdminClient()

    // Upsert the checklist state into feature_flags as a special entry
    const { error } = await supabase
      .from('feature_flags')
      .upsert(
        {
          flag_key: '_go-live-checklist-state',
          flag_name: 'Go-Live Checklist State',
          description: 'Internal: Stores go-live checklist progress',
          portal: 'ADMIN',
          category: 'MAINTENANCE',
          is_enabled: false,
          rollout_percentage: 0,
          metadata: {
            ...body.state,
            _lastSavedBy: body.savedBy || 'unknown',
            _lastSavedAt: new Date().toISOString(),
            _version: (body.version || 0) + 1,
          },
        },
        { onConflict: 'flag_key' }
      )

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Checklist state saved successfully',
    })
  } catch (error) {
    apiLogger.error('Go-live checklist save error', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save checklist state' },
      { status: 500 }
    )
  }
}
