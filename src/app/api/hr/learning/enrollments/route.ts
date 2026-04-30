import { parseBody } from '@/lib/utils/parse-body'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdmin } from '@/lib/supabase/server'
import { apiLogger } from '@/lib/utils/logger'
import { checkHRAccess } from '@/lib/auth/hr-access'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rateLimit'

interface EmployeeProfile {
  id: string
  first_name: string | null
  last_name: string | null
  designation: string | null
  department: string | null
}

interface ProgramInfo {
  id: string
  title: string | null
  category: string | null
  delivery_mode: string | null
  duration_hours: number | null
}

interface EnrollmentRecord {
  employee_id: string
  program_id: string
  [key: string]: unknown
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
    const status = sp.get('status')
    const programId = sp.get('program_id')
    const employeeId = sp.get('employee_id')

    let query = adminClient
      .from('training_enrollments')
      .select('*', { count: 'exact' })
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (status) query = query.eq('status', status)
    if (programId) query = query.eq('program_id', programId)
    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data: enrollments, error: enrErr, count } = await query
    if (enrErr) throw enrErr

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize } })
    }

    const empIds = [...new Set(enrollments.map((e: EnrollmentRecord) => e.employee_id))]
    const progIds = [...new Set(enrollments.map((e: EnrollmentRecord) => e.program_id))]

    const [{ data: empProfiles }, { data: programs }] = await Promise.all([
      adminClient.from('employee_profile').select('id, first_name, last_name, designation, department').in('id', empIds),
      adminClient.from('training_programs').select('id, title, category, delivery_mode, duration_hours').in('id', progIds),
    ])

    const empMap = new Map((empProfiles || []).map((e: EmployeeProfile) => [e.id, e]))
    const progMap = new Map((programs || []).map((p: ProgramInfo) => [p.id, p]))

    const result = enrollments.map((e: EnrollmentRecord) => {
      const emp = empMap.get(e.employee_id)
      const prog = progMap.get(e.program_id)
      return {
        ...e,
        employee_name: emp ? ((emp.first_name || '') + ' ' + (emp.last_name || '')).trim() : 'Unknown',
        employee_designation: emp?.designation || null,
        employee_department: emp?.department || null,
        program_title: prog?.title || 'Unknown Program',
        program_category: prog?.category || null,
        program_delivery_mode: prog?.delivery_mode || null,
        program_duration_hours: prog?.duration_hours || null,
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      meta: { total: count || 0, page, page_size: pageSize },
    })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/learning/enrollments', { errorId, error: err })
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { employee_id, program_id } = body

    if (!employee_id) return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 })
    if (!program_id) return NextResponse.json({ success: false, error: 'Program ID is required' }, { status: 400 })

    const { data: existing } = await adminClient
      .from('training_enrollments')
      .select('id, status')
      .eq('employee_id', employee_id)
      .eq('program_id', program_id)
      .not('status', 'eq', 'dropped')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: false, error: 'Employee is already enrolled in this program' }, { status: 409 })
    }

    const { data: program } = await adminClient
      .from('training_programs')
      .select('id, max_participants')
      .eq('id', program_id)
      .maybeSingle()

    if (!program) return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 })

    if (program.max_participants) {
      const { count: currentCount } = await adminClient
        .from('training_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', program_id)
        .not('status', 'eq', 'dropped')

      if ((currentCount || 0) >= program.max_participants) {
        return NextResponse.json({ success: false, error: 'Program is at full capacity' }, { status: 409 })
      }
    }

    const { data: enrollment, error: createErr } = await adminClient
      .from('training_enrollments')
      .insert({
        employee_id,
        program_id,
        enrolled_by: user.id,
        status: 'enrolled',
        progress_percent: 0,
        enrolled_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (createErr) throw createErr
    if (!enrollment) return NextResponse.json({ success: false, error: 'Enrollment was created but could not be retrieved' }, { status: 500 })

    apiLogger.info('Training enrollment created', { enrollmentId: enrollment.id, employeeId: employee_id, programId: program_id })
    return NextResponse.json({ success: true, data: enrollment, message: 'Employee enrolled successfully' }, { status: 201 })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('POST /api/hr/learning/enrollments', { errorId, error: err })
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

    const { data: body, error: _valErr } = await parseBody(request)
    if (_valErr) return _valErr
    const { id, action, progress_percent, score, feedback, status } = body

    if (!id) return NextResponse.json({ success: false, error: 'Enrollment ID is required' }, { status: 400 })

    const { data: enrollment } = await adminClient
      .from('training_enrollments')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!enrollment) return NextResponse.json({ success: false, error: 'Enrollment not found' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (action === 'mark_complete') {
      updates.status = 'completed'
      updates.progress_percent = 100
      updates.completed_at = new Date().toISOString()
      if (score !== undefined) updates.score = parseFloat(score)
      if (feedback !== undefined) updates.feedback = feedback
    } else if (action === 'start') {
      updates.status = 'in_progress'
      updates.started_at = new Date().toISOString()
    } else if (action === 'drop') {
      updates.status = 'dropped'
    } else {
      if (progress_percent !== undefined) {
        const parsed = parseInt(progress_percent, 10)
        updates.progress_percent = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed))
        if (updates.progress_percent > 0 && enrollment.status === 'enrolled') {
          updates.status = 'in_progress'
          updates.started_at = new Date().toISOString()
        }
      }
      if (status !== undefined) updates.status = status
      if (score !== undefined) updates.score = parseFloat(score)
      if (feedback !== undefined) updates.feedback = feedback
    }

    const { data: updated, error: updateErr } = await adminClient
      .from('training_enrollments')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (updateErr) throw updateErr

    apiLogger.info('Training enrollment updated', { enrollmentId: id, action: action || 'update' })
    return NextResponse.json({ success: true, data: updated, message: 'Enrollment updated successfully' })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/learning/enrollments', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
