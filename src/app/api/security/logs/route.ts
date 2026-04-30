
/**
 * Security Logs Query API
 * Retrieves security events from database for monitoring and audit
 *
 * SECURITY: Admin/SuperAdmin Access Only
 * - Strong authentication required
 * - Role-based access control
 * - Pagination and filtering
 * - Audit trail for log queries
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdmin, createClient } from '@/lib/supabase/server'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/auth/database-rate-limiter'
import { getClientIP } from '@/lib/utils/request-helpers'
import { logger } from '@/lib/utils/logger'
import type { UserProfile } from '@/types/database'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { logApiError } from '@/lib/monitoring/errorLogger'

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request)

  try {
    // ✅ Rate limiting
    const rateLimitResult = await checkRateLimit(clientIP, '/api/security/logs')

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      )
    }

    // ✅ CRITICAL: Authentication required
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // ✅ CRITICAL: Authorization - Only ADMIN and SUPER_ADMIN can view logs
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const userProfile = profile as unknown as UserProfile

    if (!userProfile || !['ADMIN', 'SUPER_ADMIN'].includes(userProfile.role)) {
      // Log unauthorized access attempt
      const adminClient = createSupabaseAdmin()
      await adminClient.from('security_logs').insert({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'UNAUTHORIZED_LOG_ACCESS_ATTEMPT',
        ip_address: clientIP,
        user_id: user.id,
        email: user.email,
        details: {
          role: userProfile?.role,
          attempted_endpoint: '/api/security/logs',
        },
        created_at: new Date().toISOString(),
      } as never)

      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const level = searchParams.get('level')
    const event = searchParams.get('event')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // ✅ Build query with pagination
    const supabaseAdmin = createSupabaseAdmin()
    let query = supabaseAdmin
      .from('security_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (startDate) {
      query = query.gte('timestamp', startDate)
    }

    if (endDate) {
      query = query.lte('timestamp', endDate)
    }

    if (level) {
      query = query.eq('level', level)
    }

    if (event) {
      query = query.ilike('event', `%${event}%`)
    }

    const { data: logs, error: queryError, count } = await query

    if (queryError) {
      logger.error('Failed to query security logs', new Error(queryError.message))
      return NextResponse.json(
        { error: 'Failed to retrieve security logs' },
        { status: 500 }
      )
    }

    // ✅ Audit log access
    const auditClient = createSupabaseAdmin()
    await auditClient.from('security_logs').insert({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'SECURITY_LOGS_ACCESSED',
      ip_address: clientIP,
      user_id: user.id,
      email: user.email,
      details: {
        filters: {
          startDate,
          endDate,
          level,
          event,
          limit,
          offset,
        },
        resultCount: logs?.length || 0,
      },
      created_at: new Date().toISOString(),
    } as never)

    return NextResponse.json({
      success: true,
      logs: logs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    logger.error('Security logs query error', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
