import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors/api-errors'

/**
 * GET /api/compliance/violations
 * List policy violations
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const supabase = createSupabaseAdmin()
    const searchParams = request.nextUrl.searchParams

    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const adminId = searchParams.get('adminId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('policy_violations')
      .select('*, compliance_policies!inner(policy_code, title, framework)', { count: 'exact' })
      .order('detected_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    if (adminId) query = query.eq('admin_id', adminId)

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      violations: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, 'fetch violations')
  }
}

/**
 * PATCH /api/compliance/violations
 * Update violation status
 */
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse
const bodySchema = z.object({

      violationId: z.string().uuid(),

      status: z.string().optional(),

      assignedTo: z.string().optional(),

      resolutionNotes: z.string().optional(),

      resolvedBy: z.string().optional(),

    })

    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { violationId, status, assignedTo, resolutionNotes, resolvedBy } = body

    if (!violationId) {
      return NextResponse.json(
        { success: false, error: 'Violation ID required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseAdmin()

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (assignedTo) updateData.assigned_to = assignedTo
    if (resolutionNotes) updateData.resolution_notes = resolutionNotes
    if (status === 'resolved' && resolvedBy) {
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = resolvedBy
    }

    const { data, error } = await supabase
      .from('policy_violations')
      .update(updateData)
      .eq('id', violationId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      violation: data,
    })
  } catch (error) {
    return handleApiError(error, 'update violation')
  }
}
