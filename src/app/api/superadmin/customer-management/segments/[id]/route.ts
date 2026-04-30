import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { parseBody } from '@/lib/utils/parse-body'

/**
 * Customer Segment Individual Operations API
 * SuperAdmin endpoint for updating/deleting individual segments
 *
 * GET    - Fetch single segment details
 * PUT    - Update segment
 * DELETE - Delete segment
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifyUnifiedAuth } from '@/lib/auth/unified-auth'
import { apiLogger } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  segment_type: z.enum(['STATIC', 'DYNAMIC']).optional(),
  filter_criteria: z.record(z.unknown()).optional().nullable(),
  is_active: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/superadmin/customer-management/segments/[id]
 * Fetch single segment details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: segment, error } = await supabaseAdmin
      .from('customer_segments')
      .select(`
        *,
        segment_members(count)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !segment) {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...segment,
        member_count: segment.segment_members?.[0]?.count || 0,
      },
    })

  } catch (error) {
    apiLogger.error('Segment GET error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/superadmin/customer-management/segments/[id]
 * Update segment
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get existing segment
    const { data: existing } = await supabaseAdmin
      .from('customer_segments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request, z.object({}).passthrough())
    if (_valErr) return _valErr
    const validatedData = updateSegmentSchema.parse(body)

    // Update segment
    const { data: updatedSegment, error: updateError } = await supabaseAdmin
      .from('customer_segments')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating segment', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update segment' },
        { status: 500 }
      )
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action: validatedData.is_active !== undefined && validatedData.is_active !== existing.is_active
          ? (validatedData.is_active ? 'ENABLE' : 'DISABLE')
          : 'UPDATE',
        entity_type: 'CUSTOMER_SEGMENT',
        entity_id: id,
        entity_name: updatedSegment.name,
        old_value: existing,
        new_value: updatedSegment,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      data: updatedSegment,
      message: 'Segment updated successfully',
    })

  } catch (error) {
    apiLogger.error('Segment PUT error', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/superadmin/customer-management/segments/[id]
 * Delete segment
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const auth = await verifyUnifiedAuth(request)
    if (!auth.authorized || !auth.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get existing segment
    const { data: existing } = await supabaseAdmin
      .from('customer_segments')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Delete segment members first
    await supabaseAdmin
      .from('segment_members')
      .delete()
      .eq('segment_id', id)

    // Delete segment
    const { error: deleteError } = await supabaseAdmin
      .from('customer_segments')
      .delete()
      .eq('id', id)

    if (deleteError) {
      apiLogger.error('Error deleting segment', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete segment' },
        { status: 500 }
      )
    }

    // Log to audit
    await supabaseAdmin
      .from('config_audit_log')
      .insert({
        action: 'DELETE',
        entity_type: 'CUSTOMER_SEGMENT',
        entity_id: id,
        entity_name: existing.name,
        old_value: existing,
        new_value: null,
        changed_by: auth.userId,
        changed_by_email: auth.email,
      })

    return NextResponse.json({
      success: true,
      message: 'Segment deleted successfully',
    })

  } catch (error) {
    apiLogger.error('Segment DELETE error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
