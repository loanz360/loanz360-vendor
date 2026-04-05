export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import type { BPAuditLog } from '@/types/bp-profile'

/** Row shape returned from the partner_audit_logs table */
interface AuditLogRow {
  id: string
  created_at: string
  action_type: string
  action_description: string | null
  description: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_by_name: string | null
  source: string | null
  ip_address: string | null
  user_agent: string | null
  approval_status: string | null
  approved_by: string | null
  approved_at: string | null
  approval_remarks: string | null
  compliance_review_notes: string | null
  system_flags: string[] | null
}

/**
 * GET /api/partners/bp/audit
 * Fetches audit logs for the current BP
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const actionType = searchParams.get('action_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const section = searchParams.get('section')

    // Fetch partner to verify they are a BP
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'BUSINESS_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Build query
    let query = supabase
      .from('partner_audit_logs')
      .select('*', { count: 'exact' })
      .eq('partner_id', partner.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    if (section) {
      query = query.eq('section', section)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: auditLogs, count, error: logsError } = await query

    if (logsError) {
      apiLogger.error('Error fetching audit logs', logsError)

      // If table doesn't exist, return empty array with sample data
      if (logsError.code === '42P01') {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          page,
          limit,
          message: 'Audit logs table not yet configured'
        })
      }

      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Parse and format audit logs
    const formattedLogs: BPAuditLog[] = (auditLogs || []).map((log: AuditLogRow) => ({
      id: log.id,
      timestamp: log.created_at,
      action_type: log.action_type,
      action_description: log.action_description || log.description,
      field_name: log.field_name,
      old_value: maskSensitiveValue(log.field_name, log.old_value),
      new_value: maskSensitiveValue(log.field_name, log.new_value),
      changed_by: log.changed_by === user.id ? 'SELF' : log.changed_by,
      changed_by_name: log.changed_by_name,
      source: log.source || 'WEB',
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      approval_status: log.approval_status || 'NOT_REQUIRED',
      approved_by: log.approved_by,
      approved_at: log.approved_at,
      approval_remarks: log.approval_remarks,
      compliance_review_notes: log.compliance_review_notes,
      system_flags: log.system_flags || []
    }))

    return NextResponse.json({
      success: true,
      data: formattedLogs,
      total: count || 0,
      page,
      limit
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/bp/audit', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to mask sensitive values in audit logs
function maskSensitiveValue(fieldName: string | null, value: string | null): string | null {
  if (!value || !fieldName) return value

  const sensitiveFields = [
    'pan_number',
    'aadhaar_number',
    'account_number',
    'ifsc_code',
    'password',
    'otp',
    'token'
  ]

  const fieldLower = fieldName.toLowerCase()

  if (sensitiveFields.some(f => fieldLower.includes(f))) {
    // Keep first 2 and last 2 characters, mask the rest
    if (value.length > 4) {
      return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2)
    }
    return '****'
  }

  return value
}
