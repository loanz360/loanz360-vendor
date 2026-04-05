export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { apiLogger } from '@/lib/utils/logger'
import type { AuditActionType } from '@/types/cp-profile'

/** Row shape returned from the cp_audit_logs table */
interface AuditLogRow {
  id: string
  action_type: string
  action_description: string | null
  section: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  changed_by_name: string | null
  source: string | null
  ip_address: string | null
  location: string | null
  approval_status: string | null
  created_at: string
}

/**
 * GET /api/partners/cp/audit
 * Fetches audit logs for the authenticated CP
 *
 * Features:
 * - Full activity timeline
 * - Filter by action type, section, date range
 * - Pagination support
 * - Export capability (CSV format)
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

    // Get partner record
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, partner_id')
      .eq('user_id', user.id)
      .eq('partner_type', 'CHANNEL_PARTNER')
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json(
        { success: false, error: 'Partner profile not found' },
        { status: 404 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const actionType = searchParams.get('action_type') as AuditActionType | null
    const section = searchParams.get('section')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit
    const exportFormat = searchParams.get('export')

    // Build query
    let query = supabase
      .from('cp_audit_logs')
      .select('*', { count: 'exact' })
      .eq('partner_id', partner.id)

    // Apply filters
    if (actionType) {
      query = query.eq('action_type', actionType)
    }
    if (section) {
      query = query.eq('section', section)
    }
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00Z`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59Z`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, count, error } = await query

    if (error) {
      apiLogger.error('Error fetching audit logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Handle export
    if (exportFormat === 'csv') {
      // Get all logs without pagination for export
      const { data: allLogs } = await supabase
        .from('cp_audit_logs')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })
        .limit(1000) // Limit export to 1000 records

      const csvContent = generateCSV(allLogs || [])

      // Log export action
      const forwardedFor = request.headers.get('x-forwarded-for')
      const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

      await supabase.from('cp_audit_logs').insert({
        partner_id: partner.id,
        action_type: 'PROFILE_EXPORT',
        action_description: 'Exported audit logs to CSV',
        section: 'activity',
        changed_by: user.id,
        source: 'WEB',
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      })

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="cp_audit_logs_${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Format logs for response
    const formattedLogs = (logs || []).map((log: AuditLogRow) => ({
      id: log.id,
      action_type: log.action_type,
      action_description: log.action_description,
      section: log.section,
      field_name: log.field_name,
      old_value: maskSensitiveValue(log.field_name, log.old_value),
      new_value: maskSensitiveValue(log.field_name, log.new_value),
      changed_by: log.changed_by === user.id ? 'You' : (log.changed_by_name || 'System'),
      source: log.source,
      ip_address: log.ip_address,
      location: log.location,
      approval_status: log.approval_status,
      created_at: log.created_at
    }))

    // Calculate summary
    const { data: summary } = await supabase
      .from('cp_audit_logs')
      .select('action_type')
      .eq('partner_id', partner.id)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const actionCounts: Record<string, number> = {}
    for (const log of summary || []) {
      actionCounts[log.action_type] = (actionCounts[log.action_type] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        },
        summary: {
          total_last_30_days: (summary || []).length,
          by_action_type: actionCounts
        },
        available_filters: {
          action_types: [
            'CREATE',
            'UPDATE',
            'DELETE',
            'VERIFY',
            'APPROVE',
            'REJECT',
            'LOGIN',
            'LOGOUT',
            'PASSWORD_CHANGE',
            'DOCUMENT_UPLOAD',
            'DOCUMENT_DELETE',
            'PROFILE_EXPORT',
            'DISBURSEMENT_SUBMIT',
            'DISBURSEMENT_BULK_UPLOAD',
            'PAYOUT_DISPUTE',
            'SUBUSER_ADD',
            'SUBUSER_REMOVE',
            'SESSION_REVOKE',
            'IP_WHITELIST_ADD',
            'IP_WHITELIST_REMOVE'
          ],
          sections: [
            'overview',
            'personal',
            'entity',
            'compliance',
            'lender-mapping',
            'disbursements',
            'payouts',
            'access-control',
            'notifications',
            'agreements',
            'security',
            'documents',
            'activity'
          ]
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/partners/cp/audit:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Mask sensitive field values
 */
function maskSensitiveValue(fieldName: string | null, value: string | null): string | null {
  if (!value) return null

  const sensitiveFields = [
    'account_number',
    'pan_number',
    'aadhaar',
    'password',
    'ifsc_code',
    'micr_code'
  ]

  if (fieldName && sensitiveFields.some(sf => fieldName.toLowerCase().includes(sf))) {
    if (value.length > 4) {
      return 'XXXX' + value.slice(-4)
    }
    return 'XXXX'
  }

  return value
}

/**
 * Generate CSV content from audit logs
 */
function generateCSV(logs: AuditLogRow[]): string {
  const headers = [
    'Date/Time',
    'Action Type',
    'Description',
    'Section',
    'Field',
    'Changed By',
    'Source',
    'IP Address'
  ]

  const rows = logs.map(log => [
    new Date(log.created_at).toISOString(),
    log.action_type,
    `"${(log.action_description || '').replace(/"/g, '""')}"`,
    log.section || '',
    log.field_name || '',
    log.changed_by_name || log.changed_by || 'System',
    log.source || '',
    log.ip_address || ''
  ])

  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
}
