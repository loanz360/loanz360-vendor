
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - Get single target details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: target, error } = await supabase
      .from('cro_targets')
      .select(`
        *,
        cro:users!cro_targets_cro_id_fkey (
          id,
          full_name,
          email
        ),
        assigned_by_user:users!cro_targets_assigned_by_fkey (
          id,
          full_name
        )
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    if (!target) {
      return NextResponse.json({ success: false, error: 'Target not found' }, { status: 404 })
    }

    // Get current performance for comparison
    const { data: performance } = await supabase
      .from('cro_monthly_summary')
      .select('*')
      .eq('cro_id', target.cro_id)
      .eq('month', target.month)
      .eq('year', target.year)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      data: {
        ...target,
        current_performance: performance || null
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /cro-performance/targets/[id]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update target
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const { data: updatedTarget, error } = await supabase
      .from('cro_targets')
      .update({
        target_calls_per_day: body.target_calls_per_day,
        target_call_duration_minutes: body.target_call_duration_minutes,
        target_logins_per_day: body.target_logins_per_day,
        target_leads_generated: body.target_leads_generated,
        target_leads_converted: body.target_leads_converted,
        target_conversion_rate: body.target_conversion_rate,
        target_revenue: body.target_revenue,
        target_volume: body.target_volume,
        target_deals_per_day: body.target_deals_per_day,
        target_deals_per_month: body.target_deals_per_month,
        target_cases_sanctioned: body.target_cases_sanctioned,
        target_cases_disbursed: body.target_cases_disbursed,
        target_response_time_minutes: body.target_response_time_minutes,
        target_followup_completion_rate: body.target_followup_completion_rate,
        target_customer_satisfaction: body.target_customer_satisfaction,
        target_lead_closing_days: body.target_lead_closing_days,
        status: body.status,
        notes: body.notes
      })
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedTarget,
      message: 'Target updated successfully'
    })

  } catch (error) {
    apiLogger.error('Error in PUT /cro-performance/targets/[id]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete target
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData || !['SUPER_ADMIN', 'ADMIN'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('cro_targets')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Target deleted successfully'
    })

  } catch (error) {
    apiLogger.error('Error in DELETE /cro-performance/targets/[id]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
