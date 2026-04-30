import { parseBody } from '@/lib/utils/parse-body'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { verifyDSERole } from '@/lib/auth/verify-dse-role'
import { verifyDSEAuth } from '@/lib/auth/dse-auth'
import { validatePagination } from '@/lib/validations/dse-validation'


// HH:mm format regex
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

// Validation schema for meetings
const meetingSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  meeting_type: z.enum([
    'In Person', 'Phone Call', 'Video Call', 'Virtual Meeting', 'Site Visit'
  ]).default('In Person'),
  meeting_purpose: z.enum([
    'Introduction', 'Product Demo', 'Proposal Discussion', 'Negotiation',
    'Document Collection', 'Contract Signing', 'Review', 'Follow-up', 'Other'
  ]).optional().nullable(),
  scheduled_date: z.string().refine((val) => {
    const d = new Date(val)
    return !isNaN(d.getTime())
  }, { message: 'scheduled_date must be a valid ISO date string' }),
  start_time: z.string().refine((val) => TIME_REGEX.test(val), {
    message: 'start_time must be in HH:mm format (e.g., 09:30)'
  }),
  end_time: z.string().optional().nullable(),
  duration_minutes: z.number().optional().nullable(),
  timezone: z.string().default('Asia/Kolkata'),
  location_type: z.enum(['Customer Office', 'Our Office', 'Virtual', 'Other']).optional().nullable(),
  location_address: z.string().optional().nullable(),
  location_latitude: z.number().optional().nullable(),
  location_longitude: z.number().optional().nullable(),
  virtual_meeting_link: z.string().url().optional().nullable(),
  virtual_meeting_provider: z.string().optional().nullable(),
  attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    role: z.string().optional(),
    rsvp_status: z.enum(['pending', 'accepted', 'declined', 'tentative']).optional()
  })).optional().nullable(),
  external_attendees: z.array(z.object({
    name: z.string(),
    email: z.string().email().optional(),
    company: z.string().optional()
  })).optional().nullable(),
  agenda_document_url: z.string().url().optional().nullable(),
})

