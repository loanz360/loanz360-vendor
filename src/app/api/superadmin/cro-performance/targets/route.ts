import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'

// GET - List all CRO targets with filtering
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const croId = searchParams.get('cro_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query
    let query = supabase
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
      `, { count: 'exact' })

    if (month) query = query.eq('month', month)
    if (year) query = query.eq('year', parseInt(year))
    if (croId) query = query.eq('cro_id', croId)
    if (status) query = query.eq('status', status)

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .range(from, to)

    const { data: targets, error, count } = await query

    if (error) {
      apiLogger.error('Error fetching CRO targets', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    // Get employee IDs for CROs
    const croIds = targets?.map(t => t.cro_id) || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, employee_id')
      .in('user_id', croIds)

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.employee_id]) || [])

    // Enrich targets with employee IDs
    const enrichedTargets = targets?.map(t => ({
      ...t,
      employee_id: profileMap.get(t.cro_id) || 'N/A'
    }))

    return NextResponse.json({
      success: true,
      data: enrichedTargets,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    apiLogger.error('Error in GET /cro-performance/targets', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new CRO target
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify admin access
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

    const bodySchema = z.object({


      cro_ids: z.array(z.unknown()).optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { cro_ids, ...targetData } = body

    // Validate required fields
    if (!cro_ids || cro_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one CRO must be selected' }, { status: 400 })
    }

    if (!targetData.month || !targetData.year) {
      return NextResponse.json({ success: false, error: 'Month and year are required' }, { status: 400 })
    }

    // Create targets for all selected CROs
    const targetsToCreate = cro_ids.map((croId: string) => ({
      cro_id: croId,
      assigned_by: user.id,
      month: targetData.month,
      year: targetData.year,
      target_calls_per_day: targetData.target_calls_per_day || 50,
      target_call_duration_minutes: targetData.target_call_duration_minutes || 3,
      target_logins_per_day: targetData.target_logins_per_day || 1,
      target_leads_generated: targetData.target_leads_generated || 100,
      target_leads_converted: targetData.target_leads_converted || 20,
      target_conversion_rate: targetData.target_conversion_rate || 20,
      target_revenue: targetData.target_revenue || 0,
      target_volume: targetData.target_volume || 0,
      target_deals_per_day: targetData.target_deals_per_day || 2,
      target_deals_per_month: targetData.target_deals_per_month || 40,
      target_cases_sanctioned: targetData.target_cases_sanctioned || 15,
      target_cases_disbursed: targetData.target_cases_disbursed || 10,
      target_response_time_minutes: targetData.target_response_time_minutes || 30,
      target_followup_completion_rate: targetData.target_followup_completion_rate || 90,
      target_customer_satisfaction: targetData.target_customer_satisfaction || 4,
      target_lead_closing_days: targetData.target_lead_closing_days || 15,
      status: 'active',
      notes: targetData.notes || null
    }))

    const { data: createdTargets, error } = await supabase
      .from('cro_targets')
      .upsert(targetsToCreate, {
        onConflict: 'cro_id,month,year',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      apiLogger.error('Error creating CRO targets', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: createdTargets,
      message: `Successfully created targets for ${cro_ids.length} CRO(s)`
    })

  } catch (error) {
    apiLogger.error('Error in POST /cro-performance/targets', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
