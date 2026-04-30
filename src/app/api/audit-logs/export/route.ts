import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { jsonToCSV, generateExcelXML, formatAuditLogForExport } from '@/lib/utils/export-helpers'
import { apiLogger } from '@/lib/utils/logger'

/**
 * POST /api/audit-logs/export
 * Export audit logs in various formats (CSV, Excel, JSON)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const bodySchema = z.object({

      format: z.string().optional().default('csv'),

      excel: z.string().optional(),

      action_type: z.string().optional(),

      date_from: z.string().optional(),

      date_to: z.string().optional(),

      performed_by: z.string().optional(),

      limit: z.number().optional(),

      exported_by: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const {
      format = 'csv', // csv, excel, json
      admin_id,
      action_type,
      date_from,
      date_to,
      performed_by,
      limit = 10000 // Max records to export
    } = body

    // Validate format
    if (!['csv', 'excel', 'json'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use: csv, excel, or json' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('admin_audit_logs')
      .select(`
        *,
        admin:admins!admin_audit_logs_admin_id_fkey(admin_unique_id, full_name),
        performed_by_user:users!admin_audit_logs_performed_by_fkey(full_name)
      `)
      .order('performed_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (admin_id) {
      query = query.eq('admin_id', admin_id)
    }

    if (action_type) {
      query = query.eq('action_type', action_type)
    }

    if (date_from) {
      query = query.gte('performed_at', date_from)
    }

    if (date_to) {
      query = query.lte('performed_at', date_to)
    }

    if (performed_by) {
      query = query.eq('performed_by', performed_by)
    }

    const { data: logs, error } = await query

    if (error) throw error

    if (!logs || logs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No audit logs found matching the criteria' },
        { status: 404 }
      )
    }

    // Format data for export
    const formattedLogs = logs.map(log => ({
      ...log,
      admin_unique_id: log.admin?.admin_unique_id,
      admin_name: log.admin?.full_name,
      performed_by_name: log.performed_by_user?.full_name
    }))

    const exportData = formatAuditLogForExport(formattedLogs)

    // Generate export based on format
    let content: string
    let contentType: string
    let fileExtension: string

    switch (format) {
      case 'csv':
        content = jsonToCSV(exportData)
        contentType = 'text/csv'
        fileExtension = 'csv'
        break

      case 'excel':
        content = generateExcelXML(exportData, 'Audit Logs')
        contentType = 'application/vnd.ms-excel'
        fileExtension = 'xls'
        break

      case 'json':
        content = JSON.stringify(exportData, null, 2)
        contentType = 'application/json'
        fileExtension = 'json'
        break

      default:
        throw new Error('Unsupported format')
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `audit_logs_${timestamp}.${fileExtension}`

    // Log export activity
    await supabase.rpc('create_admin_audit_log', {
      p_admin_id: admin_id || null,
      p_action_type: 'audit_logs_exported',
      p_action_description: `Audit logs exported in ${format.toUpperCase()} format (${logs.length} records)`,
      p_changes: JSON.stringify({
        format,
        record_count: logs.length,
        filters: { admin_id, action_type, date_from, date_to, performed_by }
      }),
      p_performed_by: body.exported_by,
      p_ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      p_user_agent: request.headers.get('user-agent') || 'unknown'
    })

    // Return file as response
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': content.length.toString()
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Export Audit Logs API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/audit-logs/export
 * Get export options and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin()
    const { searchParams } = new URL(request.url)

    const admin_id = searchParams.get('admin_id')

    // Get total count
    let countQuery = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })

    if (admin_id) {
      countQuery = countQuery.eq('admin_id', admin_id)
    }

    const { count: totalLogs } = await countQuery

    // Get action types
    const { data: actionTypes } = await supabase
      .from('admin_audit_logs')
      .select('action_type')
      .limit(1000)

    const uniqueActionTypes = [...new Set(actionTypes?.map(a => a.action_type))]

    // Get date range
    const { data: dateRange } = await supabase
      .from('admin_audit_logs')
      .select('performed_at')
      .order('performed_at', { ascending: true })
      .limit(1)

    const { data: latestLog } = await supabase
      .from('admin_audit_logs')
      .select('performed_at')
      .order('performed_at', { ascending: false })
      .limit(1)

    return NextResponse.json({
      success: true,
      data: {
        total_logs: totalLogs || 0,
        available_formats: ['csv', 'excel', 'json'],
        action_types: uniqueActionTypes,
        date_range: {
          earliest: dateRange?.[0]?.performed_at || null,
          latest: latestLog?.[0]?.performed_at || null
        },
        max_export_limit: 10000,
        estimated_file_sizes: {
          csv: `~${Math.ceil((totalLogs || 0) * 0.5)}KB`,
          excel: `~${Math.ceil((totalLogs || 0) * 0.8)}KB`,
          json: `~${Math.ceil((totalLogs || 0) * 1.2)}KB`
        }
      }
    })
  } catch (error: unknown) {
    apiLogger.error('[Export Info API] Error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
