import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { requireHRAccess } from '@/lib/auth/hr-access'
import { apiLogger } from '@/lib/utils/logger'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeInput } from '@/lib/validation/input-validation'

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
    const requisitionId = searchParams.get('requisition_id')
    const stage = searchParams.get('stage')
    const search = searchParams.get('search')

    const parsedPage = parseInt(searchParams.get('page') || '1')
    const page = Math.max(1, isNaN(parsedPage) ? 1 : parsedPage)
    const pageSize = 50
    const from = (page - 1) * pageSize

    let query = adminClient
      .from('candidates')
      .select('*, job_requisitions:requisition_id ( title )', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (requisitionId) query = query.eq('requisition_id', requisitionId)
    if (stage) query = query.eq('stage', stage)
    if (search) {
      const safeSearch = sanitizeInput(search, 100).replace(/[%_\\'"(),.]/g, '')
      if (safeSearch) {
        query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,current_company.ilike.%${safeSearch}%`)
      }
    }

    const { data, count, error } = await query.range(from, from + pageSize - 1)
    if (error) throw error
    const totalCount = count || 0
    return NextResponse.json({
      success: true,
      data: data || [],
      meta: { total: totalCount, page, total_pages: Math.max(1, Math.ceil(totalCount / pageSize)) }
    })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/recruitment/candidates', { errorId, error })
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


      full_name: z.string().optional(),


      email: z.string().email().optional(),


      phone: z.string().min(10).optional(),


      requisition_id: z.string().uuid().optional(),


      current_company: z.string().optional(),


      current_designation: z.string().optional(),


      total_experience_years: z.string().optional(),


      current_salary: z.string().optional(),


      expected_salary: z.string().optional(),


      notice_period_days: z.string().optional(),


      source: z.string().optional(),


      resume_url: z.string().optional(),


      notes: z.string().optional(),


      id: z.string().uuid(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { full_name, email, phone, requisition_id, current_company, current_designation, total_experience_years, current_salary, expected_salary, notice_period_days, source, resume_url, notes } = body

    if (!full_name?.trim()) return NextResponse.json({ success: false, error: 'Candidate name is required' }, { status: 400 })
    if (!email?.trim()) return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })

    // Check email uniqueness for the same requisition (or globally if no requisition)
    const emailCheckQuery = adminClient
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.trim())
    if (requisition_id) emailCheckQuery.eq('requisition_id', requisition_id)

    const { count: existingCount } = await emailCheckQuery
    if (existingCount && existingCount > 0) {
      return NextResponse.json({
        success: false,
        error: requisition_id
          ? 'A candidate with this email already exists for this requisition'
          : 'A candidate with this email already exists'
      }, { status: 409 })
    }

    const { data, error } = await adminClient
      .from('candidates')
      .insert({
        full_name: full_name.trim(), email: email.trim(), phone: phone || null,
        requisition_id: requisition_id || null,
        current_company: current_company || null, current_designation: current_designation || null,
        total_experience_years: total_experience_years || 0,
        current_salary: current_salary || null, expected_salary: expected_salary || null,
        notice_period_days: notice_period_days || 30,
        source: source || 'direct', resume_url: resume_url || null,
        notes: notes || null, stage: 'applied', assigned_to: user.id
      })
      .select('*, job_requisitions:requisition_id ( title )')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/recruitment/candidates', { errorId, error })
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

    const bodySchema2 = z.object({


      id: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const { id } = body
    if (!id) return NextResponse.json({ success: false, error: 'Candidate ID required' }, { status: 400 })

    const allowedFields = ['full_name', 'email', 'phone', 'stage', 'rejection_reason', 'resume_url', 'current_company', 'current_designation', 'total_experience_years', 'current_salary', 'expected_salary', 'notice_period_days', 'source', 'notes', 'requisition_id', 'assigned_to']
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowedFields) {
      if (key in body) updatePayload[key] = body[key]
    }

    const { data, error } = await adminClient
      .from('candidates')
      .update(updatePayload)
      .eq('id', id)
      .select('*, job_requisitions:requisition_id ( title )')
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/recruitment/candidates', { errorId, error })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
