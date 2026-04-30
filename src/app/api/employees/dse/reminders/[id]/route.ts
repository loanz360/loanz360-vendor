import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'


const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PUT - Update a reminder (complete or snooze)
 * Frontend sends: { status: 'Completed' } or { status: 'Snoozed', snoozed_until: ISO string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid reminder ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const bodySchema = z.object({


      status: z.string().optional(),


      snoozed_until: z.string(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { status, snoozed_until } = body

    if (!status || !['Completed', 'Snoozed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be "Completed" or "Snoozed".' },
        { status: 400 }
      )
    }

    // Build the update payload
    const updateData: Record<string, unknown> = { status }

    if (status === 'Completed') {
      updateData.completed_at = new Date().toISOString()
    }

    if (status === 'Snoozed') {
      if (!snoozed_until) {
        return NextResponse.json(
          { success: false, error: 'snoozed_until is required when snoozing a reminder' },
          { status: 400 }
        )
      }
      const snoozeDate = new Date(snoozed_until)
      if (isNaN(snoozeDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'snoozed_until must be a valid ISO date string' },
          { status: 400 }
        )
      }
      // Update the reminder_datetime and reminder_date to the snooze time
      updateData.reminder_datetime = snoozed_until
      updateData.reminder_date = snoozeDate.toISOString().split('T')[0]
      updateData.reminder_time = snoozeDate.toTimeString().split(' ')[0]
    }

    // Update the reminder, filtering by both id and owner_id for security
    const { data: reminder, error: updateError } = await supabase
      .from('dse_reminders')
      .update(updateData)
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Error updating reminder', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update reminder' }, { status: 500 })
    }

    if (!reminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found or access denied' },
        { status: 404 }
      )
    }

    // Create audit log
    const actionLabel = status === 'Completed' ? 'ReminderCompleted' : 'ReminderSnoozed'
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Reminder',
      entity_id: reminder.id,
      action: actionLabel,
      new_values: updateData,
      user_id: user.id,
      changes_summary: status === 'Completed'
        ? `Completed reminder: ${reminder.title}`
        : `Snoozed reminder until ${snoozed_until}: ${reminder.title}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for reminder update', auditError)
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: status === 'Completed' ? 'Reminder completed' : 'Reminder snoozed'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
