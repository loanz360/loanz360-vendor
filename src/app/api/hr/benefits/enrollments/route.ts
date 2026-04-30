import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('plan_id')
    const employeeId = searchParams.get('employee_id')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('page_size') || '20', 10)
    const offset = (page - 1) * pageSize

    let query = adminClient
      .from('employee_benefit_enrollments')
      .select(`
        *,
        employee_profile:employee_id ( first_name, last_name, employee_id ),
        benefit_plans:plan_id ( name, type )
      `, { count: 'exact' })
      .order('enrollment_date', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (planId) query = query.eq('plan_id', planId)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [], meta: { total: count || 0, page, page_size: pageSize } })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/benefits/enrollments', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.CREATE)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const bodySchema = z.object({


      employee_id: z.string().uuid(),


      plan_id: z.string().uuid(),


      effective_from: z.string(),


      effective_to: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { employee_id, plan_id, effective_from, effective_to } = body

    if (!employee_id) return NextResponse.json({ success: false, error: 'Employee ID required' }, { status: 400 })
    if (!plan_id) return NextResponse.json({ success: false, error: 'Plan ID required' }, { status: 400 })
    if (!effective_from) return NextResponse.json({ success: false, error: 'Effective from date required' }, { status: 400 })

    // Validate plan exists and is active
    const { data: plan } = await adminClient
      .from('benefit_plans')
      .select('id, is_active')
      .eq('id', plan_id)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Benefit plan not found' }, { status: 404 })
    }
    if (!plan.is_active) {
      return NextResponse.json({ success: false, error: 'Benefit plan is not active' }, { status: 400 })
    }

    // Validate employee exists
    const { data: employee } = await adminClient
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .maybeSingle()

    if (!employee) {
      return NextResponse.json({ success: false, error: 'Employee not found' }, { status: 404 })
    }

    // Check for overlapping active enrollment
    const { data: overlaps } = await adminClient
      .from('employee_benefit_enrollments')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('plan_id', plan_id)
      .eq('status', 'active')
      .limit(1)

    if (overlaps && overlaps.length > 0) {
      return NextResponse.json({ success: false, error: 'Active enrollment already exists for this plan' }, { status: 409 })
    }

    const { data, error } = await adminClient
      .from('employee_benefit_enrollments')
      .insert({
        employee_id, plan_id,
        effective_from,
        effective_to: effective_to || null,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active',
        enrolled_by: user.id
      })
      .select(`
        *,
        employee_profile:employee_id ( first_name, last_name, employee_id ),
        benefit_plans:plan_id ( name, type )
      `)
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ success: false, error: 'Employee is already enrolled in this plan for the given effective date' }, { status: 409 })
      throw error
    }
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/benefits/enrollments', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}