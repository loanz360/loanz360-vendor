export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BAAuditLog, BAAuditLogResponse } from '@/types/ba-profile'
import { apiLogger } from '@/lib/utils/logger'

/**
 * GET /api/partners/ba/profile/audit-logs
 * Fetches audit logs for the BA partner
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get partner ID
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_ASSOCIATE')
      .maybeSingle()

    if (!partner) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      } as BAAuditLogResponse)
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const actionType = searchParams.get('action_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('partner_audit_logs')
      .select('*', { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: logs, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching audit logs', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    const formattedLogs: BAAuditLog[] = (logs || []).map(log => ({
      id: log.id,
      timestamp: log.created_at,
      action_type: log.action_type,
      action_description: log.action_description,
      field_name: log.field_name,
      old_value: maskSensitiveValue(log.field_name, log.old_value),
      new_value: maskSensitiveValue(log.field_name, log.new_value),
      changed_by: log.changed_by,
      changed_by_name: log.changed_by_name,
      source: log.source,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      approval_status: log.approval_status,
      approved_by: log.approved_by,
      approved_at: log.approved_at,
      approval_remarks: log.approval_remarks,
      metadata: log.metadata,
    }))

    const response: BAAuditLogResponse = {
      success: true,
      data: formattedLogs,
      total: count || 0,
      page,
      limit,
    }

    return NextResponse.json(response)
  } catch (error) {
    apiLogger.error('Error in GET /api/partners/ba/profile/audit-logs', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper to mask sensitive values in logs
function maskSensitiveValue(fieldName: string | null, value: string | null): string | null {
  if (!value || !fieldName) return value

  const sensitiveFields = [
    'account_number',
    'pan_number',
    'aadhaar_number',
    'aadhaar_number_masked',
    'mobile_number',
    'alternate_mobile',
    'ifsc_code',
  ]

  if (sensitiveFields.includes(fieldName)) {
    if (value.length <= 4) return '****'
    return '*'.repeat(value.length - 4) + value.slice(-4)
  }

  return value
}
