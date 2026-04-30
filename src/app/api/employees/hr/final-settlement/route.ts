import { parseBody } from '@/lib/utils/parse-body'

// =====================================================
// HR FINAL SETTLEMENT API
// POST: Calculate settlement
// PATCH: Approve and process payment
// GET: Get settlement details
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { settlementActionSchema } from '@/lib/validations/hr-schemas'

// GET: Get settlement details
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

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const searchParams = request.nextUrl.searchParams
    const resignationId = searchParams.get('resignation_id')
    const statusFilter = searchParams.get('status')

    const selectFields = `
      *,
      resignation:employee_resignations(
        id,
        employee_id,
        last_working_day,
        resignation_date,
        status
      ),
      employee:employees(
        id,
        employee_id,
        full_name,
        work_email,
        department,
        designation,
        date_of_joining
      )
    `

    // Single settlement lookup by resignation_id
    if (resignationId) {
      const { data: settlement, error: settlementError } = await adminClient
        .from('employee_final_settlement')
        .select(selectFields)
        .eq('resignation_id', resignationId)
        .maybeSingle()

      if (settlementError && settlementError.code !== 'PGRST116') {
        apiLogger.error('Settlement fetch error', settlementError)
        return NextResponse.json({ success: false, error: 'Failed to fetch settlement' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        data: settlement || null
      })
    }

    // List all settlements
    let query = adminClient
      .from('employee_final_settlement')
      .select(selectFields)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('calculation_status', statusFilter)
    }

    const { data: settlements, error: listError } = await query

    if (listError) {
      apiLogger.error('Settlements list error', listError)
      return NextResponse.json({ success: false, error: 'Failed to fetch settlements' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { settlements: settlements || [] }
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Final Settlement GET Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// POST: Calculate settlement
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

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { resignation_id } = body

    if (!resignation_id) {
      return NextResponse.json({ success: false, error: 'resignation_id required' }, { status: 400 })
    }

    // Check if settlement already exists
    const { data: existing } = await adminClient
      .from('employee_final_settlement')
      .select('id')
      .eq('resignation_id', resignation_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Settlement already calculated' }, { status: 400 })
    }

    // Call the database function to calculate settlement
    const { data: settlementId, error: calcError } = await adminClient
      .rpc('fn_calculate_final_settlement', { p_resignation_id: resignation_id })

    if (calcError) {
      apiLogger.error('Settlement calculation error', calcError)
      return NextResponse.json({ success: false, error: 'Failed to calculate settlement' }, { status: 500 })
    }

    // Fetch the calculated settlement
    const { data: settlement, error: fetchError } = await adminClient
      .from('employee_final_settlement')
      .select('*')
      .eq('id', settlementId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch calculated settlement' }, { status: 500 })
    }

    // Update resignation status
    await adminClient
      .from('employee_resignations')
      .update({
        final_settlement_status: 'CALCULATED',
        final_settlement_calculated_at: new Date().toISOString()
      })
      .eq('id', resignation_id)

    return NextResponse.json({
      success: true,
      data: settlement,
      message: 'Settlement calculated successfully'
    })
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Final Settlement POST Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// PATCH: Approve/process payment
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

    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    // Use admin client for data queries (bypasses RLS - auth already verified above)
    const adminClient = createSupabaseAdmin()

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const validated = settlementActionSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: validated.error.errors },
        { status: 400 }
      )
    }
    const { action, settlement_id, ...actionData } = validated.data

    if (action === 'APPROVE') {
      const { data: updated, error: updateError } = await adminClient
        .from('employee_final_settlement')
        .update({
          calculation_status: 'APPROVED',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          approval_notes: actionData.approval_notes || null
        })
        .eq('id', settlement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Settlement not found' }, { status: 404 })
      }

      // Update resignation
      await adminClient
        .from('employee_resignations')
        .update({ final_settlement_status: 'APPROVED' })
        .eq('id', updated.resignation_id)

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Settlement approved'
      })
    } else if (action === 'MARK_PAID') {
      const { payment_method, payment_reference, payment_date } = actionData

      if (!payment_method || !payment_reference) {
        return NextResponse.json({
          success: false, error: 'payment_method and payment_reference required'
        }, { status: 400 })
      }

      const { data: updated, error: updateError } = await adminClient
        .from('employee_final_settlement')
        .update({
          calculation_status: 'PAID',
          payment_status: 'PAID',
          payment_method,
          payment_reference,
          payment_date: payment_date || new Date().toISOString().split('T')[0]
        })
        .eq('id', settlement_id)
        .select()
        .maybeSingle()

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 })
      }

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Settlement not found' }, { status: 404 })
      }

      // Update resignation to completed
      await adminClient
        .from('employee_resignations')
        .update({
          final_settlement_status: 'PAID',
          final_settlement_paid_at: new Date().toISOString(),
          status: 'COMPLETED'
        })
        .eq('id', updated.resignation_id)

      // Update employee status to TERMINATED
      const { data: resignation } = await adminClient
        .from('employee_resignations')
        .select('employee_id')
        .eq('id', updated.resignation_id)
        .maybeSingle()

      if (resignation) {
        await adminClient
          .from('employees')
          .update({
            employee_status: 'TERMINATED',
            date_of_leaving: updated.last_working_day
          })
          .eq('id', resignation.employee_id)
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Settlement marked as paid. Offboarding complete.'
      })
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorId = crypto.randomUUID()
    apiLogger.error('Final Settlement PATCH Error', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
