import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRecentErrors,
  getErrorStats,
  getErrorsByLevel,
  getErrorsByEndpoint,
  clearErrorLogs,
} from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/error-logs
 * View error logs (Super Admin only)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check if super admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ success: false, error: 'Access denied - Super Admin only' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const level = searchParams.get('level')
    const endpoint = searchParams.get('endpoint')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Handle different actions
    if (action === 'stats') {
      const stats = getErrorStats()
      return NextResponse.json({ stats })
    }

    if (action === 'clear') {
      const count = clearErrorLogs()
      return NextResponse.json({ message: 'Error logs cleared', count })
    }

    // Get filtered errors
    let errors
    if (level) {
      errors = getErrorsByLevel(level as any, limit)
    } else if (endpoint) {
      errors = getErrorsByEndpoint(endpoint, limit)
    } else {
      errors = getRecentErrors(limit)
    }

    return NextResponse.json({
      errors,
      count: errors.length,
    })
  } catch (error: unknown) {
    apiLogger.error('Error logs API error', error)
    logApiError(error as Error, request, { action: 'get' })
    return NextResponse.json(
      { error: 'Failed to fetch error logs' },
      { status: 500 }
    )
  }
}
