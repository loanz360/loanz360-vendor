import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'


/**
 * Helper function to verify Digital Sales access
 */
async function verifyDigitalSalesAccess(supabase: unknown, userId: string) {
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
 * GET /api/employees/digital-sales/schedule/tasks/[id]
 * Retrieves a specific task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
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

    const { data: task, error } = await supabase
      .from('ds_tasks')
      .select(`
        *,
        lead:online_leads(id, customer_name, mobile, email, lead_stage),
        meeting:ds_meetings(id, title, scheduled_date, start_time)
      `)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error || !task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    // Get task comments
    const { data: comments } = await supabase
      .from('ds_task_comments')
      .select('*')
      .eq('task_id', id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })

    // Calculate overdue status
    const today = new Date().toISOString().split('T')[0]
    const is_overdue = task.due_date < today && !['COMPLETED', 'CANCELLED'].includes(task.status)

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        comments: comments || [],
        is_overdue
      }
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/digital-sales/schedule/tasks/[id]
 * Updates a specific task
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
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

    const bodySchema = z.object({


      status: z.string(),


      sub_tasks: z.array(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr

    // Verify task belongs to user
    const { data: existingTask } = await supabase
      .from('ds_tasks')
      .select('*')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    // Handle sub_tasks update and calculate progress
    let updateData: Record<string, unknown> = {
      ...body,
      updated_at: new Date().toISOString()
    }

    if (body.sub_tasks) {
      const completedCount = body.sub_tasks.filter((st: unknown) => st.is_completed).length
      const totalCount = body.sub_tasks.length
      updateData.progress_percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

      // If all sub-tasks completed, suggest completing the main task
      if (completedCount === totalCount && totalCount > 0 && existingTask.status !== 'COMPLETED') {
        // Don't auto-complete, but track it
      }
    }

    // If status changed to COMPLETED, set completed_at
    if (body.status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    } else if (body.status && body.status !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
      updateData.completed_at = null
    }

    // Remove fields that shouldn't be updated
    delete updateData.id
    delete updateData.sales_executive_id
    delete updateData.created_at

    const { data: task, error } = await supabase
      .from('ds_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/employees/digital-sales/schedule/tasks/[id]
 * Quick status update for task (used in Kanban drag-drop)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
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

    const bodySchema2 = z.object({


      status: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      )
    }

    // Verify task belongs to user
    const { data: existingTask } = await supabase
      .from('ds_tasks')
      .select('status')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existingTask) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString()
    }

    // Set completed_at if moving to COMPLETED
    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    } else if (status !== 'COMPLETED' && existingTask.status === 'COMPLETED') {
      updateData.completed_at = null
    }

    const { data: task, error } = await supabase
      .from('ds_tasks')
      .update(updateData)
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .select()
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task status updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating task status', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/digital-sales/schedule/tasks/[id]
 * Soft deletes a specific task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
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

    // Soft delete task
    const { error } = await supabase
      .from('ds_tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
