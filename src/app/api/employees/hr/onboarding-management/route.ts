export const dynamic = 'force-dynamic'

// =====================================================
// HR ONBOARDING MANAGEMENT API
// GET: List all onboarding employees with filters
// PATCH: Update task status, assign HR/buddy
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeInput } from '@/lib/validation/input-validation'

// GET: List all onboarding employees
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

    // Verify HR access
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') // NOT_STARTED, IN_PROGRESS, COMPLETED
    const phase = searchParams.get('phase') // PRE_JOINING, DAY_1, WEEK_1, MONTH_1, PROBATION_END
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query using admin client (bypasses RLS)
    let query = adminClient
      .from('employee_onboarding_sessions')
      .select(`
        *,
        employee:employees(
          id,
          employee_id,
          full_name,
          work_email,
          mobile_number,
          sub_role,
          department_id,
          date_of_joining,
          probation_end_date,
          employee_status
        )
      `, { count: 'exact' })

    if (status) {
      query = query.eq('onboarding_status', status)
    }

    if (phase) {
      query = query.eq('current_phase', phase)
    }

    // Add search if provided
    if (search) {
      const safeSearch = sanitizeInput(search, 100).replace(/[%_\\'"(),.]/g, '')
      if (safeSearch) {
        query = query.or(`employee.full_name.ilike.%${safeSearch}%,employee.employee_id.ilike.%${safeSearch}%,employee.work_email.ilike.%${safeSearch}%`)
      }
    }

    query = query
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: sessions, error: sessionsError, count } = await query

    if (sessionsError) {
      apiLogger.error('Sessions fetch error', sessionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch onboarding sessions' },
        { status: 500 }
      )
    }

    // Get dashboard stats
    const { data: statsData } = await adminClient.rpc('fn_get_onboarding_dashboard_stats')
    const stats = statsData && statsData.length > 0 ? statsData[0] : null

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats: stats || {
          total_onboarding: 0,
          pre_joining: 0,
          day_1: 0,
          week_1: 0,
          month_1: 0,
          probation_end: 0,
          avg_completion_percentage: 0,
          overdue_tasks: 0
        }
      }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Onboarding Management GET Error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}

// PATCH: Update onboarding session or task
export async function PATCH(request: NextRequest) {
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

    // Verify HR access
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const body = await request.json()
    const { action, employee_id, task_id, hr_assigned, buddy_assigned, task_status, hr_notes } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      )
    }

    if (action === 'ASSIGN_HR_BUDDY') {
      if (!employee_id) {
        return NextResponse.json(
          { success: false, error: 'employee_id is required' },
          { status: 400 }
        )
      }

      const updateData: Record<string, unknown> = {}
      if (hr_assigned) updateData.hr_assigned = hr_assigned
      if (buddy_assigned) updateData.buddy_assigned = buddy_assigned
      if (hr_notes) updateData.hr_notes = hr_notes

      const { data: updatedSession, error: updateError } = await adminClient
        .from('employee_onboarding_sessions')
        .update(updateData)
        .eq('employee_id', employee_id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Update error', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: updatedSession,
        message: 'HR/Buddy assigned successfully'
      })
    } else if (action === 'UPDATE_TASK_STATUS') {
      if (!task_id || !task_status) {
        return NextResponse.json(
          { success: false, error: 'task_id and task_status are required' },
          { status: 400 }
        )
      }

      const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'NOT_APPLICABLE']
      if (!validStatuses.includes(task_status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid task_status' },
          { status: 400 }
        )
      }

      const updateData: Record<string, unknown> = {
        task_status,
        updated_at: new Date().toISOString()
      }

      if (task_status === 'COMPLETED') {
        updateData.completed_at = new Date().toISOString()
        updateData.completed_by = user.id
      }

      const { data: updatedTask, error: updateError } = await adminClient
        .from('employee_onboarding_progress')
        .update(updateData)
        .eq('id', task_id)
        .select()
        .maybeSingle()

      if (updateError) {
        apiLogger.error('Task update error', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update task' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: updatedTask,
        message: 'Task updated successfully'
      })
    } else if (action === 'APPROVE_PROBATION') {
      if (!employee_id) {
        return NextResponse.json(
          { success: false, error: 'employee_id is required' },
          { status: 400 }
        )
      }

      // Update employee status to ACTIVE (confirmed)
      const { error: empUpdateError } = await adminClient
        .from('employees')
        .update({
          employee_status: 'ACTIVE',
          probation_end_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', employee_id)

      if (empUpdateError) {
        apiLogger.error('Employee update error', empUpdateError)
        return NextResponse.json(
          { success: false, error: 'Failed to confirm employee' },
          { status: 500 }
        )
      }

      // Update onboarding session
      const { data: updatedSession, error: sessionError } = await adminClient
        .from('employee_onboarding_sessions')
        .update({
          onboarding_status: 'COMPLETED',
          probation_completed: true,
          confirmation_date: new Date().toISOString().split('T')[0],
          completed_at: new Date().toISOString()
        })
        .eq('employee_id', employee_id)
        .select()
        .maybeSingle()

      if (sessionError) {
        apiLogger.error('Session update error', sessionError)
        return NextResponse.json(
          { success: false, error: 'Failed to update onboarding session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: updatedSession,
        message: 'Probation completed. Employee confirmed.'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Onboarding Management PATCH Error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
