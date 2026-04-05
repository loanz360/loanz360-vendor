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
 * GET /api/employees/tele-sales/schedule/reminders/[id]
 * Retrieves a specific reminder by ID
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

    const { data: reminder, error } = await supabase
      .from('ts_reminders')
      .select('*')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data: reminder
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/tele-sales/schedule/reminders/[id]
 * Updates a specific reminder
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
      .from('ts_reminders')
      .select('id, sales_executive_id, snoozed_count')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Reminder not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, any> = {}
    const allowedFields = [
      'title', 'message', 'remind_at', 'frequency', 'status',
      'send_in_app', 'send_email', 'send_push', 'send_sms',
      'snooze_until'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle special status updates
    if (body.status === 'ACKNOWLEDGED') {
      updateData.acknowledged_at = new Date().toISOString()
    }
    if (body.status === 'DISMISSED') {
      updateData.dismissed_at = new Date().toISOString()
    }
    if (body.status === 'SNOOZED' && body.snooze_until) {
      updateData.snooze_until = body.snooze_until
      updateData.snoozed_count = (existing.snoozed_count || 0) + 1
    }

    const { data: reminder, error } = await supabase
      .from('ts_reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating TeleSales reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/tele-sales/schedule/reminders/[id]
 * Soft deletes a reminder
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

    const { error } = await supabase
      .from('ts_reminders')
      .update({
        is_deleted: true
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Reminder deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting TeleSales reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
