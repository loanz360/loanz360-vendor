import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Helper function to verify Digital Sales access
 */
async function verifyDigitalSalesAccess(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile?.subrole?.toUpperCase() === 'DIGITAL_SALES') {
    return true
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  return userProfile?.sub_role?.toUpperCase() === 'DIGITAL_SALES'
}

/**
 * GET /api/employees/digital-sales/schedule/reminders/[id]
 * Retrieves a specific reminder
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    const { data: reminder, error } = await supabase
      .from('ds_reminders')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage),
        meeting:ds_meetings(id, title, scheduled_date, start_time, meeting_type),
        task:ds_tasks(id, title, due_date, status, priority)
      `)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error || !reminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: reminder
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/digital-sales/schedule/reminders/[id]
 * Updates a specific reminder
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    // Verify reminder belongs to user
    const { data: existingReminder } = await supabase
      .from('ds_reminders')
      .select('id, sales_executive_id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingReminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      )
    }

    // Update reminder
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    }

    // Remove fields that shouldn't be updated
    delete updateData.id
    delete updateData.sales_executive_id
    delete updateData.created_at

    const { data: reminder, error } = await supabase
      .from('ds_reminders')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/employees/digital-sales/schedule/reminders/[id]
 * Quick actions: acknowledge, dismiss, snooze
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { action, snooze_minutes } = body

    // Verify reminder belongs to user
    const { data: existingReminder } = await supabase
      .from('ds_reminders')
      .select('*')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingReminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      )
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    }

    switch (action) {
      case 'acknowledge':
        updateData.status = 'ACKNOWLEDGED'
        updateData.acknowledged_at = new Date().toISOString()
        break

      case 'dismiss':
        updateData.status = 'DISMISSED'
        updateData.dismissed_at = new Date().toISOString()
        break

      case 'snooze':
        const snoozeMinutes = snooze_minutes || 15
        const newRemindAt = new Date(Date.now() + snoozeMinutes * 60 * 1000)
        updateData.remind_at = newRemindAt.toISOString()
        updateData.snooze_until = newRemindAt.toISOString()
        updateData.snoozed_count = (existingReminder.snoozed_count || 0) + 1
        updateData.status = 'PENDING' // Reset to pending for new reminder time
        break

      case 'mark_sent':
        updateData.status = 'SENT'
        updateData.sent_at = new Date().toISOString()
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: acknowledge, dismiss, snooze, or mark_sent' },
          { status: 400 }
        )
    }

    const { data: reminder, error } = await supabase
      .from('ds_reminders')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: `Reminder ${action}ed successfully`
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/digital-sales/schedule/reminders/[id]
 * Soft deletes a specific reminder
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    // Soft delete reminder
    const { error } = await supabase
      .from('ds_reminders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Reminder deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
