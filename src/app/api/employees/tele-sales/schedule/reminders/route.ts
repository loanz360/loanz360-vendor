import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Verify user is TeleSales
 */
async function verifyTeleSalesUser(supabase: unknown, userId: string) {
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
 * GET /api/employees/tele-sales/schedule/reminders
 * Retrieves reminders for the TeleSales executive
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const reminderType = searchParams.get('reminder_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('ts_reminders')
      .select('*', { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    } else {
      // Default to pending reminders
      query = query.eq('status', 'PENDING')
    }
    if (reminderType) {
      query = query.eq('reminder_type', reminderType)
    }
    if (dateFrom) {
      query = query.gte('remind_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('remind_at', `${dateTo}T23:59:59`)
    }

    query = query
      .order('remind_at', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: reminders, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: reminders || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/tele-sales/schedule/reminders
 * Creates a new reminder for the TeleSales executive
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
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

    const bodySchema = z.object({


      title: z.string().optional(),


      remind_at: z.string().optional(),


      lead_id: z.string().uuid().optional(),


      call_id: z.string().uuid().optional(),


      task_id: z.string().uuid().optional(),


      message: z.string().optional(),


      reminder_type: z.string().optional(),


      frequency: z.string().optional(),


      send_in_app: z.string().optional(),


      send_email: z.string().email().optional(),


      send_push: z.string().optional(),


      send_sms: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Validate required fields
    if (!body.title || !body.remind_at) {
      return NextResponse.json(
        { success: false, error: 'Title and remind_at are required' },
        { status: 400 }
      )
    }

    // Get linked entity names
    let leadName = null
    let callTitle = null
    let taskTitle = null

    if (body.lead_id) {
      const { data: lead } = await supabase
        .from('online_leads')
        .select('customer_name')
        .eq('id', body.lead_id)
        .maybeSingle()
      leadName = lead?.customer_name
    }

    if (body.call_id) {
      const { data: call } = await supabase
        .from('ts_calls')
        .select('title')
        .eq('id', body.call_id)
        .maybeSingle()
      callTitle = call?.title
    }

    if (body.task_id) {
      const { data: task } = await supabase
        .from('ts_tasks')
        .select('title')
        .eq('id', body.task_id)
        .maybeSingle()
      taskTitle = task?.title
    }

    const reminderData = {
      sales_executive_id: user.id,
      lead_id: body.lead_id || null,
      call_id: body.call_id || null,
      task_id: body.task_id || null,
      title: body.title,
      message: body.message || null,
      reminder_type: body.reminder_type || 'CUSTOM',
      remind_at: body.remind_at,
      frequency: body.frequency || 'ONCE',
      status: 'PENDING',
      send_in_app: body.send_in_app !== false,
      send_email: body.send_email || false,
      send_push: body.send_push || false,
      send_sms: body.send_sms || false,
      snoozed_count: 0,
      lead_name: leadName,
      call_title: callTitle,
      task_title: taskTitle
    }

    const { data: reminder, error } = await supabase
      .from('ts_reminders')
      .insert(reminderData)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    apiLogger.error('Error creating TeleSales reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
