import { parseBody } from '@/lib/utils/parse-body'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { logApiError } from '@/lib/monitoring/errorLogger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET - Get Audit History
 *
 * Query Parameters:
 * @param offer_id - UUID of offer (optional, for specific offer history)
 * @param user_id - UUID of user (optional, for user activity)
 * @param field - Field name (optional, for field-level diff)
 * @param stats - 'true' to get statistics only
 * @param limit - Results per page (default: 50, max: 200)
 * @param offset - Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const offerId = searchParams.get('offer_id')
    const userId = searchParams.get('user_id')
    const field = searchParams.get('field')
    const stats = searchParams.get('stats') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // Check permissions - only admins can view full audit logs
    const isAdmin = userData?.role && ['SUPER_ADMIN', 'ADMIN'].includes(userData.role)

    // STATISTICS MODE
    if (stats) {
      if (!isAdmin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const daysBack = parseInt(searchParams.get('days_back') || '30')

      const { data, error } = await supabase.rpc('get_audit_statistics', {
        p_days_back: daysBack
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        statistics: data?.[0] || {},
        period: {
          days_back: daysBack,
          from: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        }
      })
    }

    // FIELD DIFF MODE
    if (field && offerId) {
      const { data, error } = await supabase.rpc('get_field_diff', {
        p_offer_id: offerId,
        p_field_name: field,
        p_limit: limit
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        field_name: field,
        offer_id: offerId,
        changes: data || [],
        count: data?.length || 0
      })
    }

    // USER ACTIVITY MODE
    if (userId) {
      // Users can only view their own activity unless admin
      if (userId !== user.id && !isAdmin) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const daysBack = parseInt(searchParams.get('days_back') || '30')

      const { data, error } = await supabase.rpc('get_user_audit_activity', {
        p_user_id: userId,
        p_days_back: daysBack,
        p_limit: limit
      })

      if (error) throw error

      return NextResponse.json({
        success: true,
        user_id: userId,
        activity: data || [],
        count: data?.length || 0,
        period: {
          days_back: daysBack
        }
      })
    }

    // OFFER HISTORY MODE
    if (offerId) {
      const { data, error } = await supabase.rpc('get_offer_audit_history', {
        p_offer_id: offerId,
        p_limit: limit,
        p_offset: offset
      })

      if (error) throw error

      // Get offer info
      const { data: offer } = await supabase
        .from('offers')
        .select('offer_title, rolled_out_by, status')
        .eq('id', offerId)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        offer_id: offerId,
        offer_info: offer || {},
        history: data || [],
        count: data?.length || 0,
        pagination: {
          limit,
          offset,
          has_more: (data?.length || 0) === limit
        }
      })
    }

    // RECENT CHANGES MODE (Admin only)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. Admins only.' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('offer_audit_log')
      .select(`
        id,
        offer_id,
        action,
        changed_fields,
        change_count,
        user_name,
        user_role,
        changed_at,
        change_severity,
        is_rolled_back
      `)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      success: true,
      recent_changes: data || [],
      count: data?.length || 0,
      pagination: {
        limit,
        offset,
        has_more: (data?.length || 0) === limit
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching audit history', error)
    logApiError(error as Error, request, { action: 'get_audit_history' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST - Rollback Offer to Version
 *
 * Body:
 * @param offer_id - UUID of offer to rollback
 * @param audit_log_id - UUID of audit log entry to restore from
 * @param rollback_reason - Reason for rollback
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { offer_id, audit_log_id, rollback_reason } = body

    if (!offer_id || !audit_log_id || !rollback_reason) {
      return NextResponse.json(
        { error: 'offer_id, audit_log_id, and rollback_reason are required' },
        { status: 400 }
      )
    }

    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle()

    // Only admins can rollback
    if (!userData?.role || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Only admins can rollback offers' },
        { status: 403 }
      )
    }

    // Perform rollback
    const { data, error } = await supabase.rpc('rollback_offer_to_version', {
      p_offer_id: offer_id,
      p_audit_log_id: audit_log_id,
      p_rollback_user_id: user.id,
      p_rollback_reason: rollback_reason
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      ...data,
      rolled_back_by: userData.full_name,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    apiLogger.error('Error rolling back offer', error)
    logApiError(error as Error, request, { action: 'rollback_offer' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Archive Old Audit Logs
 * Super Admin only - for maintenance
 *
 * Body:
 * @param retention_days - Days to retain (default: 365)
 */
export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.WRITE)
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // Only Super Admin can archive
    if (userData?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can archive audit logs' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const retentionDays = body.retention_days || 365

    const { data, error } = await supabase.rpc('archive_old_audit_logs', {
      p_retention_days: retentionDays
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      archived_count: data?.[0]?.archived_count || 0,
      retention_days: retentionDays,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    apiLogger.error('Error archiving audit logs', error)
    logApiError(error as Error, request, { action: 'archive_audit_logs' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
