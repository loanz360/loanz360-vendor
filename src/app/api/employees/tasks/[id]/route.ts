export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// PATCH /api/employees/tasks/[id] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: taskId } = await params
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: any = {}

    if (body.status) updates.status = body.status
    if (body.priority) updates.priority = body.priority
    if (body.title) updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description?.trim() || null
    if (body.due_date !== undefined) updates.due_date = body.due_date
    if (body.notes !== undefined) updates.notes = body.notes

    // Track completion
    if (body.status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }

    updates.updated_at = new Date().toISOString()

    const { data: task, error } = await supabase
      .from('employee_tasks')
      .update(updates)
      .eq('id', taskId)
      .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
      .select()
      .maybeSingle()

    if (error) {
      apiLogger.error('Error updating task', error)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({ success: true, task })
  } catch (error) {
    apiLogger.error('Error in PATCH /api/employees/tasks/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/employees/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: taskId } = await params
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('employee_tasks')
      .delete()
      .eq('id', taskId)
      .eq('created_by', user.id)

    if (error) {
      apiLogger.error('Error deleting task', error)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    apiLogger.error('Error in DELETE /api/employees/tasks/[id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
