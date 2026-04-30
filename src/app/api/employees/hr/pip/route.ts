import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// PERFORMANCE IMPROVEMENT PLAN (PIP) API
// GET: List PIPs (HR/Manager view)
// POST: Create PIP for employee
// PATCH: Update PIP progress
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

const pipCreateSchema = z.object({
  employee_id: z.string().uuid(),
  pip_title: z.string().min(1, 'PIP title is required'),
  pip_type: z.string().optional(),
  triggered_by: z.string().optional(),
  trigger_details: z.string().optional(),
  performance_issues: z.string().min(1, 'Performance issues description is required'),
  specific_examples: z.string().optional(),
  impact_on_team: z.string().optional(),
  expected_improvements: z.string().min(1, 'Expected improvements are required'),
  success_criteria: z.string().min(1, 'Success criteria is required'),
  measurable_goals: z.array(z.object({ title: z.string(), description: z.string() })).optional(),
  support_provided: z.string().optional(),
  training_offered: z.string().optional(),
  resources_provided: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required'),
  review_date: z.string().min(1, 'Review date is required'),
  end_date: z.string().min(1, 'End date is required'),
  hr_notes: z.string().optional(),
})

async function verifyHROrManagerAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, employeeId?: string) {
  const { checkHRAccessByUserId } = await import('@/lib/auth/hr-access')
  const isHR = await checkHRAccessByUserId(supabase, userId)

  // Manager has access to their direct reports
  let isManager = false
  if (employeeId) {
    const adminCheck = createSupabaseAdmin()
    const { data: targetEmployee } = await adminCheck
      .from('employees')
      .select('reporting_manager_id')
      .eq('id', employeeId)
      .maybeSingle()

    isManager = targetEmployee && targetEmployee.reporting_manager_id === userId
  }

  return { isHR, isManager, hasAccess: isHR || isManager }
}

