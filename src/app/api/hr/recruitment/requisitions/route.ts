
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
    const status = searchParams.get('status')
    const parsedPage = parseInt(searchParams.get('page') || '1')
    const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage)
    const pageSize = 50
    const from = (page - 1) * pageSize

    let query = adminClient
      .from('job_requisitions')
      .select('*, departments:department_id ( name )', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data: reqs, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error

    const reqIds = (reqs || []).map((r: { id: string }) => r.id)
    const { data: candidates } = reqIds.length > 0
      ? await adminClient.from('candidates').select('requisition_id, stage').in('requisition_id', reqIds)
      : { data: [] }

    const candMap: Record<string, number> = {}
    for (const c of (candidates || [])) {
      candMap[c.requisition_id] = (candMap[c.requisition_id] || 0) + 1
    }

    const enriched = (reqs || []).map((r: { id: string; [key: string]: unknown }) => ({ ...r, candidate_count: candMap[r.id] || 0 }))
    const totalCount = count || 0
    return NextResponse.json({
      success: true,
      data: enriched,
      meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
    })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/recruitment/requisitions', { errorId, error })
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

    const body = await request.json()
    const { title, department_id, headcount, employment_type, experience_min, experience_max, salary_min, salary_max, priority, target_fill_date, job_description, requirements } = body

    if (!title?.trim()) return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })

    const { data, error } = await adminClient
      .from('job_requisitions')
      .insert({
        title: title.trim(), department_id: department_id || null,
        requested_by: user.id, headcount: headcount || 1,
        employment_type: employment_type || 'full_time',
        experience_min: experience_min || 0, experience_max: experience_max || null,
        salary_min: salary_min || null, salary_max: salary_max || null,
        priority: priority || 'normal', target_fill_date: target_fill_date || null,
        job_description: job_description || null, requirements: requirements || null,
        status: 'pending'
      })
      .select('*, departments:department_id ( name )')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/recruitment/requisitions', { errorId, error })
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

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ success: false, error: 'Requisition ID required' }, { status: 400 })

    // Validate status transitions - cannot go backwards
    if (body.status) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ['approved', 'cancelled'],
        approved: ['open', 'closed', 'cancelled'],
        open: ['filled', 'closed', 'cancelled'],
        filled: ['closed'],
        closed: [],
        cancelled: [],
      }

      const { data: current } = await adminClient
        .from('job_requisitions')
        .select('status')
        .eq('id', id)
        .maybeSingle()

      if (!current) {
        return NextResponse.json({ success: false, error: 'Requisition not found' }, { status: 404 })
      }

      const currentStatus = current.status as string
      const allowed = VALID_TRANSITIONS[currentStatus] || []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          success: false,
          error: `Invalid status transition: cannot move from "${currentStatus}" to "${body.status}". Allowed: ${allowed.join(', ') || 'none'}`
        }, { status: 400 })
      }
    }

    const allowedFields = ['title', 'department_id', 'headcount', 'employment_type', 'experience_min', 'experience_max', 'salary_min', 'salary_max', 'priority', 'target_fill_date', 'job_description', 'requirements', 'status']
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }
    if (body.status === 'approved') { updatePayload.approved_by = user.id; updatePayload.approved_at = new Date().toISOString() }
    if (body.status === 'closed') updatePayload.closed_at = new Date().toISOString()

    const { data, error } = await adminClient
      .from('job_requisitions')
      .update(updatePayload)
      .eq('id', id)
      .select('*, departments:department_id ( name )')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/recruitment/requisitions', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
