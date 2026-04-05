export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET /api/employees/tasks - Get tasks for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Try fetching from employee_tasks table
    let query = supabase
      .from('employee_tasks')
      .select('*', { count: 'exact' })
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') query = query.eq('status', status)
    if (priority && priority !== 'all') query = query.eq('priority', priority)
    if (category && category !== 'all') query = query.eq('category', category)

    const { data: tasks, error, count } = await query

    if (error) {
      // If table doesn't exist, return empty data gracefully
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        return NextResponse.json({
          tasks: [],
          counts: { pending: 0, in_progress: 0, completed: 0, blocked: 0, overdue: 0, total: 0 },
          pagination: { page, limit, totalCount: 0, totalPages: 0, hasMore: false }
        })
      }
      apiLogger.error('Error fetching tasks', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Get counts for all statuses
    const { data: allTasks } = await supabase
      .from('employee_tasks')
      .select('status, due_date')
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)

    const now = new Date()
    const pendingCount = allTasks?.filter(t => t.status === 'pending').length || 0
    const inProgressCount = allTasks?.filter(t => t.status === 'in_progress').length || 0
    const completedCount = allTasks?.filter(t => t.status === 'completed').length || 0
    const blockedCount = allTasks?.filter(t => t.status === 'blocked').length || 0
    const overdueCount = allTasks?.filter(t =>
      t.due_date && new Date(t.due_date) < now && !['completed', 'cancelled'].includes(t.status)
    ).length || 0

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      tasks: tasks || [],
      counts: {
        pending: pendingCount,
        in_progress: inProgressCount,
        completed: completedCount,
        blocked: blockedCount,
        overdue: overdueCount,
        total: allTasks?.length || 0
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages
      }
    })
  } catch (error) {
    apiLogger.error('Error in GET /api/employees/tasks', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/employees/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      category = 'general',
      priority = 'medium',
      due_date,
      assigned_to,
      related_ticket_id,
      related_payout_id,
      related_entity_type,
      related_entity_id
    } = body

    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }

    // Get employee name
    const { data: employee } = await supabase
      .from('employees')
      .select('full_name, sub_role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: task, error: taskError } = await supabase
      .from('employee_tasks')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category,
        priority,
        status: 'pending',
        due_date: due_date || null,
        assigned_to: assigned_to || user.id,
        created_by: user.id,
        created_by_name: employee?.full_name || 'Unknown',
        related_ticket_id: related_ticket_id || null,
        related_payout_id: related_payout_id || null,
        related_entity_type: related_entity_type || null,
        related_entity_id: related_entity_id || null
      })
      .select()
      .maybeSingle()

    if (taskError) {
      if (taskError.message?.includes('relation') && taskError.message?.includes('does not exist')) {
        return NextResponse.json({
          error: 'Task management is being set up. Please try again later.',
          code: 'TABLE_NOT_READY'
        }, { status: 503 })
      }
      apiLogger.error('Error creating task', taskError)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({ success: true, task }, { status: 201 })
  } catch (error) {
    apiLogger.error('Error in POST /api/employees/tasks', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
