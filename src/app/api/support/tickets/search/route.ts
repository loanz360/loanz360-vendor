export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { apiLogger } from '@/lib/utils/logger'

// ============================================================================
// EMPLOYEE TICKET SEARCH API
// Search tickets by number or subject for merge/autocomplete functionality
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('sb-access-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken)

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const exclude = searchParams.get('exclude') || ''
    const status = searchParams.get('status') // Optional: filter by status
    const limit = parseInt(searchParams.get('limit') || '10')

    if (query.length < 2) {
      return NextResponse.json({ tickets: [] })
    }

    // Build query
    let dbQuery = supabase
      .from('support_tickets')
      .select(`
        id,
        ticket_number,
        subject,
        status,
        priority,
        created_at,
        employee:profiles!support_tickets_employee_id_fkey(
          full_name
        ),
        messages:support_ticket_messages(count)
      `)
      .or(`ticket_number.ilike.%${query}%,subject.ilike.%${query}%`)
      .neq('status', 'merged') // Don't include already merged tickets
      .limit(limit)
      .order('created_at', { ascending: false })

    // Exclude specific ticket (used when searching for merge candidates)
    if (exclude) {
      dbQuery = dbQuery.neq('id', exclude)
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      dbQuery = dbQuery.eq('status', status)
    }

    const { data: tickets, error } = await dbQuery

    if (error) {
      apiLogger.error('Search error', error)
      return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
    }

    // Format response
    const formattedTickets = tickets?.map(ticket => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      created_at: ticket.created_at,
      creator_name: ticket.employee?.full_name || 'Unknown',
      message_count: ticket.messages?.[0]?.count || 0
    })) || []

    return NextResponse.json({
      tickets: formattedTickets,
      count: formattedTickets.length
    })

  } catch (error) {
    apiLogger.error('Search error', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
