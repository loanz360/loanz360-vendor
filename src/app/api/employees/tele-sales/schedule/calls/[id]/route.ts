import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Verify user is TeleSales
 */
async function verifyTeleSalesUser(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  const isTeleSales = profile?.subrole?.toUpperCase().replace(/[\s-]/g, '_') === 'TELE_SALES'

  if (!isTeleSales) {
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, sub_role')
      .eq('id', userId)
      .maybeSingle()

    const normalizedSubRole = userProfile?.sub_role?.toUpperCase().replace(/[\s-]/g, '_')
    return normalizedSubRole === 'TELE_SALES'
  }

  return true
}

/**
 * GET /api/employees/tele-sales/schedule/calls/[id]
 * Retrieves a specific call by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const { data: call, error } = await supabase
      .from('ts_calls')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage, loan_type, loan_amount, address, city, state)
      `)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: call
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales call', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/tele-sales/schedule/calls/[id]
 * Updates a specific call
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const { data: existing } = await supabase
      .from('ts_calls')
      .select('id, sales_executive_id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Call not found' }, { status: 404 })
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, any> = {}
    const allowedFields = [
      'title', 'description', 'call_type', 'call_purpose', 'status',
      'scheduled_date', 'scheduled_time', 'duration_minutes',
      'actual_start_time', 'actual_end_time', 'actual_duration_seconds',
      'outcome', 'outcome_notes', 'call_disposition',
      'requires_follow_up', 'follow_up_date', 'follow_up_notes', 'next_action',
      'call_quality_score', 'customer_satisfaction',
      'contact_name', 'contact_phone', 'contact_email'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Auto-calculate duration if start and end times provided
    if (body.actual_start_time && body.actual_end_time) {
      const startTime = new Date(body.actual_start_time)
      const endTime = new Date(body.actual_end_time)
      updateData.actual_duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    }

    const { data: call, error } = await supabase
      .from('ts_calls')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    // Create callback task if follow-up required
    if (body.requires_follow_up && body.follow_up_date && body.status === 'COMPLETED') {
      await supabase
        .from('ts_tasks')
        .insert({
          sales_executive_id: user.id,
          call_id: id,
          lead_id: call.lead_id,
          title: `Follow-up: ${call.title}`,
          description: body.follow_up_notes || `Follow-up call for ${call.lead_name || call.contact_name || 'Lead'}`,
          category: 'CALLBACK',
          priority: 'HIGH',
          status: 'PENDING',
          due_date: body.follow_up_date,
          lead_name: call.lead_name,
          call_title: call.title
        })
    }

    return NextResponse.json({
      success: true,
      data: call,
      message: 'Call updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating TeleSales call', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/tele-sales/schedule/calls/[id]
 * Soft deletes a call
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyTeleSalesUser(supabase, user.id))) {
      return NextResponse.json(
        { success: false, error: 'Access denied. TeleSales executives only.' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Soft delete
    const { error } = await supabase
      .from('ts_calls')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Call deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting TeleSales call', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
