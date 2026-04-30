import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
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
 * GET /api/employees/tele-sales/schedule/tasks
 * Retrieves tasks for the TeleSales executive
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
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const overdue = searchParams.get('overdue')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const today = new Date().toISOString().split('T')[0]

    let query = supabase
      .from('ts_tasks')
      .select('*', { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (dateFrom) {
      query = query.gte('due_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('due_date', dateTo)
    }
    if (overdue === 'true') {
      query = query
        .lt('due_date', today)
        .neq('status', 'COMPLETED')
        .neq('status', 'CANCELLED')
    }

    // Order by priority then due date
    query = query
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: tasks, error, count } = await query

    if (error) throw error

    // Calculate is_overdue for each task
    const tasksWithOverdue = tasks?.map(task => ({
      ...task,
      is_overdue: task.due_date < today && !['COMPLETED', 'CANCELLED'].includes(task.status)
    })) || []

    return NextResponse.json({
      success: true,
      data: tasksWithOverdue,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales tasks', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/tele-sales/schedule/tasks
 * Creates a new task for the TeleSales executive
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
    if (!body.title || !body.due_date) {
      return NextResponse.json(
        { success: false, error: 'Title and due date are required' },
        { status: 400 }
      )
    }

    // Process sub-tasks
    const subTasks = body.sub_tasks?.map((st: { title: string }) => ({
      id: uuidv4(),
      title: st.title,
      is_completed: false,
      completed_at: null
    })) || []

    // Get linked entity names
    let leadName = null
    let callTitle = null

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

    const taskData = {
      sales_executive_id: user.id,
      lead_id: body.lead_id || null,
      call_id: body.call_id || null,
      title: body.title,
      description: body.description || null,
      category: body.category || 'GENERAL',
      priority: body.priority || 'MEDIUM',
      status: 'PENDING',
      due_date: body.due_date,
      due_time: body.due_time || null,
      sub_tasks: subTasks,
      progress_percentage: 0,
      tags: body.tags || [],
      attachments: body.attachments || [],
      is_recurring: body.is_recurring || false,
      recurrence_pattern: body.recurrence_pattern || null,
      lead_name: leadName,
      call_title: callTitle
    }

    const { data: task, error } = await supabase
      .from('ts_tasks')
      .insert(taskData)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task created successfully'
    }, { status: 201 })

  } catch (error: unknown) {
    apiLogger.error('Error creating TeleSales task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
