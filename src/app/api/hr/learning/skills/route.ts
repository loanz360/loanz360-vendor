export const dynamic = 'force-dynamic'

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

interface SkillRecord {
  employee_id: string
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
    const employeeId = sp.get('employee_id')
    const category = sp.get('category')
    const page = parseInt(sp.get('page') || '1', 10)
    const pageSize = parseInt(sp.get('page_size') || '20', 10)
    const offset = (page - 1) * pageSize

    let query = adminClient
      .from('skill_matrix')
      .select('*', { count: 'exact' })
      .order('skill_category', { ascending: true })
      .order('skill_name', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (employeeId) query = query.eq('employee_id', employeeId)
    if (category) query = query.eq('skill_category', category)

    const { data: skills, error: skillErr, count } = await query
    if (skillErr) throw skillErr

    if (!skills || skills.length === 0) {
      return NextResponse.json({ success: true, data: [], meta: { total: 0, page, page_size: pageSize } })
    }

    const empIds = [...new Set(skills.map((s: SkillRecord) => s.employee_id))]
    const { data: empProfiles } = await adminClient
      .from('employee_profile')
      .select('id, first_name, last_name, designation, department')
      .in('id', empIds)

    const empMap = new Map((empProfiles || []).map((e: EmployeeProfile) => [e.id, e]))

    const result = skills.map((s: SkillRecord) => {
      const emp = empMap.get(s.employee_id)
      return {
        ...s,
        employee_name: emp ? ((emp.first_name || '') + ' ' + (emp.last_name || '')).trim() : 'Unknown',
        employee_designation: emp?.designation || null,
        employee_department: emp?.department || null,
      }
    })

    return NextResponse.json({ success: true, data: result, meta: { total: count || 0, page, page_size: pageSize } })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('GET /api/hr/learning/skills', { errorId, error: err })
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

    const body = await request.json()
    const { employee_id, skill_name, skill_category, proficiency_level } = body

    if (!employee_id) return NextResponse.json({ success: false, error: 'Employee ID is required' }, { status: 400 })
    if (!skill_name) return NextResponse.json({ success: false, error: 'Skill name is required' }, { status: 400 })
    if (proficiency_level === undefined || proficiency_level === null) {
      return NextResponse.json({ success: false, error: 'Proficiency level is required' }, { status: 400 })
    }

    const level = parseInt(proficiency_level, 10)
    if (isNaN(level) || level < 1 || level > 5) {
      return NextResponse.json({ success: false, error: 'Proficiency level must be between 1 and 5' }, { status: 400 })
    }

    const { data: existing } = await adminClient
      .from('skill_matrix')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('skill_name', skill_name)
      .maybeSingle()

    let result
    if (existing) {
      const { data: updated, error: updateErr } = await adminClient
        .from('skill_matrix')
        .update({ proficiency_level: level, skill_category: skill_category || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .maybeSingle()
      if (updateErr) throw updateErr
      result = updated
    } else {
      const { data: created, error: createErr } = await adminClient
        .from('skill_matrix')
        .insert({ employee_id, skill_name, skill_category: skill_category || null, proficiency_level: level })
        .select()
        .maybeSingle()
      if (createErr) throw createErr
      result = created
    }

    apiLogger.info('Skill matrix updated', { employeeId: employee_id, skillName: skill_name, level })
    return NextResponse.json({ success: true, data: result, message: 'Skill updated successfully' })
  } catch (err) {
    const errorId = crypto.randomUUID()
    apiLogger.error('PATCH /api/hr/learning/skills', { errorId, error: err })
    return NextResponse.json({ success: false, error: 'Internal server error', error_id: errorId }, { status: 500 })
  }
}
