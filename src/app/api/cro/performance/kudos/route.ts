export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { requireCROAuth } from '@/lib/middleware/cro-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'received'

    const supabase = await createClient()

    let query = supabase
      .from('cro_peer_kudos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (view === 'received') {
      query = query.eq('to_user_id', user.id)
    } else if (view === 'sent') {
      query = query.eq('from_user_id', user.id)
    }
    // 'team' view returns all kudos (no user filter, just the limit + order)

    const { data: kudosList, error } = await query

    if (error) {
      // Table may not exist yet - return empty array gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] })
      }
      apiLogger.error('Error fetching kudos', error)
      return NextResponse.json({ success: true, data: [] })
    }

    return NextResponse.json({ success: true, data: kudosList || [] })
  } catch (error) {
    apiLogger.error('Error in kudos GET', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch kudos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCROAuth(request)
    if ('response' in authResult) return authResult.response
    const { user } = authResult

    const body = await request.json()
    const { to_employee_id, message, category } = body

    // Validate required fields
    if (!to_employee_id || !message?.trim() || !category) {
      return NextResponse.json(
        { success: false, error: 'to_employee_id, message, and category are required' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ['teamwork', 'innovation', 'customer_focus', 'leadership', 'above_beyond']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      )
    }

    // Validate message length
    if (message.trim().length > 200) {
      return NextResponse.json(
        { success: false, error: 'Message must be 200 characters or less' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get sender's profile info
    const { data: fromProfile } = await supabase
      .from('profiles')
      .select('display_name, employee_id')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get recipient's profile info - look up by employee_id
    const { data: toProfile } = await supabase
      .from('profiles')
      .select('user_id, display_name, employee_id')
      .eq('employee_id', to_employee_id)
      .maybeSingle()

    if (!toProfile) {
      return NextResponse.json(
        { success: false, error: 'Recipient not found' },
        { status: 404 }
      )
    }

    // Prevent self-kudos
    if (toProfile.user_id === user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot send kudos to yourself' },
        { status: 400 }
      )
    }

    // Insert the kudos
    const { data, error } = await supabase
      .from('cro_peer_kudos')
      .insert({
        from_user_id: user.id,
        from_name: fromProfile?.display_name || 'Unknown',
        from_employee_id: fromProfile?.employee_id || '',
        to_user_id: toProfile.user_id,
        to_name: toProfile.display_name || 'Unknown',
        to_employee_id: to_employee_id,
        message: message.trim(),
        category,
        reactions_count: 0,
      })
      .select()
      .single()

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        apiLogger.warn('cro_peer_kudos table does not exist yet')
        return NextResponse.json(
          { success: false, error: 'Kudos feature not yet available. Migration pending.' },
          { status: 503 }
        )
      }
      apiLogger.error('Error sending kudos', error)
      return NextResponse.json(
        { success: false, error: 'Failed to send kudos' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    apiLogger.error('Error in kudos POST', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send kudos' },
      { status: 500 }
    )
  }
}