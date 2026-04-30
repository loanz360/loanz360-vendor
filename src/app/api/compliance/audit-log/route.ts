import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'
import { logAuditEvent } from '@/lib/compliance/compliance-service'

/**
 * GET /api/compliance/audit-log
 * Fetch audit log entries with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const adminId = searchParams.get('adminId')
    const action = searchParams.get('action')
    const resourceType = searchParams.get('resourceType')
    const severity = searchParams.get('severity')
    const framework = searchParams.get('framework')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let query = supabase
      .from('compliance_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (adminId) query = query.eq('admin_id', adminId)
    if (action) query = query.ilike('action', `%${action}%`)
    if (resourceType) query = query.eq('resource_type', resourceType)
    if (severity) query = query.eq('severity', severity)
    if (framework) query = query.contains('compliance_frameworks', [framework])
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'fetch audit logs')
  }
}

/**
 * POST /api/compliance/audit-log
 * Create new audit log entry (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      adminId: z.string().uuid().optional(),

      adminEmail: z.string().email().optional(),

      adminRole: z.string().optional(),

      action: z.string().optional(),

      resourceType: z.string().optional(),

      resourceId: z.string().uuid().optional(),

      beforeState: z.string().optional(),

      afterState: z.string().optional(),

      ipAddress: z.string().optional(),

      userAgent: z.string().optional(),

      sessionId: z.string().uuid().optional(),

      severity: z.string().optional(),

      status: z.string().optional(),

      frameworks: z.string().optional(),

      sensitivityLevel: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    const sequenceNumber = await logAuditEvent({
      adminId: body.adminId,
      adminEmail: body.adminEmail,
      adminRole: body.adminRole,
      action: body.action,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      beforeState: body.beforeState,
      afterState: body.afterState,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      sessionId: body.sessionId,
      severity: body.severity,
      status: body.status,
      frameworks: body.frameworks,
      sensitivityLevel: body.sensitivityLevel,
    })

    if (!sequenceNumber) {
      return NextResponse.json(
        { success: false, error: 'Failed to create audit log entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sequenceNumber,
    })
  } catch (error) {
    return handleApiError(error, 'create audit log')
  }
}
