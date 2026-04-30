
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch reminders for the current user
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('employee_id', user.id)
      .order('due_date', { ascending: true })

    if (error) {
      apiLogger.error('Error fetching reminders', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch reminders' }, { status: 500 })
    }

    return NextResponse.json({ reminders }, { status: 200 })
  } catch (error) {
    apiLogger.error('Error in GET /api/employees/reminders', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description, due_date, priority } = body

    // Validate required fields
    if (!title || !description || !due_date || !priority) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, due_date, priority' },
        { status: 400 }
      )
    }

    // Validate priority
    if (!['low', 'medium', 'high'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be: low, medium, or high' },
        { status: 400 }
      )
    }

    // Create reminder
    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert([
        {
          employee_id: user.id,
          title,
          description,
          due_date,
          priority,
          status: 'pending',
        },
      ])
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error creating reminder', error)
      return NextResponse.json({ success: false, error: 'Failed to create reminder' }, { status: 500 })
    }

    return NextResponse.json({ reminder }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/employees/reminders', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