// GET: List PIPs
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

    const searchParams = request.nextUrl.searchParams
    const employeeId = searchParams.get('employee_id')
    const status = searchParams.get('status')

    // Check access
    const { isHR, isManager } = await verifyHROrManagerAccess(supabase, user.id, employeeId || undefined)

    if (!isHR && !isManager) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    let query = adminClient
      .from('performance_improvement_plans')
      .select(`
        *,
        employee:employees!performance_improvement_plans_employee_id_fkey(
          id,
          employee_id,
          full_name,
          work_email,
          sub_role
        ),
        manager:manager_id(
          id,
          full_name,
          work_email
        ),
        progress:pip_progress_updates(
          id,
          update_date,
          progress_summary,
          manager_rating,
          goals_met
        )
      `)
      .order('created_at', { ascending: false })

    if (employeeId) {
      query = query.eq('employee_id', employeeId)
    } else if (isManager && !isHR) {
      // Managers only see their team's PIPs
      query = query.eq('manager_id', user.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: pips, error: pipsError } = await query

    if (pipsError) {
      apiLogger.error('PIPs fetch error', pipsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch PIPs' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { pips }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PIP GET Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// POST: Create PIP
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const parsed = pipCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      employee_id,
      pip_title,
      pip_type,
      triggered_by,
      trigger_details,
      performance_issues,
      specific_examples,
      impact_on_team,
      expected_improvements,
      success_criteria,
      measurable_goals,
      support_provided,
      training_offered,
      resources_provided,
      start_date,
      review_date,
      end_date,
      hr_notes
    } = parsed.data

    // Check access
    const { hasAccess } = await verifyHROrManagerAccess(supabase, user.id, employee_id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    // Look up the employee's actual reporting manager
    const { data: targetEmployee } = await adminClient
      .from('employees')
      .select('reporting_manager_id')
      .eq('id', employee_id)
      .maybeSingle()

    const managerId = targetEmployee?.reporting_manager_id || user.id

    // Insert PIP - hr_id is the current user (HR who creates it)
    const { data: pip, error: insertError } = await adminClient
      .from('performance_improvement_plans')
      .insert({
        employee_id,
        manager_id: managerId,
        pip_title,
        pip_type: pip_type || 'STANDARD',
        triggered_by,
        trigger_details,
        performance_issues,
        specific_examples,
        impact_on_team,
        expected_improvements,
        success_criteria,
        measurable_goals,
        support_provided,
        training_offered,
        resources_provided,
        start_date,
        review_date,
        end_date,
        status: 'ACTIVE',
        hr_id: user.id,
        hr_notes,
        hr_notified: true
      })
      .select(`
        *,
        employee:employees!performance_improvement_plans_employee_id_fkey(
          id,
          full_name,
          work_email
        )
      `)
      .maybeSingle()

    if (insertError) {
      apiLogger.error('PIP insert error', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create PIP' }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'pip',
        entity_id: pip.id,
        description: `Created PIP "${pip_title}" for employee ${employee_id}`,
        details: { employee_id, pip_title, pip_type: pip_type || 'STANDARD', start_date, end_date }
      })
    } catch (auditErr) {
      apiLogger.error('Audit log failed for PIP creation', { error: auditErr })
    }

    return NextResponse.json({
      success: true,
      data: pip,
      message: 'PIP created successfully'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PIP POST Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// PATCH: Update PIP
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr

    const pipPatchSchema = z.object({
      pip_id: z.string().uuid('Invalid PIP ID'),
      action: z.enum(['ADD_PROGRESS_UPDATE', 'COMPLETE_MID_POINT_REVIEW', 'COMPLETE_FINAL_REVIEW']),
      progress_summary: z.string().max(5000).optional(),
      goals_met: z.boolean().optional(),
      goals_met_details: z.string().max(5000).optional(),
      challenges_faced: z.string().max(5000).optional(),
      support_requested: z.string().max(5000).optional(),
      manager_assessment: z.string().max(5000).optional(),
      manager_rating: z.number().min(1).max(5).optional(),
      action_items: z.string().max(5000).optional(),
      next_check_in_date: z.string().optional(),
      mid_point_review_notes: z.string().max(5000).optional(),
      mid_point_progress: z.string().max(5000).optional(),
      final_review_notes: z.string().max(5000).optional(),
      outcome: z.string().max(50).optional(),
      outcome_details: z.string().max(5000).optional(),
      next_action: z.string().max(50).optional(),
      next_action_notes: z.string().max(5000).optional(),
    })

    const parsed = pipPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { pip_id, action, ...updateData } = parsed.data

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    // Get PIP
    const { data: pip, error: pipError } = await adminClient
      .from('performance_improvement_plans')
      .select('*')
      .eq('id', pip_id)
      .maybeSingle()

    if (pipError || !pip) {
      return NextResponse.json({ success: false, error: 'PIP not found' }, { status: 404 })
    }

    // Check access
    const { hasAccess } = await verifyHROrManagerAccess(supabase, user.id, pip.employee_id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Status check - prevent actions on terminal PIP statuses
    const TERMINAL_STATUSES = ['SUCCESSFUL', 'UNSUCCESSFUL', 'TERMINATED']
    if (TERMINAL_STATUSES.includes(pip.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot perform ${action} on PIP with status ${pip.status}` },
        { status: 400 }
      )
    }

    if (action === 'ADD_PROGRESS_UPDATE') {
      const {
        progress_summary,
        goals_met,
        goals_met_details,
        challenges_faced,
        support_requested,
        manager_assessment,
        manager_rating,
        action_items,
        next_check_in_date
      } = updateData

      if (!progress_summary) {
        return NextResponse.json({ success: false, error: 'progress_summary required' }, { status: 400 })
      }

      // Insert progress update
      const { data: progress, error: progressError } = await adminClient
        .from('pip_progress_updates')
        .insert({
          pip_id,
          employee_id: pip.employee_id,
          progress_summary,
          goals_met: goals_met || false,
          goals_met_details,
          challenges_faced,
          support_requested,
          manager_assessment,
          manager_rating,
          action_items,
          next_check_in_date,
          created_by: user.id
        })
        .select()
        .maybeSingle()

      if (progressError) {
        return NextResponse.json({ success: false, error: 'Failed to add progress update' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'pip',
          entity_id: pip_id,
          description: `Added progress update to PIP`,
          details: { action: 'ADD_PROGRESS_UPDATE', pip_id, employee_id: pip.employee_id, goals_met: goals_met || false }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for PIP progress update', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: progress,
        message: 'Progress update added'
      })
    } else if (action === 'COMPLETE_MID_POINT_REVIEW') {
      const { mid_point_review_notes, mid_point_progress } = updateData

      const { data: updated, error: updateError } = await adminClient
        .from('performance_improvement_plans')
        .update({
          mid_point_review_notes,
          mid_point_review_date: new Date().toISOString().split('T')[0],
          mid_point_progress
        })
        .eq('id', pip_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update PIP' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'pip',
          entity_id: pip_id,
          description: `Completed mid-point review for PIP`,
          details: { action: 'COMPLETE_MID_POINT_REVIEW', pip_id, employee_id: pip.employee_id, mid_point_progress }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for PIP mid-point review', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Mid-point review completed'
      })
    } else if (action === 'COMPLETE_FINAL_REVIEW') {
      const { final_review_notes, outcome, outcome_details, next_action, next_action_notes } = updateData

      if (!outcome || !next_action) {
        return NextResponse.json({ success: false, error: 'outcome and next_action required' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await adminClient
        .from('performance_improvement_plans')
        .update({
          final_review_notes,
          final_review_date: new Date().toISOString().split('T')[0],
          outcome,
          outcome_details,
          next_action,
          next_action_date: new Date().toISOString().split('T')[0],
          next_action_notes,
          status: outcome === 'SUCCESSFUL' ? 'SUCCESSFUL' : (outcome === 'UNSUCCESSFUL' ? 'UNSUCCESSFUL' : 'EXTENDED')
        })
        .eq('id', pip_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to update PIP' }, { status: 500 })
      }

      // Audit log
      try {
        await adminClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'pip',
          entity_id: pip_id,
          description: `Completed final review for PIP - outcome: ${outcome}`,
          details: { action: 'COMPLETE_FINAL_REVIEW', pip_id, employee_id: pip.employee_id, outcome, next_action }
        })
      } catch (auditErr) {
        apiLogger.error('Audit log failed for PIP final review', { error: auditErr })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Final review completed'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PIP PATCH Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
