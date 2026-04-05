import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createScheduleSchema,
  scheduleQueryParamsSchema
} from '@/lib/validations/schedule.validation'
import type { ScheduleWithDetails } from '@/lib/types/schedule.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * Helper function to verify user authorization
 * All active employees can access the schedule feature
 */
async function verifyUserAuthorization(supabase: any, userId: string): Promise<boolean> {
  // Check employee_profile first
  const { data: profile } = await supabase
    .from('employee_profile')
    .select('subrole, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile) {
    const userStatus = profile.status?.toUpperCase() || ''
    return userStatus === 'ACTIVE'
  }

  // Fallback to users table
  const { data: userProfile } = await supabase
    .from('users')
    .select('role, sub_role')
    .eq('id', userId)
    .maybeSingle()

  if (userProfile) {
    const userRole = userProfile.role?.toUpperCase()
    return userRole === 'EMPLOYEE'
  }

  return false
}

/**
 * GET /api/schedule
 * Retrieves schedules for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - status: Filter by meeting status
 * - meeting_type: Filter by meeting type
 * - schedule_category: Filter by category (PARTNER_MEETING, CUSTOMER_MEETING, etc.)
 * - partner_type: Filter by partner type (BUSINESS_ASSOCIATE, BUSINESS_PARTNER, etc.)
 * - partner_id: Filter by specific partner
 * - customer_id: Filter by specific customer
 * - date_from: Start date filter
 * - date_to: End date filter
 * - is_virtual: Filter virtual/in-person meetings
 * - requires_follow_up: Filter meetings needing follow-up
 * - search: Search in title/description/participant name
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sort_by: Sort field (default: scheduled_date)
 * - sort_order: asc or desc (default: asc)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user authorization
    const isAuthorized = await verifyUserAuthorization(supabase, user.id)
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Channel Partner Executives and Managers.' },
        { status: 403 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sort_by: searchParams.get('sort_by') || 'scheduled_date',
      sort_order: searchParams.get('sort_order') || 'asc',
      status: searchParams.get('status') || undefined,
      meeting_type: searchParams.get('meeting_type') || undefined,
      schedule_category: searchParams.get('schedule_category') || undefined,
      partner_type: searchParams.get('partner_type') || undefined,
      partner_id: searchParams.get('partner_id') || undefined,
      customer_id: searchParams.get('customer_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      is_virtual:
        searchParams.get('is_virtual') === 'true'
          ? true
          : searchParams.get('is_virtual') === 'false'
          ? false
          : undefined,
      requires_follow_up:
        searchParams.get('requires_follow_up') === 'true'
          ? true
          : searchParams.get('requires_follow_up') === 'false'
          ? false
          : undefined,
      search: searchParams.get('search') || undefined
    }

    // Validate query params
    const validatedParams = scheduleQueryParamsSchema.parse(queryParams)

    // Build query
    let query = supabase
      .from('meetings')
      .select(
        `
        *,
        customer:customers(full_name, email, phone),
        partner:partners(full_name, email, phone, company_name),
        notes:meeting_notes(count),
        reminders:meeting_reminders(count)
      `,
        { count: 'exact' }
      )
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status)
    }

    if (validatedParams.meeting_type) {
      query = query.eq('meeting_type', validatedParams.meeting_type)
    }

    if (validatedParams.schedule_category) {
      query = query.eq('schedule_category', validatedParams.schedule_category)
    }

    if (validatedParams.partner_type) {
      query = query.eq('partner_type', validatedParams.partner_type)
    }

    if (validatedParams.partner_id) {
      query = query.eq('partner_id', validatedParams.partner_id)
    }

    if (validatedParams.customer_id) {
      query = query.eq('customer_id', validatedParams.customer_id)
    }

    if (validatedParams.date_from) {
      query = query.gte('scheduled_date', validatedParams.date_from)
    }

    if (validatedParams.date_to) {
      query = query.lte('scheduled_date', validatedParams.date_to)
    }

    if (validatedParams.is_virtual !== undefined) {
      query = query.eq('is_virtual', validatedParams.is_virtual)
    }

    if (validatedParams.requires_follow_up !== undefined) {
      query = query.eq('requires_follow_up', validatedParams.requires_follow_up)
    }

    if (validatedParams.search) {
      query = query.or(
        `title.ilike.%${validatedParams.search}%,description.ilike.%${validatedParams.search}%,participant_name.ilike.%${validatedParams.search}%`
      )
    }

    // Apply sorting
    query = query.order(validatedParams.sort_by as any, {
      ascending: validatedParams.sort_order === 'asc'
    })

    // Apply pagination
    const from = (validatedParams.page - 1) * validatedParams.limit
    const to = from + validatedParams.limit - 1
    query = query.range(from, to)

    // Execute query
    const { data: schedules, error: queryError, count } = await query

    if (queryError) {
      apiLogger.error('Error fetching schedules', queryError)

      // Check if the error is because the table doesn't exist
      if (queryError.message?.includes('relation') && queryError.message?.includes('does not exist')) {
        return NextResponse.json({
          schedules: [],
          total: 0,
          page: validatedParams.page,
          limit: validatedParams.limit,
          total_pages: 0,
          message: 'Schedule feature is being set up. Please run database migrations.'
        })
      }

      return NextResponse.json({ success: false, error: 'Failed to fetch schedules' }, { status: 500 })
    }

    // Transform data to include participant details
    const schedulesWithDetails: ScheduleWithDetails[] = (schedules || []).map((schedule: any) => ({
      ...schedule,
      // Partner details
      partner_email: schedule.partner?.email,
      partner_phone: schedule.partner?.phone,
      partner_company: schedule.partner?.company_name,
      // Customer details
      customer_email: schedule.customer?.email,
      customer_phone: schedule.customer?.phone,
      // Use cached participant_name or fetch from related table
      participant_name:
        schedule.participant_name ||
        schedule.partner?.full_name ||
        schedule.customer?.full_name,
      // Counts
      notes_count: schedule.notes?.[0]?.count || 0,
      reminders_count: schedule.reminders?.[0]?.count || 0
    }))

    return NextResponse.json({
      schedules: schedulesWithDetails,
      total: count || 0,
      page: validatedParams.page,
      limit: validatedParams.limit,
      total_pages: Math.ceil((count || 0) / validatedParams.limit)
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/schedule', error)

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schedule
 * Creates a new schedule
 *
 * Request Body:
 * - participant_type: 'PARTNER' | 'CUSTOMER' (required)
 * - partner_id: UUID (required if participant_type is PARTNER)
 * - partner_type: PartnerType (required if participant_type is PARTNER)
 * - customer_id: UUID (required if participant_type is CUSTOMER)
 * - title: string (required)
 * - description: string (optional)
 * - meeting_type: MeetingType (required)
 * - scheduled_date: ISO string (required)
 * - scheduled_end_date: ISO string (optional)
 * - duration_minutes: number (optional, default: 60)
 * - location: string (optional)
 * - is_virtual: boolean (optional, default: false)
 * - meeting_link: string (optional)
 * - attendees: array (optional)
 * - initial_notes: string (optional)
 * - set_reminders: boolean (optional, default: true)
 * - reminder_times: string[] (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user authorization
    const isAuthorized = await verifyUserAuthorization(supabase, user.id)
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Access denied. This feature is only available for Channel Partner Executives and Managers.' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()

    // Validate request body
    const validatedData = createScheduleSchema.parse(body)

    // Check for schedule conflicts
    const { data: hasConflict } = await supabase.rpc('check_schedule_conflict', {
      p_user_id: user.id,
      p_scheduled_date: validatedData.scheduled_date,
      p_duration_minutes: validatedData.duration_minutes
    })

    if (hasConflict) {
      return NextResponse.json(
        {
          error: 'Schedule conflict detected',
          message:
            'You already have a meeting scheduled at this time. Please choose a different time.'
        },
        { status: 409 }
      )
    }

    // Prepare schedule data
    const scheduleData = {
      sales_executive_id: user.id,
      partner_id: validatedData.participant_type === 'PARTNER' ? validatedData.partner_id : null,
      customer_id:
        validatedData.participant_type === 'CUSTOMER' ? validatedData.customer_id : null,
      partner_type: validatedData.partner_type || null,
      title: validatedData.title,
      description: validatedData.description || null,
      meeting_type: validatedData.meeting_type,
      status: 'SCHEDULED' as const,
      scheduled_date: validatedData.scheduled_date,
      scheduled_end_date: validatedData.scheduled_end_date || null,
      duration_minutes: validatedData.duration_minutes,
      location: validatedData.location || null,
      is_virtual: validatedData.is_virtual,
      meeting_link: validatedData.meeting_link || null,
      attendees: validatedData.attendees || []
    }

    // Insert schedule
    const { data: schedule, error: insertError } = await supabase
      .from('meetings')
      .insert(scheduleData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating schedule', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create schedule' }, { status: 500 })
    }

    // Add initial notes if provided
    if (validatedData.initial_notes && schedule) {
      await supabase.from('meeting_notes').insert({
        meeting_id: schedule.id,
        created_by: user.id,
        note_content: validatedData.initial_notes,
        note_type: 'GENERAL',
        is_private: false
      })
    }

    // Create reminders if requested
    if (validatedData.set_reminders && schedule) {
      const scheduledDate = new Date(validatedData.scheduled_date)

      // Default reminders: 1 day before and 1 hour before
      const defaultReminderTimes = [
        new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        new Date(scheduledDate.getTime() - 60 * 60 * 1000) // 1 hour before
      ]

      const reminderTimes =
        validatedData.reminder_times && validatedData.reminder_times.length > 0
          ? validatedData.reminder_times.map((t) => new Date(t))
          : defaultReminderTimes

      const reminders = reminderTimes
        .filter((time) => time > new Date()) // Only future reminders
        .map((time) => ({
          meeting_id: schedule.id,
          user_id: user.id,
          reminder_title: `Upcoming: ${validatedData.title}`,
          reminder_message: `You have a meeting scheduled with ${schedule.participant_name || 'a participant'} at ${scheduledDate.toLocaleString()}`,
          remind_at: time.toISOString(),
          frequency: 'ONCE' as const,
          status: 'PENDING' as const,
          send_email: true,
          send_push: true,
          send_sms: false
        }))

      if (reminders.length > 0) {
        await supabase.from('meeting_reminders').insert(reminders)
      }
    }

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/schedule', error)

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
