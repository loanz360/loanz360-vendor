import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// HR RESIGNATION MANAGEMENT API
// GET: List all resignations with filters
// PATCH: Approve/reject, make counteroffer, process clearance
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccessByUserId } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { resignationActionSchema } from '@/lib/validations/hr-schemas'
import { sanitizeInput } from '@/lib/validation/input-validation'

// GET: List all resignations
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

    const hasAccess = await checkHRAccessByUserId(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = adminClient
      .from('employee_resignations')
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
          date_of_joining
        ),
        clearance:exit_clearance_checklist(*),
        exit_interview:exit_interview_responses(
          overall_sentiment,
          sentiment_score,
          is_regrettable_attrition
        ),
        settlement:employee_final_settlement(
          net_settlement_amount,
          payment_status
        )
      `, { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      const safeSearch = sanitizeInput(search, 100).replace(/[%_\\'"(),.]/g, '')
      if (safeSearch) {
        query = query.or(`employee.full_name.ilike.%${safeSearch}%,employee.employee_id.ilike.%${safeSearch}%`)
      }
    }

    query = query
      .order('resignation_date', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: resignations, error: resignError, count } = await query

    if (resignError) {
      apiLogger.error('Resignations fetch error', resignError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch resignations' },
        { status: 500 }
      )
    }

    // Get analytics
    const { data: analyticsData } = await adminClient.rpc('fn_get_attrition_analytics', {
      start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    })

    const analytics = analyticsData && analyticsData.length > 0 ? analyticsData[0] : null

    return NextResponse.json({
      success: true,
      data: resignations,
      stats: {
        total_resignations: analytics?.total_resignations ?? count ?? 0,
        pending_approval: analytics?.pending_approval ?? 0,
        approved_this_month: analytics?.approved_this_month ?? 0,
        in_notice_period: analytics?.in_notice_period ?? 0,
        attrition_rate: analytics?.attrition_rate ?? 0,
        avg_tenure_months: analytics?.avg_tenure_months ?? 0
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Resignations GET Error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}

// PATCH: Update resignation
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

    const hasAccess = await checkHRAccessByUserId(supabase, user.id)
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validated = resignationActionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: validated.error.errors },
        { status: 400 }
      )
    }
    const { action, resignation_id, ...actionData } = validated.data

    // Status transition validation - check current status allows the requested action
    const { data: currentResignation, error: fetchError } = await adminClient
      .from('employee_resignations')
      .select('status')
      .eq('id', resignation_id)
      .maybeSingle()

    if (fetchError || !currentResignation) {
      return NextResponse.json({ success: false, error: 'Resignation not found' }, { status: 404 })
    }

    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['APPROVE', 'REJECT', 'HOLD', 'MAKE_COUNTEROFFER'],
      ON_HOLD: ['APPROVE', 'REJECT', 'MAKE_COUNTEROFFER'],
      COUNTEROFFER_MADE: ['APPROVE', 'REJECT', 'HOLD'],
      APPROVED: ['MARK_DEPARTMENT_CLEARED'],
      IN_NOTICE_PERIOD: ['MARK_DEPARTMENT_CLEARED'],
    }

    const allowedActions = ALLOWED_TRANSITIONS[currentResignation.status] || []
    if (action !== 'MARK_DEPARTMENT_CLEARED' && !allowedActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Cannot perform ${action} on resignation with status ${currentResignation.status}` },
        { status: 400 }
      )
    }

    if (action === 'APPROVE') {
      const { data: updated, error: updateError } = await adminClient
        .from('employee_resignations')
        .update({
          status: 'APPROVED',
          hr_approval_status: 'APPROVED',
          hr_approved_by: user.id,
          hr_approved_at: new Date().toISOString(),
          hr_comments: actionData.hr_comments || null
        })
        .eq('id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Resignation approved'
      })
    } else if (action === 'REJECT') {
      const { data: updated, error: updateError } = await adminClient
        .from('employee_resignations')
        .update({
          status: 'REJECTED',
          hr_approval_status: 'REJECTED',
          hr_approved_by: user.id,
          hr_approved_at: new Date().toISOString(),
          hr_comments: actionData.hr_comments || null
        })
        .eq('id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      // Update employee status back to ACTIVE
      const { data: resignation, error: employeeError } = await adminClient
        .from('employee_resignations')
        .select('employee_id')
        .eq('id', resignation_id)
        .maybeSingle()

      if (!resignation || employeeError) {
        return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
      }

      await adminClient
        .from('employees')
        .update({ employee_status: 'ACTIVE' })
        .eq('id', resignation.employee_id)

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Resignation rejected'
      })
    } else if (action === 'HOLD') {
      const { data: updated, error: updateError } = await adminClient
        .from('employee_resignations')
        .update({
          status: 'ON_HOLD',
          hr_comments: actionData.hr_comments || null,
          hr_approved_by: user.id,
          hr_approved_at: new Date().toISOString()
        })
        .eq('id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Resignation put on hold'
      })
    } else if (action === 'MAKE_COUNTEROFFER') {
      const { counteroffer_details, counteroffer_amount, counteroffer_other_benefits } = actionData

      const { data: updated, error: updateError } = await adminClient
        .from('employee_resignations')
        .update({
          status: 'COUNTEROFFER_MADE',
          counteroffer_made: true,
          counteroffer_details,
          counteroffer_amount: counteroffer_amount || null,
          counteroffer_other_benefits: counteroffer_other_benefits || null,
          counteroffer_made_by: user.id,
          counteroffer_made_at: new Date().toISOString()
        })
        .eq('id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Counteroffer made successfully'
      })
    } else if (action === 'MARK_DEPARTMENT_CLEARED') {
      const { department, cleared_notes } = actionData

      const CLEARANCE_FIELD_MAP: Record<string, { status: string; clearedBy: string; clearedAt: string; notes: string }> = {
        IT: { status: 'it_clearance_status', clearedBy: 'it_cleared_by', clearedAt: 'it_cleared_at', notes: 'it_clearance_notes' },
        ADMIN: { status: 'admin_clearance_status', clearedBy: 'admin_cleared_by', clearedAt: 'admin_cleared_at', notes: 'admin_clearance_notes' },
        HR: { status: 'hr_clearance_status', clearedBy: 'hr_cleared_by', clearedAt: 'hr_cleared_at', notes: 'hr_clearance_notes' },
        FINANCE: { status: 'finance_clearance_status', clearedBy: 'finance_cleared_by', clearedAt: 'finance_cleared_at', notes: 'finance_clearance_notes' },
        MANAGER: { status: 'manager_clearance_status', clearedBy: 'manager_cleared_by', clearedAt: 'manager_cleared_at', notes: 'manager_clearance_notes' },
      }

      const fields = department ? CLEARANCE_FIELD_MAP[department] : undefined
      if (!fields) {
        return NextResponse.json({ success: false, error: 'Invalid department' }, { status: 400 })
      }

      const { data: updated, error: updateError } = await adminClient
        .from('exit_clearance_checklist')
        .update({
          [fields.status]: 'COMPLETED',
          [fields.clearedBy]: user.id,
          [fields.clearedAt]: new Date().toISOString(),
          [fields.notes]: cleared_notes || null
        })
        .eq('resignation_id', resignation_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: `${department} clearance marked as completed`
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('HR Resignations PATCH Error', { errorId, error })
    return NextResponse.json(
      { success: false, error: 'Internal server error', error_id: errorId },
      { status: 500 }
    )
  }
}
