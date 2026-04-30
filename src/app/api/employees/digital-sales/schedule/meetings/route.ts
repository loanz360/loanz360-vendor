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

  // Fallback to users table
  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  return userProfile?.sub_role?.toUpperCase() === 'DIGITAL_SALES'
}

/**
 * GET /api/employees/digital-sales/schedule/meetings
 * Retrieves meetings for Digital Sales executive
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
        { success: false, error: 'Access denied. This feature is only available for Digital Sales executives.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const meeting_type = searchParams.get('meeting_type')
    const meeting_purpose = searchParams.get('meeting_purpose')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const lead_id = searchParams.get('lead_id')
    const search = searchParams.get('search')
    const sort_by = searchParams.get('sort_by') || 'scheduled_date'
    const sort_order = searchParams.get('sort_order') || 'desc'

    // Build query
    let query = supabase
      .from('ds_meetings')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage, loan_type)
      `, { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (status) {
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    if (meeting_type) {
      const types = meeting_type.split(',')
      query = query.in('meeting_type', types)
    }

    if (meeting_purpose) {
      const purposes = meeting_purpose.split(',')
      query = query.in('meeting_purpose', purposes)
    }

    if (date_from) {
      query = query.gte('scheduled_date', date_from)
    }

    if (date_to) {
      query = query.lte('scheduled_date', date_to)
    }

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,lead_name.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sort_order === 'asc'
    query = query.order(sort_by, { ascending })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: meetings, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        meetings: meetings || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales meetings', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/digital-sales/schedule/meetings
 * Creates a new meeting for Digital Sales executive
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
      lead_id,
      customer_id,
      title,
      description,
      meeting_type,
      meeting_purpose,
      scheduled_date,
      start_time,
      duration_minutes = 30,
      meeting_link,
      meeting_platform,
      attendees = [],
      set_reminder = false,
      reminder_minutes_before = 15
    } = body

    // Validate required fields
    if (!title || !scheduled_date || !start_time) {
      return NextResponse.json(
        { success: false, error: 'Title, scheduled date, and start time are required' },
        { status: 400 }
      )
    }

    // Calculate end time
    const [hours, minutes] = start_time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes + duration_minutes
    const endHours = Math.floor(totalMinutes / 60) % 24
    const endMinutes = totalMinutes % 60
    const end_time = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`

    // Get lead/customer details if provided
    let lead_name = null, lead_mobile = null, lead_email = null, lead_stage = null
    if (lead_id) {
      const { data: lead } = await supabase
        .from('online_leads')
        .select('customer_name, mobile, email, lead_stage')
        .eq('id', lead_id)
        .maybeSingle()

      if (lead) {
        lead_name = lead.customer_name
        lead_mobile = lead.mobile
        lead_email = lead.email
        lead_stage = lead.lead_stage
      }
    }

    // Create meeting
    const { data: meeting, error: createError } = await supabase
      .from('ds_meetings')
      .insert({
        sales_executive_id: user.id,
        lead_id,
        customer_id,
        title,
        description,
        meeting_type: meeting_type || 'VIDEO_CALL',
        meeting_purpose: meeting_purpose || 'DISCOVERY_CALL',
        status: 'SCHEDULED',
        scheduled_date,
        start_time,
        end_time,
        duration_minutes,
        is_virtual: true,
        meeting_link,
        meeting_platform,
        attendees,
        lead_name,
        lead_mobile,
        lead_email,
        lead_stage,
        requires_follow_up: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false
      })
      .select()
      .maybeSingle()

    if (createError) {
      throw createError
    }

    // Create reminder if requested
    if (set_reminder && meeting) {
      const meetingDateTime = new Date(`${scheduled_date}T${start_time}`)
      const reminderTime = new Date(meetingDateTime.getTime() - reminder_minutes_before * 60 * 1000)

      await supabase
        .from('ds_reminders')
        .insert({
          sales_executive_id: user.id,
          meeting_id: meeting.id,
          lead_id,
          title: `Reminder: ${title}`,
          message: `Your meeting "${title}" starts in ${reminder_minutes_before} minutes`,
          reminder_type: 'MEETING_REMINDER',
          remind_at: reminderTime.toISOString(),
          frequency: 'ONCE',
          status: 'PENDING',
          send_in_app: true,
          send_email: true,
          send_push: true,
          send_sms: false,
          snoozed_count: 0,
          lead_name,
          meeting_title: title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false
        })
    }

    return NextResponse.json({
      success: true,
      data: meeting,
      message: 'Meeting scheduled successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error creating Digital Sales meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
