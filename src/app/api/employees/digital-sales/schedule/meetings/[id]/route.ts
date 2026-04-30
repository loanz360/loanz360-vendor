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
 * GET /api/employees/digital-sales/schedule/meetings/[id]
 * Retrieves a specific meeting
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

    const { data: meeting, error } = await supabase
      .from('ds_meetings')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage, loan_type, loan_amount)
      `)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error || !meeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Get meeting notes
    const { data: notes } = await supabase
      .from('ds_meeting_notes')
      .select('*')
      .eq('meeting_id', id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    // Get meeting reminders
    const { data: reminders } = await supabase
      .from('ds_reminders')
      .select('*')
      .eq('meeting_id', id)
      .eq('is_deleted', false)
      .order('remind_at', { ascending: true })

    // Get linked tasks
    const { data: tasks } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('meeting_id', id)
      .eq('is_deleted', false)
      .order('due_date', { ascending: true })

    return NextResponse.json({
      success: true,
      data: {
        ...meeting,
        notes: notes || [],
        reminders: reminders || [],
        tasks: tasks || []
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/digital-sales/schedule/meetings/[id]
 * Updates a specific meeting
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

    // Verify meeting belongs to user
    const { data: existingMeeting } = await supabase
      .from('ds_meetings')
      .select('id, sales_executive_id')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingMeeting) {
      return NextResponse.json(
        { success: false, error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Calculate end time if start_time or duration changes
    let end_time = body.end_time
    if (body.start_time && body.duration_minutes) {
      const [hours, minutes] = body.start_time.split(':').map(Number)
      const totalMinutes = hours * 60 + minutes + body.duration_minutes
      const endHours = Math.floor(totalMinutes / 60) % 24
      const endMinutes = totalMinutes % 60
      end_time = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
    }

    // Update meeting
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    }

    if (end_time) {
      updateData.end_time = end_time
    }

    // Remove fields that shouldn't be updated
    delete updateData.id
    delete updateData.sales_executive_id
    delete updateData.created_at

    const { data: meeting, error } = await supabase
      .from('ds_meetings')
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
      data: meeting,
      message: 'Meeting updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/digital-sales/schedule/meetings/[id]
 * Soft deletes a specific meeting
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

    // Soft delete meeting
    const { error } = await supabase
      .from('ds_meetings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) {
      throw error
    }

    // Also delete related reminders
    await supabase
      .from('ds_reminders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('meeting_id', id)

    return NextResponse.json({
      success: true,
      message: 'Meeting deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
