import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MeetingsQueryParams, MeetingWithDetails } from '@/lib/types/meetings.types'
import { apiLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings
 * Retrieves meetings for the authenticated user with optional filtering
 *
 * Query Parameters:
 * - status: Filter by meeting status
 * - meeting_type: Filter by meeting type
 * - customer_id: Filter by customer
 * - date_from: Start date filter
 * - date_to: End date filter
 * - is_virtual: Filter virtual/in-person meetings
 * - requires_follow_up: Filter meetings needing follow-up
 * - search: Search in title/description
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - sort_by: Sort field (default: scheduled_date)
 * - sort_order: asc or desc (default: desc)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort_by = searchParams.get('sort_by') || 'scheduled_date'
    const sort_order = searchParams.get('sort_order') || 'desc'

    const filters: MeetingsQueryParams = {
      status: searchParams.get('status') as any,
      meeting_type: searchParams.get('meeting_type') as any,
      customer_id: searchParams.get('customer_id') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      is_virtual: searchParams.get('is_virtual')
        ? searchParams.get('is_virtual') === 'true'
        : undefined,
      requires_follow_up: searchParams.get('requires_follow_up')
        ? searchParams.get('requires_follow_up') === 'true'
        : undefined,
      search: searchParams.get('search') || undefined
    }

    // Build query
    let query = supabase
      .from('meetings')
      .select(
        `
        *,
        customer:customers(full_name, email, phone),
        notes:meeting_notes(count),
        reminders:meeting_reminders(count)
      `,
        { count: 'exact' }
      )
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.meeting_type) {
      query = query.eq('meeting_type', filters.meeting_type)
    }

    if (filters.customer_id) {
      query = query.eq('customer_id', filters.customer_id)
    }

    if (filters.date_from) {
      query = query.gte('scheduled_date', filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte('scheduled_date', filters.date_to)
    }

    if (filters.is_virtual !== undefined) {
      query = query.eq('is_virtual', filters.is_virtual)
    }

    if (filters.requires_follow_up !== undefined) {
      query = query.eq('requires_follow_up', filters.requires_follow_up)
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Apply sorting
    query = query.order(sort_by as any, { ascending: sort_order === 'asc' })

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Execute query
    const { data: meetings, error: queryError, count } = await query

    if (queryError) {
      apiLogger.error('Error fetching meetings', queryError)
      return NextResponse.json({ success: false, error: 'Failed to fetch meetings' }, { status: 500 })
    }

    // Transform data to include customer details
    const meetingsWithDetails: MeetingWithDetails[] = meetings.map((meeting: any) => ({
      ...meeting,
      customer_name: meeting.customer?.full_name,
      customer_email: meeting.customer?.email,
      customer_phone: meeting.customer?.phone,
      notes_count: meeting.notes?.[0]?.count || 0,
      reminders_count: meeting.reminders?.[0]?.count || 0
    }))

    return NextResponse.json({
      meetings: meetingsWithDetails,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit)
    })
  } catch (error: unknown) {
    apiLogger.error('Error in GET /api/meetings', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/meetings
 * Creates a new meeting
 *
 * Request Body:
 * - customer_id: UUID (optional)
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

    // Parse request body
    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.meeting_type || !body.scheduled_date) {
      return NextResponse.json(
        { error: 'Missing required fields: title, meeting_type, scheduled_date' },
        { status: 400 }
      )
    }

    // Prepare meeting data
    const meetingData = {
      sales_executive_id: user.id,
      customer_id: body.customer_id || null,
      title: body.title,
      description: body.description || null,
      meeting_type: body.meeting_type,
      status: 'SCHEDULED',
      scheduled_date: body.scheduled_date,
      scheduled_end_date: body.scheduled_end_date || null,
      duration_minutes: body.duration_minutes || 60,
      location: body.location || null,
      is_virtual: body.is_virtual || false,
      meeting_link: body.meeting_link || null,
      attendees: body.attendees || []
    }

    // Insert meeting
    const { data: meeting, error: insertError } = await supabase
      .from('meetings')
      .insert(meetingData)
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Error creating meeting', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create meeting' }, { status: 500 })
    }

    return NextResponse.json({ meeting }, { status: 201 })
  } catch (error: unknown) {
    apiLogger.error('Error in POST /api/meetings', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
