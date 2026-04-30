import { parseBody } from '@/lib/utils/parse-body'
import { z } from 'zod'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'
import { sanitizeSearchInput } from '@/lib/validations/input-sanitization'

interface ProgramRecord {
  id: string
  [key: string]: unknown
}

interface EnrollmentSummary {
  program_id: string
  status: string
  progress_percent: number | null
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const sp = request.nextUrl.searchParams
    const page = parseInt(sp.get('page') || '1', 10)
    const pageSize = parseInt(sp.get('page_size') || '20', 10)
    const offset = (page - 1) * pageSize
    const category = sp.get('category')
    const status = sp.get('status') || 'active'
    const search = sp.get('search') || ''

    let query = adminClient
      .from('training_programs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (status && status !== 'all') query = query.eq('status', status)
    if (category) query = query.eq('category', category)
    if (search) {
      const safeSearch = sanitizeSearchInput(search)
      if (safeSearch) query = query.ilike('title', '%' + safeSearch + '%')
    }

    const { data: programs, error: progErr, count } = await query
    if (progErr) throw progErr

    if (!programs || programs.length === 0) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize } })
    }

    const progIds = programs.map((p: ProgramRecord) => p.id)
    const { data: enrollments } = await adminClient
      .from('training_enrollments')
      .select('program_id, status, progress_percent')
      .in('program_id', progIds)

    const enrollMap = new Map<string, EnrollmentSummary[]>()
    for (const e of (enrollments || []) as EnrollmentSummary[]) {
      if (!enrollMap.has(e.program_id)) enrollMap.set(e.program_id, [])
      enrollMap.get(e.program_id)!.push(e)
    }

    const result = programs.map((p: ProgramRecord) => {
      const enrs = enrollMap.get(p.id) || []
      const completed = enrs.filter((e: EnrollmentSummary) => e.status === 'completed')
      const avgCompletion = enrs.length > 0
        ? Math.round(enrs.reduce((s: number, e: EnrollmentSummary) => s + (e.progress_percent || 0), 0) / enrs.length)
        : 0
      return {
        ...p,
        enrollment_count: enrs.length,
        completed_count: completed.length,
        avg_completion: avgCompletion,
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      meta: { total: count || 0, page, page_size: pageSize },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/learning/programs', { errorId, error: err })
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
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const bodySchema = z.object({


      title: z.string(),


      description: z.string().optional(),


      category: z.string(),


      delivery_mode: z.string(),


      duration_hours: z.string().optional(),


      is_mandatory: z.boolean().optional(),


      target_roles: z.string().optional(),


      max_participants: z.string().optional(),


      facilitator: z.string().optional(),


      status: z.string().optional(),


    })


    const { data: body, error: _valErr } = await parseBody(request, bodySchema)
    if (_valErr) return _valErr
    const { title, description, category, delivery_mode, duration_hours, is_mandatory, target_roles, max_participants, facilitator } = body

    if (!title) return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    if (!category) return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 })
    if (!delivery_mode) return NextResponse.json({ success: false, error: 'Delivery mode is required' }, { status: 400 })

    const { data: program, error: createErr } = await adminClient
      .from('training_programs')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category,
        delivery_mode,
        duration_hours: duration_hours ? parseFloat(duration_hours) : null,
        is_mandatory: is_mandatory === true,
        target_roles: Array.isArray(target_roles) ? target_roles : [],
        max_participants: max_participants ? parseInt(max_participants, 10) : null,
        facilitator: facilitator?.trim() || null,
        status: 'active',
        created_by: user.id,
      })
      .select()
      .maybeSingle()

    if (createErr) throw createErr
    if (!program) return NextResponse.json({ success: false, error: 'Program was created but could not be retrieved' }, { status: 500 })

    apiLogger.info('Training program created', { programId: program.id, title })
    return NextResponse.json({ success: true, data: program, message: 'Program created successfully' }, { status: 201 })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/learning/programs', { errorId, error: err })
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
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const bodySchema2 = z.object({


      delivery_mode: z.string().optional(),


      category: z.string().optional(),


      title: z.string().optional(),


      duration_hours: z.string().optional(),


      is_mandatory: z.boolean().optional(),


      description: z.string().optional(),


      target_roles: z.string().optional(),


      facilitator: z.string().optional(),


      status: z.string().optional(),


      max_participants: z.string().optional(),


    })


    const { data: body, error: _valErr2 } = await parseBody(request, bodySchema2)
    if (_valErr2) return _valErr2
    const queryId = request.nextUrl.searchParams.get('id')
    const { id: bodyId, title, description, category, delivery_mode, duration_hours, is_mandatory, target_roles, max_participants, facilitator, status } = body
    const id = bodyId || queryId

    if (!id) return NextResponse.json({ success: false, error: 'Program ID is required' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title !== undefined) updates.title = title.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (category !== undefined) updates.category = category
    if (delivery_mode !== undefined) updates.delivery_mode = delivery_mode
    if (duration_hours !== undefined) updates.duration_hours = duration_hours ? parseFloat(duration_hours) : null
    if (is_mandatory !== undefined) updates.is_mandatory = is_mandatory === true
    if (target_roles !== undefined) updates.target_roles = Array.isArray(target_roles) ? target_roles : []
    if (max_participants !== undefined) updates.max_participants = max_participants ? parseInt(max_participants, 10) : null
    if (facilitator !== undefined) updates.facilitator = facilitator?.trim() || null
    if (status !== undefined) updates.status = status

    const { data: program, error: updateErr } = await adminClient
      .from('training_programs')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateErr) throw updateErr

    apiLogger.info('Training program updated', { programId: id })
    return NextResponse.json({ success: true, data: program, message: 'Program updated successfully' })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/learning/programs', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}

// Soft-delete: archives the program instead of permanently deleting
// This preserves enrollment history and analytics data
export async function DELETE(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMIT_CONFIGS.DEFAULT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const adminClient = createSupabaseAdmin()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    const isHR = await checkHRAccess(supabase)
    if (!isHR) return NextResponse.json({ success: false, error: 'Forbidden: HR access required' }, { status: 403 })

    const sp = request.nextUrl.searchParams
    const id = sp.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Program ID is required' }, { status: 400 })

    // Check for active enrollments before archiving
    const { data: activeEnrollments, error: enrollErr } = await adminClient
      .from('training_enrollments')
      .select('id')
      .eq('program_id', id)
      .in('status', ['enrolled', 'in_progress'])
      .limit(1)
    if (enrollErr) {
      apiLogger.error('DELETE /api/hr/learning/programs - enrollment check', { error: enrollErr })
      // Non-blocking: proceed with archive even if check fails
    }
    if (activeEnrollments && activeEnrollments.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot archive program with active enrollments. Please complete or drop all active enrollments first.' },
        { status: 400 }
      )
    }

    const { error: archiveErr } = await adminClient
      .from('training_programs')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)

    if (archiveErr) throw archiveErr

    apiLogger.info('Training program archived', { programId: id })
    return NextResponse.json({ success: true, message: 'Program archived successfully' })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('DELETE /api/hr/learning/programs', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
