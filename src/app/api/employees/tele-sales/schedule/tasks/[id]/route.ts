import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export const dynamic = 'force-dynamic'

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
 * GET /api/employees/tele-sales/schedule/tasks/[id]
 * Retrieves a specific task by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const { data: task, error } = await supabase
      .from('ts_tasks')
      .select('*')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
      }
      throw error
    }

    const today = new Date().toISOString().split('T')[0]
    const taskWithOverdue = {
      ...task,
      is_overdue: task.due_date < today && !['COMPLETED', 'CANCELLED'].includes(task.status)
    }

    return NextResponse.json({
      success: true,
      data: taskWithOverdue
    })

  } catch (error: unknown) {
    apiLogger.error('Error fetching TeleSales task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/employees/tele-sales/schedule/tasks/[id]
 * Updates a specific task
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const { data: existing } = await supabase
      .from('ts_tasks')
      .select('id, sales_executive_id, sub_tasks')
      .eq('id', id)
      .eq('sales_executive_id', user.id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    // Build update data
    const updateData: Record<string, any> = {}
    const allowedFields = [
      'title', 'description', 'category', 'priority', 'status',
      'due_date', 'due_time', 'sub_tasks', 'tags', 'attachments'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Calculate progress percentage from sub-tasks
    if (body.sub_tasks) {
      const completed = body.sub_tasks.filter((st: any) => st.is_completed).length
      const total = body.sub_tasks.length
      updateData.progress_percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    }

    // Set completed_at if status changed to COMPLETED
    if (body.status === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data: task, error } = await supabase
      .from('ts_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error updating TeleSales task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employees/tele-sales/schedule/tasks/[id]
 * Soft deletes a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const { error } = await supabase
      .from('ts_tasks')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('sales_executive_id', user.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error: unknown) {
    apiLogger.error('Error deleting TeleSales task', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
