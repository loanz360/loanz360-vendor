import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// EMPLOYEE GOALS API (OKRs/KPIs)
// GET: List employee goals
// POST: Create new goal
// PATCH: Update goal progress
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

async function getEmployeeId(supabase: any, userId: string) {
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  return employee?.id || null
}

// GET: List employee goals with filtering
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = await getEmployeeId(supabase, user.id)
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') // ANNUAL, QUARTERLY, MONTHLY
    const status = searchParams.get('status')
    const goalType = searchParams.get('goal_type')

    let query = supabase
      .from('employee_goals')
      .select(`
        *,
        framework:goal_frameworks(framework_name, framework_type),
        parent_objective:parent_objective_id(goal_title),
        progress_updates:goal_progress_updates(
          id,
          update_date,
          new_value,
          progress_percentage,
          new_status,
          update_notes
        )
      `)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })

    if (period) {
      query = query.eq('goal_period', period)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (goalType) {
      query = query.eq('goal_type', goalType)
    }

    const { data: goals, error: goalsError } = await query

    if (goalsError) {
      apiLogger.error('Goals fetch error', goalsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch goals' }, { status: 500 })
    }

    // Calculate summary statistics
    const stats = {
      total: goals.length,
      completed: goals.filter((g: any) => g.status === 'COMPLETED').length,
      on_track: goals.filter((g: any) => g.status === 'ON_TRACK').length,
      at_risk: goals.filter((g: any) => g.status === 'AT_RISK').length,
      behind: goals.filter((g: any) => g.status === 'BEHIND').length,
      avg_completion: goals.length > 0
        ? Math.round(goals.reduce((sum: number, g: any) => sum + (g.completion_percentage || 0), 0) / goals.length)
        : 0
    }

    return NextResponse.json({
      success: true,
      data: {
        goals,
        stats
      }
    })
  } catch (error) {
    apiLogger.error('Goals GET Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create new goal
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = await getEmployeeId(supabase, user.id)
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const {
      goal_title,
      goal_description,
      goal_type,
      goal_category,
      parent_objective_id,
      measurement_type,
      target_value,
      unit,
      goal_period,
      start_date,
      end_date,
      weightage,
      is_stretch_goal,
      aligned_with_company_okr
    } = body

    // Validation
    if (!goal_title || !goal_type || !measurement_type || !goal_period || !start_date || !end_date) {
      return NextResponse.json({ success: false, error: 'Missing required fields: goal_title, goal_type, measurement_type, goal_period, start_date, end_date'
      }, { status: 400 })
    }

    // Insert goal
    const { data: goal, error: insertError } = await supabase
      .from('employee_goals')
      .insert({
        employee_id: employeeId,
        goal_title,
        goal_description,
        goal_type,
        goal_category,
        parent_objective_id,
        measurement_type,
        target_value,
        unit,
        goal_period,
        start_date,
        end_date,
        weightage: weightage || 100,
        is_stretch_goal: is_stretch_goal || false,
        aligned_with_company_okr,
        status: 'DRAFT',
        created_by: user.id,
        approval_status: 'PENDING'
      })
      .select()
      .maybeSingle()

    if (insertError) {
      apiLogger.error('Goal insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create goal' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: goal,
      message: 'Goal created successfully'
    })
  } catch (error) {
    apiLogger.error('Goals POST Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update goal progress
export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const employeeId = await getEmployeeId(supabase, user.id)
    if (!employeeId) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    const { data: body, error: _valErr2 } = await parseBody(request)
    if (_valErr2) return _valErr2
    const { goal_id, action, ...updateData } = body

    if (!goal_id || !action) {
      return NextResponse.json({ success: false, error: 'goal_id and action required' }, { status: 400 })
    }

    // Verify ownership
    const { data: goal, error: goalError } = await supabase
      .from('employee_goals')
      .select('*')
      .eq('id', goal_id)
      .eq('employee_id', employeeId)
      .maybeSingle()

    if (goalError || !goal) {
      return NextResponse.json({ success: false, error: 'Goal not found' }, { status: 404 })
    }

    if (action === 'UPDATE_PROGRESS') {
      const { new_value, update_notes, challenges, support_needed } = updateData

      if (new_value === undefined) {
        return NextResponse.json({ success: false, error: 'new_value required' }, { status: 400 })
      }

      // Update goal current value (trigger will auto-calculate percentage)
      const { data: updated, error: updateError } = await supabase
        .from('employee_goals')
        .update({
          current_value: new_value,
          last_updated_by: user.id
        })
        .eq('id', goal_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update goal' }, { status: 500 })
      }

      // Create progress update record
      await supabase
        .from('goal_progress_updates')
        .insert({
          goal_id,
          employee_id: employeeId,
          previous_value: goal.current_value,
          new_value,
          progress_percentage: updated.completion_percentage,
          previous_status: goal.status,
          new_status: updated.status,
          update_notes,
          challenges,
          support_needed
        })

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Progress updated successfully'
      })
    } else if (action === 'UPDATE_STATUS') {
      const { status, approval_status } = updateData

      const { data: updated, error: updateError } = await supabase
        .from('employee_goals')
        .update({
          status: status || goal.status,
          approval_status: approval_status || goal.approval_status
        })
        .eq('id', goal_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Status updated successfully'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    apiLogger.error('Goals PATCH Error', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
