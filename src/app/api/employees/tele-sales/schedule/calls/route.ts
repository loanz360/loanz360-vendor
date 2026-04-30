import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


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
 * GET /api/employees/tele-sales/schedule/calls
 * Retrieves calls for the TeleSales executive
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
    const type = searchParams.get('type') || 'upcoming' // upcoming, today, history
    const status = searchParams.get('status')
    const callType = searchParams.get('call_type')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    let query = supabase
      .from('ts_calls')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage, loan_type, loan_amount)
      `, { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply type filter
    if (type === 'upcoming') {
      query = query
        .gte('scheduled_date', today)
        .in('status', ['SCHEDULED', 'CALLBACK_REQUESTED', 'RESCHEDULED'])
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
    } else if (type === 'today') {
      query = query
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true })
    } else if (type === 'history') {
      query = query
        .or(`scheduled_date.lt.${today},status.in.(COMPLETED,CANCELLED,NO_ANSWER,BUSY,VOICEMAIL)`)
        .order('scheduled_date', { ascending: false })
        .order('scheduled_time', { ascending: false })
    }

    // Apply additional filters
    if (status) {
      query = query.eq('status', status)
    }
    if (callType) {
      query = query.eq('call_type', callType)
    }
    if (dateFrom) {
      query = query.gte('scheduled_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('scheduled_date', dateTo)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: calls, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: calls || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales calls', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/tele-sales/schedule/calls
 * Creates a new call for the TeleSales executive
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

    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.scheduled_date || !body.scheduled_time) {
      return NextResponse.json(
        { success: false, error: 'Title, scheduled date, and scheduled time are required' },
        { status: 400 }
      )
    }

    // Get lead details if lead_id provided
    let leadDetails: any = {}
    if (body.lead_id) {
      const { data: lead } = await supabase
        .from('online_leads')
        .select('customer_name, mobile, email, lead_stage, lead_source, loan_type, loan_amount')
        .eq('id', body.lead_id)
        .maybeSingle()

      if (lead) {
        leadDetails = {
          lead_name: lead.customer_name,
          contact_name: lead.customer_name,
          contact_phone: lead.mobile,
          contact_email: lead.email,
          lead_stage: lead.lead_stage,
          lead_source: lead.lead_source,
          loan_type: lead.loan_type,
          loan_amount: lead.loan_amount
        }
      }
    }

    const callData = {
      sales_executive_id: user.id,
      lead_id: body.lead_id || null,
      title: body.title,
      description: body.description || null,
      call_type: body.call_type || 'OUTBOUND',
      call_purpose: body.call_purpose || 'FOLLOW_UP',
      status: 'SCHEDULED',
      scheduled_date: body.scheduled_date,
      scheduled_time: body.scheduled_time,
      duration_minutes: body.duration_minutes || 15,
      contact_name: body.contact_name || leadDetails.contact_name || null,
      contact_phone: body.contact_phone || leadDetails.contact_phone || null,
      contact_email: body.contact_email || leadDetails.contact_email || null,
      ...leadDetails
    }

    const { data: call, error } = await supabase
      .from('ts_calls')
      .insert(callData)
      .select()
      .maybeSingle()

    if (error) throw error

    // Create reminder if requested
    if (body.set_reminder && body.reminder_minutes_before) {
      const callDateTime = new Date(`${body.scheduled_date}T${body.scheduled_time}`)
      const reminderTime = new Date(callDateTime.getTime() - body.reminder_minutes_before * 60000)

      await supabase
        .from('ts_reminders')
        .insert({
          sales_executive_id: user.id,
          call_id: call.id,
          lead_id: body.lead_id || null,
          title: `Call Reminder: ${body.title}`,
          message: `Scheduled call with ${leadDetails.contact_name || body.contact_name || 'Lead'} in ${body.reminder_minutes_before} minutes`,
          reminder_type: 'CALL_REMINDER',
          remind_at: reminderTime.toISOString(),
          frequency: 'ONCE',
          status: 'PENDING',
          send_in_app: true,
          lead_name: leadDetails.lead_name || null,
          call_title: body.title
        })
    }

    return NextResponse.json({
      success: true,
      data: call,
      message: 'Call scheduled successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    apiLogger.error('Error creating TeleSales call', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