// GET - List meetings
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const leadId = searchParams.get('leadId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const upcoming = searchParams.get('upcoming') === 'true'
    const { page, limit, offset } = validatePagination(searchParams.get('page'), searchParams.get('limit'))

    let query = supabase
      .from('dse_meetings')
      .select('*, dse_customers(full_name, company_name), dse_leads(customer_name, lead_stage)', { count: 'exact' })
      .eq('organizer_id', user.id)
      .order('scheduled_date', { ascending: upcoming })
      .order('start_time', { ascending: true })

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (leadId) {
      query = query.eq('lead_id', leadId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (upcoming) {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('scheduled_date', today)
        .in('status', ['Scheduled', 'Confirmed'])
    }

    if (dateFrom) {
      const parsedFrom = new Date(dateFrom)
      if (!isNaN(parsedFrom.getTime())) {
        query = query.gte('scheduled_date', dateFrom)
      }
    }

    if (dateTo) {
      const parsedTo = new Date(dateTo)
      if (!isNaN(parsedTo.getTime())) {
        query = query.lte('scheduled_date', dateTo)
      }
    }

    query = query.range(offset, offset + limit - 1)

    const { data: meetings, error, count } = await query

    if (error) throw error

    // Get today's meetings count
    const today = new Date().toISOString().split('T')[0]
    const { count: todayCount } = await supabase
      .from('dse_meetings')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', user.id)
      .eq('scheduled_date', today)
      .in('status', ['Scheduled', 'Confirmed'])

    // Get this week's meetings count
    const weekEnd = new Date()
    weekEnd.setDate(weekEnd.getDate() + 7)
    const { count: weekCount } = await supabase
      .from('dse_meetings')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', user.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', weekEnd.toISOString().split('T')[0])
      .in('status', ['Scheduled', 'Confirmed'])

    return NextResponse.json({
      success: true,
      data: {
        meetings,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats: {
          todayCount: todayCount || 0,
          thisWeekCount: weekCount || 0
        }
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching meetings', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Schedule a meeting
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify DSE role
    const roleCheck = await verifyDSERole(supabase, user.id)
    if (!roleCheck.isValid) return roleCheck.response

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validatedData = meetingSchema.parse(body)

    // BUG-7 FIX: Server-side conflict validation before creating
    const calculatedEndTime = validatedData.end_time || (() => {
      const [h, m] = validatedData.start_time.split(':').map(Number)
      const totalMin = h * 60 + m + (validatedData.duration_minutes || 60)
      return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
    })()

    const { data: conflicts } = await supabase
      .from('dse_meetings')
      .select('id, title, start_time, end_time')
      .eq('organizer_id', user.id)
      .eq('scheduled_date', validatedData.scheduled_date)
      .in('status', ['Scheduled', 'Confirmed', 'In Progress'])
      .lt('start_time', calculatedEndTime)
      .gt('end_time', validatedData.start_time)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Time slot conflicts with existing meeting: "${conflicts[0].title}"`,
        code: 'SCHEDULE_CONFLICT',
        data: { conflicting_meetings: conflicts }
      }, { status: 409 })
    }

    // Verify ownership if customer_id or lead_id provided
    if (validatedData.customer_id) {
      const { data: customer, error } = await supabase
        .from('dse_customers')
        .select('dse_user_id, full_name')
        .eq('id', validatedData.customer_id)
        .maybeSingle()

      if (error || !customer || customer.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Customer not found or access denied' }, { status: 403 })
      }
    }

    if (validatedData.lead_id) {
      const { data: lead, error } = await supabase
        .from('dse_leads')
        .select('dse_user_id')
        .eq('id', validatedData.lead_id)
        .maybeSingle()

      if (error || !lead || lead.dse_user_id !== user.id) {
        return NextResponse.json({ success: false, error: 'Lead not found or access denied' }, { status: 403 })
      }
    }

    // Create meeting
    const { data: meeting, error: createError } = await supabase
      .from('dse_meetings')
      .insert({
        ...validatedData,
        organizer_id: user.id,
        status: 'Scheduled',
      })
      .select()
      .maybeSingle()

    if (createError) throw createError

    if (!meeting) {
      apiLogger.error('Meeting insert returned null despite no error')
      return NextResponse.json(
        { success: false, error: 'Failed to create meeting' },
        { status: 500 }
      )
    }

    // Create a reminder for the meeting
    const meetingDatetime = new Date(`${validatedData.scheduled_date}T${validatedData.start_time}`)
    const reminderTime = new Date(meetingDatetime.getTime() - 30 * 60 * 1000) // 30 mins before

    const { error: reminderError } = await supabase.from('dse_reminders').insert({
      meeting_id: meeting.id,  // Link reminder to meeting by ID
      customer_id: validatedData.customer_id,
      lead_id: validatedData.lead_id,
      owner_id: user.id,
      created_by: user.id,
      title: `Meeting: ${validatedData.title}`,
      description: validatedData.description,
      reminder_type: 'Meeting',
      reminder_datetime: reminderTime.toISOString(),
      reminder_date: reminderTime.toISOString().split('T')[0],
      reminder_time: reminderTime.toTimeString().split(' ')[0],
      priority: 'High',
      notify_before_minutes: 30,
    })

    if (reminderError) {
      apiLogger.error('Failed to create reminder for meeting', reminderError)
    }

    // Create audit log
    const { error: auditError } = await supabase.from('dse_audit_log').insert({
      entity_type: 'Meeting',
      entity_id: meeting.id,
      action: 'MeetingScheduled',
      new_values: meeting,
      user_id: user.id,
      changes_summary: `Scheduled meeting: ${validatedData.title}`
    })

    if (auditError) {
      apiLogger.error('Failed to create audit log for meeting scheduling', auditError)
    }

    return NextResponse.json({
      success: true,
      data: meeting,
      message: 'Meeting scheduled successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    apiLogger.error('Error scheduling meeting', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
