
/**
 * GET /api/monitoring/performance
 * Get performance metrics and statistics
 * Admin only
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, Permission } from '@/lib/auth/rbac'
import {
  getAllStats,
  getPerformanceReport,
  cacheTracker,
  dbTracker,
} from '@/lib/monitoring/performance'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission (admins only)
    const permissionCheck = await requirePermission(user.id, Permission.SYSTEM_ADMIN)
    if (!permissionCheck.authorized) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'summary'

    let data

    switch (type) {
      case 'operations':
        data = getAllStats()
        break

      case 'cache':
        data = cacheTracker.getStats()
        break

      case 'database':
        data = {
          slow_queries: dbTracker.getSlowQueries(500),
        }
        break

      case 'summary':
      default:
        data = {
          report: getPerformanceReport(),
          cache: cacheTracker.getStats(),
          database: {
            slow_queries_count: dbTracker.getSlowQueries(500).length,
          },
        }
        break
    }

    return NextResponse.json({
      success: true,
      data,
      type,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to fetch performance metrics',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
