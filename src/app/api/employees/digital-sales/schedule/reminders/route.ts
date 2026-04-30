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
 * GET /api/employees/digital-sales/schedule/reminders
 * Retrieves reminders for Digital Sales executive
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

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const reminder_type = searchParams.get('reminder_type')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const meeting_id = searchParams.get('meeting_id')
    const task_id = searchParams.get('task_id')
    const lead_id = searchParams.get('lead_id')
    const search = searchParams.get('search')
    const sort_by = searchParams.get('sort_by') || 'remind_at'
    const sort_order = searchParams.get('sort_order') || 'asc'

    // Build query
    let query = supabase
      .from('ds_reminders')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email),
        meeting:ds_meetings(id, title, scheduled_date, start_time),
        task:ds_tasks(id, title, due_date)
      `, { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (status) {
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    if (reminder_type) {
      const types = reminder_type.split(',')
      query = query.in('reminder_type', types)
    }

    if (date_from) {
      query = query.gte('remind_at', date_from)
    }

    if (date_to) {
      query = query.lte('remind_at', date_to)
    }

    if (meeting_id) {
      query = query.eq('meeting_id', meeting_id)
    }

    if (task_id) {
      query = query.eq('task_id', task_id)
    }

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sort_order === 'asc'
    query = query.order(sort_by, { ascending })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: reminders, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        reminders: reminders || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales reminders', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/digital-sales/schedule/reminders
 * Creates a new reminder for Digital Sales executive
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

    const hasAccess = await verifyDigitalSalesAccess(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      message,
      reminder_type = 'CUSTOM',
      remind_at,
      frequency = 'ONCE',
      lead_id,
      customer_id,
      meeting_id,
      task_id,
      send_in_app = true,
      send_email = true,
      send_push = true,
      send_sms = false
    } = body

    // Validate required fields
    if (!title || !remind_at) {
      return NextResponse.json(
        { success: false, error: 'Title and reminder time are required' },
        { status: 400 }
      )
    }

    // Get linked entity names
    let lead_name = null, customer_name = null, meeting_title = null, task_title = null

    if (lead_id) {
      const { data: lead } = await supabase
        .from('online_leads')
        .select('customer_name')
        .eq('id', lead_id)
        .maybeSingle()
      lead_name = lead?.customer_name
    }

    if (meeting_id) {
      const { data: meeting } = await supabase
        .from('ds_meetings')
        .select('title')
        .eq('id', meeting_id)
        .maybeSingle()
      meeting_title = meeting?.title
    }

    if (task_id) {
      const { data: task } = await supabase
        .from('ds_tasks')
        .select('title')
        .eq('id', task_id)
        .maybeSingle()
      task_title = task?.title
    }

    // Create reminder
    const { data: reminder, error: createError } = await supabase
      .from('ds_reminders')
      .insert({
        sales_executive_id: user.id,
        lead_id,
        customer_id,
        meeting_id,
        task_id,
        title,
        message,
        reminder_type,
        remind_at,
        frequency,
        status: 'PENDING',
        send_in_app,
        send_email,
        send_push,
        send_sms,
        snoozed_count: 0,
        lead_name,
        customer_name,
        meeting_title,
        task_title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      })
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder created successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error creating Digital Sales reminder', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
