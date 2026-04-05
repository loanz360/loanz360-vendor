export const dynamic = 'force-dynamic'

// =====================================================
// EMPLOYEE ONBOARDING API
// GET: Fetch onboarding progress
// POST: Update onboarding task status
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

// GET: Fetch employee's onboarding progress
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, employee_id, full_name, date_of_joining, probation_end_date, employee_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Get onboarding session
    const { data: onboardingSession, error: sessionError } = await supabase
      .from('employee_onboarding_sessions')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json(
        { error: 'Onboarding session not found' },
        { status: 404 }
      )
    }

    // Get onboarding tasks with template details
    const { data: tasks, error: tasksError } = await supabase
      .from('employee_onboarding_progress')
      .select(`
        *,
        task_template:onboarding_task_templates(*)
      `)
      .eq('employee_id', employee.id)
      .order('task_template(display_order)', { ascending: true })

    if (tasksError) {
      apiLogger.error('Error fetching tasks', tasksError)
      return NextResponse.json(
        { error: 'Failed to fetch onboarding tasks' },
        { status: 500 }
      )
    }

    // Group tasks by category
    const tasksByCategory = {
      PRE_JOINING: tasks.filter(t => t.task_template?.task_category === 'PRE_JOINING'),
      DAY_1: tasks.filter(t => t.task_template?.task_category === 'DAY_1'),
      WEEK_1: tasks.filter(t => t.task_template?.task_category === 'WEEK_1'),
      MONTH_1: tasks.filter(t => t.task_template?.task_category === 'MONTH_1'),
      PROBATION_END: tasks.filter(t => t.task_template?.task_category === 'PROBATION_END')
    }

    return NextResponse.json({
      success: true,
      data: {
        employee,
        session: onboardingSession,
        tasks: tasks,
        tasksByCategory
      }
    })
  } catch (error) {
    apiLogger.error('Onboarding API Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Update task status
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { task_id, status, completion_notes, completion_proof_url } = body

    if (!task_id || !status) {
      return NextResponse.json(
        { error: 'task_id and status are required' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'SKIPPED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get employee record
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (empError || !employee) {
      return NextResponse.json(
        { error: 'Employee record not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {
      task_status: status,
      updated_at: new Date().toISOString()
    }

    if (status === 'IN_PROGRESS' && !body.started_at) {
      updateData.started_at = new Date().toISOString()
    }

    if (status === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
      updateData.completed_by = user.id
    }

    if (completion_notes) {
      updateData.completion_notes = completion_notes
    }

    if (completion_proof_url) {
      updateData.completion_proof_url = completion_proof_url
    }

    // Update task
    const { data: updatedTask, error: updateError } = await supabase
      .from('employee_onboarding_progress')
      .update(updateData)
      .eq('id', task_id)
      .eq('employee_id', employee.id) // Security check
      .select()
      .maybeSingle()

    if (updateError) {
      apiLogger.error('Update error', updateError)
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      )
    }

    // Get updated session stats
    const { data: updatedSession } = await supabase
      .from('employee_onboarding_sessions')
      .select('*')
      .eq('employee_id', employee.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        task: updatedTask,
        session: updatedSession
      }
    })
  } catch (error) {
    apiLogger.error('Onboarding POST Error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
