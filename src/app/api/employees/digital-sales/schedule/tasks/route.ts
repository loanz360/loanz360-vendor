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
 * GET /api/employees/digital-sales/schedule/tasks
 * Retrieves tasks for Digital Sales executive
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
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const lead_id = searchParams.get('lead_id')
    const meeting_id = searchParams.get('meeting_id')
    const is_overdue = searchParams.get('is_overdue')
    const search = searchParams.get('search')
    const sort_by = searchParams.get('sort_by') || 'due_date'
    const sort_order = searchParams.get('sort_order') || 'asc'
    const view = searchParams.get('view') // 'kanban' or 'list'

    // Build query
    let query = supabase
      .from('ds_tasks')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage)
      `, { count: 'exact' })
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)

    // Apply filters
    if (status) {
      const statuses = status.split(',')
      query = query.in('status', statuses)
    }

    if (category) {
      const categories = category.split(',')
      query = query.in('category', categories)
    }

    if (priority) {
      const priorities = priority.split(',')
      query = query.in('priority', priorities)
    }

    if (date_from) {
      query = query.gte('due_date', date_from)
    }

    if (date_to) {
      query = query.lte('due_date', date_to)
    }

    if (lead_id) {
      query = query.eq('lead_id', lead_id)
    }

    if (meeting_id) {
      query = query.eq('meeting_id', meeting_id)
    }

    if (is_overdue === 'true') {
      const today = new Date().toISOString().split('T')[0]
      query = query.lt('due_date', today).neq('status', 'COMPLETED').neq('status', 'CANCELLED')
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sort_order === 'asc'
    if (sort_by === 'priority') {
      // Custom priority ordering: CRITICAL > HIGH > MEDIUM > LOW
      query = query.order('priority', { ascending: !ascending })
    } else {
      query = query.order(sort_by, { ascending })
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: tasks, error, count } = await query

    if (error) {
      throw error
    }

    // For Kanban view, group by status
    if (view === 'kanban') {
      const grouped = {
        PENDING: tasks?.filter(t => t.status === 'PENDING') || [],
        IN_PROGRESS: tasks?.filter(t => t.status === 'IN_PROGRESS') || [],
        COMPLETED: tasks?.filter(t => t.status === 'COMPLETED') || [],
        ON_HOLD: tasks?.filter(t => t.status === 'ON_HOLD') || [],
        CANCELLED: tasks?.filter(t => t.status === 'CANCELLED') || []
      }

      return NextResponse.json({
        success: true,
        data: {
          grouped,
          total: count || 0,
          page,
          limit,
          total_pages: Math.ceil((count || 0) / limit)
        }
      })
    }

    // Calculate overdue flag for each task
    const today = new Date().toISOString().split('T')[0]
    const enrichedTasks = tasks?.map(task => ({
      ...task,
      is_overdue: task.due_date < today && !['COMPLETED', 'CANCELLED'].includes(task.status)
    }))

    return NextResponse.json({
      success: true,
      data: {
        tasks: enrichedTasks || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching Digital Sales tasks', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/employees/digital-sales/schedule/tasks
 * Creates a new task for Digital Sales executive
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
      description,
      category = 'GENERAL',
      priority = 'MEDIUM',
      due_date,
      due_time,
      lead_id,
      customer_id,
      meeting_id,
      sub_tasks = [],
      tags = [],
      attachments = [],
      is_recurring = false,
      recurrence_pattern
    } = body

    // Validate required fields
    if (!title || !due_date) {
      return NextResponse.json(
        { success: false, error: 'Title and due date are required' },
        { status: 400 }
      )
    }

    // Get lead/customer name if provided
    let lead_name = null, customer_name = null
    if (lead_id) {
      const { data: lead } = await supabase
        .from('online_leads')
        .select('customer_name')
        .eq('id', lead_id)
        .maybeSingle()
      lead_name = lead?.customer_name
    }

    // Get meeting title if provided
    let meeting_title = null
    if (meeting_id) {
      const { data: meeting } = await supabase
        .from('ds_meetings')
        .select('title')
        .eq('id', meeting_id)
        .maybeSingle()
      meeting_title = meeting?.title
    }

    // Format sub_tasks with IDs
    const formattedSubTasks = sub_tasks.map((st: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      title: st.title,
      is_completed: false,
      completed_at: null
    }))

    // Calculate initial progress
    const progress_percentage = 0

    // Create task
    const { data: task, error: createError } = await supabase
      .from('ds_tasks')
      .insert({
        sales_executive_id: user.id,
        lead_id,
        customer_id,
        meeting_id,
        title,
        description,
        category,
        priority,
        status: 'PENDING',
        due_date,
        due_time,
        sub_tasks: formattedSubTasks,
        progress_percentage,
        lead_name,
        customer_name,
        meeting_title,
        tags,
        attachments,
        is_recurring,
        recurrence_pattern,
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
      data: task,
      message: 'Task created successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error creating Digital Sales task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
