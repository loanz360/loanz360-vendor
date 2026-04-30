import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { z } from 'zod'

const claimStatusSchema = z.enum(['approved', 'rejected', 'under_review', 'paid'])

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
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employee_id')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('page_size') || '20', 10)
    const offset = (page - 1) * pageSize

    let query = adminClient
      .from('benefit_claims')
      .select(`
        *,
        employee_profile:employee_id ( first_name, last_name, employee_id ),
        benefit_plans:plan_id ( name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (status) query = query.eq('status', status)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: data || [], meta: { total: count || 0, page, page_size: pageSize } })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/benefits/claims', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const deny = await requireHRAccess(supabase)
    if (deny) return deny

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, status, approved_amount, remarks } = body

    if (!id) return NextResponse.json({ success: false, error: 'Claim ID required' }, { status: 400 })
    const parsed = claimStatusSchema.safeParse(status)
    if (!parsed.success)
      return NextResponse.json({ success: false, error: 'Invalid status. Must be one of: approved, rejected, under_review, paid' }, { status: 400 })

    // Fetch current claim to validate status transition
    const { data: currentClaim, error: fetchError } = await adminClient
      .from('benefit_claims')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !currentClaim) {
      return NextResponse.json({ success: false, error: 'Claim not found' }, { status: 404 })
    }

    // Valid transitions: pending->under_review->approved->paid, pending->rejected, under_review->rejected
    const validTransitions: Record<string, string[]> = {
      pending: ['under_review', 'rejected'],
      under_review: ['approved', 'rejected'],
      approved: ['paid'],
    }

    const allowed = validTransitions[currentClaim.status] || []
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status transition from '${currentClaim.status}' to '${status}'` },
        { status: 400 }
      )
    }

    const updatePayload: Record<string, unknown> = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    if (remarks !== undefined) updatePayload.remarks = remarks
    if (status === 'approved' && approved_amount != null) updatePayload.approved_amount = Number(approved_amount)
    if (status === 'rejected') updatePayload.approved_amount = null

    const { data, error } = await adminClient
      .from('benefit_claims')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        employee_profile:employee_id ( first_name, last_name, employee_id ),
        benefit_plans:plan_id ( name )
      `)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/benefits/claims', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}